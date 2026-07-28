// Auditoria de pendências de preenchimento — considera toda a base carregada (ALL),
// independente dos filtros de Período/Tipo/Comprador do painel, mas exclui itens marcados
// como "Remover de Compras Ágeis", RCs Canceladas/Devolvidas e itens liberados antes de
// DATA_INI (abril/2026). Compartilhado entre os painéis Ágeis e Terminais.
const isBlankOrCancelada = v => {
    const s = ('' + (v || '')).trim();
    return !s || s.toLowerCase() === 'cancelada';
};

const PEND_RULES = [
    {
        label: 'Falta "Data Início 2"',
        desc: 'RCs em aberto sem a data de início da etapa 2 (Análise de Escopo) — processo ainda não avançou.',
        hit: r => r.st === 'A' && !r.di2
    },
    {
        label: 'Falta "Data de Conclusão"',
        desc: 'RCs marcadas como Concluída mas sem a data de conclusão preenchida.',
        hit: r => r.st === 'C' && !r.dc
    },
    {
        label: 'SLA Alvo não preenchido',
        desc: 'Itens concluídos sem SLA Alvo definido (em branco, "#N/D" ou "Não se aplica") — exclui Status RC, Tipo e Classificação vazios ou "Cancelada", e RCs sem Data de Conclusão.',
        hit: r => r.st !== '?' && !isBlankOrCancelada(r.td) && !isBlankOrCancelada(r.cl) && !!r.dc && r.ss === 'S'
    },
    {
        label: 'Falta "Área Cliente"',
        desc: 'Itens sem a Área Cliente preenchida — exclui Status RC, Tipo e Classificação vazios ou "Cancelada".',
        hit: r => r.st !== '?' && !isBlankOrCancelada(r.td) && !isBlankOrCancelada(r.cl) && !r.ac
    },
    {
        label: 'SLA Real negativo',
        desc: 'Itens com SLA Real negativo — inconsistência de datas a corrigir.',
        hit: r => r.sr < 0
    }
];

function computePend(rule) {
    const rows = ALL.filter(r => !r.rm && r.st !== 'X' && r.st !== 'D' && r.dl && r.dl >= DATA_INI && rule.hit(r));
    const byResp = {};
    rows.forEach(r => { const cp = r.cp || 'N/D'; byResp[cp] = (byResp[cp] || 0) + 1; });
    const top = Object.entries(byResp).map(([cp, n]) => ({ cp, n })).sort((a, b) => b.n - a.n);
    return { total: rows.length, top };
}

function pendBars(rows) {
    if (!rows.length) return '<div class="pend-empty">Nenhuma pendência no recorte atual.</div>';
    const max = rows[0].n;
    return rows.map(r => {
        const w = Math.max(18, Math.round(r.n / max * 70));
        const a = .18 + .64 * r.n / max;
        return `<div class="pend-row">
<span class="pend-name" title="${r.cp}">${r.cp}</span>
<span class="pend-pill" style="width:${w}%;background:rgba(210,55,60,${a.toFixed(2)});color:${a > .5 ? '#FFFFFF' : 'var(--ink)'}">${r.n}</span>
</div>`;
    }).join('');
}

function renderPendencias() {
    const cards = PEND_RULES.map(rule => {
        const data = computePend(rule);
        return `<div class="pend-card">
<h4 title="${rule.desc}">${rule.label} <span class="tag-sev s-rd">${data.total.toLocaleString('pt-BR')}</span></h4>
${pendBars(data.top)}
</div>`;
    }).join('');
    document.getElementById('pend-body').innerHTML = `<div class="pend-shot" id="pend-shot"><div class="pend-grid">${cards}</div></div>`;
}

function openPendModal() {
    if (!ALL.length) { alert('Os dados ainda estão carregando — tente novamente em instantes.'); return; }
    renderPendencias();
    document.getElementById('pend-ov').classList.add('open');
}

let _h2cPromise = null;
function loadHtml2Canvas() {
    if (window.html2canvas) return Promise.resolve();
    if (_h2cPromise) return _h2cPromise;
    _h2cPromise = new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = 'https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js';
        s.onload = resolve;
        s.onerror = reject;
        document.head.appendChild(s);
    });
    return _h2cPromise;
}

function exportPendImage() {
    const btn = document.getElementById('pend-export');
    const target = document.getElementById('pend-shot');
    if (!target) return;
    const label = btn.textContent;
    btn.textContent = '⏳ Gerando...';
    btn.disabled = true;
    loadHtml2Canvas().then(() => window.html2canvas(target, {
        backgroundColor: '#F2F5F6',
        scale: 2
    })).then(canvas => {
        const a = document.createElement('a');
        const d = new Date();
        const stamp = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
        a.download = `pendencias-preenchimento-${stamp}.png`;
        a.href = canvas.toDataURL('image/png');
        a.click();
    }).catch(() => {
        alert('Não foi possível gerar a imagem. Tente novamente.');
    }).finally(() => {
        btn.textContent = label;
        btn.disabled = false;
    });
}

(function () {
    const ov = document.createElement('div');
    ov.className = 'modal-ov';
    ov.id = 'pend-ov';
    ov.innerHTML = `<div class="modal wide">
    <h3>🔍 Pendências de preenchimento</h3>
    <div class="ph">Considera toda a base carregada a partir de abril/2026, independente dos filtros de Período/Tipo/Comprador · exclui Canceladas, Devolvidas e itens marcados como "Remover de Compras Ágeis".</div>
    <div id="pend-body" style="overflow-y:auto;flex:1;margin:10px 0"></div>
    <div class="modal-actions"><button class="btn ghost" id="pend-export">📷 Baixar imagem</button><button class="btn ghost" id="pend-close">Fechar</button></div>
 </div>`;
    document.body.appendChild(ov);
    document.getElementById('pend-close').onclick = () => ov.classList.remove('open');
    document.getElementById('pend-export').onclick = exportPendImage;
    ov.addEventListener('click', e => { if (e.target === ov) ov.classList.remove('open'); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape') ov.classList.remove('open'); });
    const btn = document.getElementById('btn_pend');
    if (btn) btn.onclick = openPendModal;
})();
