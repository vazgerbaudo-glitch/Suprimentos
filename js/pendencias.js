// Auditoria de pendências de preenchimento — considera toda a base carregada (ALL),
// independente dos filtros de Período/Tipo/Comprador do painel, e exclui itens marcados
// como "Remover de Compras Ágeis". Compartilhado entre os painéis Ágeis e Terminais.
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
        desc: 'Itens sem SLA Alvo definido (em branco, "#N/D" ou "Não se aplica").',
        hit: r => r.ss === 'S'
    },
    {
        label: 'Falta "Área Cliente"',
        desc: 'Itens sem a Área Cliente preenchida.',
        hit: r => !r.ac
    },
    {
        label: 'SLA Real negativo',
        desc: 'Itens com SLA Real negativo — inconsistência de datas a corrigir.',
        hit: r => r.sr < 0
    }
];

function computePend(rule) {
    const rows = ALL.filter(r => !r.rm && rule.hit(r));
    const byResp = {};
    rows.forEach(r => { const cp = r.cp || 'N/D'; byResp[cp] = (byResp[cp] || 0) + 1; });
    const top = Object.entries(byResp).map(([cp, n]) => ({ cp, n })).sort((a, b) => b.n - a.n);
    return { total: rows.length, top };
}

function pendBars(rows) {
    if (!rows.length) return '<div style="color:var(--muted);font-size:12px;padding:4px 0">Nenhuma pendência no recorte atual.</div>';
    const top = rows.slice(0, 10), max = top[0].n;
    const bars = top.map(r => {
        const w = Math.max(6, Math.round(r.n / max * 100));
        const a = .14 + .68 * r.n / max;
        return `<div style="display:flex;align-items:center;gap:8px;margin:4px 0">
<div style="width:100px;flex:0 0 100px;font-size:11px;color:var(--ink);text-align:right;white-space:nowrap;overflow:hidden;text-overflow:ellipsis" title="${r.cp}">${r.cp}</div>
<div style="height:20px;width:${w}%;background:rgba(210,55,60,${a.toFixed(2)});border-radius:4px;display:flex;align-items:center;justify-content:flex-end;padding:0 8px;color:${a > .5 ? '#FFFFFF' : '#13303F'};font-size:11px;font-weight:700;min-width:24px">${r.n}</div>
</div>`;
    }).join('');
    const extra = rows.length > 10 ? `<div style="font-size:10.5px;color:var(--muted);margin-top:4px">+${rows.length - 10} outro(s) responsável(is)</div>` : '';
    return bars + extra;
}

function renderPendencias() {
    const html = PEND_RULES.map(rule => {
        const data = computePend(rule);
        return `<div class="panel" style="margin-bottom:14px">
<h3>${rule.label} <span class="tag-sev s-rd">${data.total.toLocaleString('pt-BR')}</span></h3>
<div class="ph">${rule.desc}</div>
${pendBars(data.top)}
</div>`;
    }).join('');
    document.getElementById('pend-body').innerHTML = html;
}

function openPendModal() {
    if (!ALL.length) { alert('Os dados ainda estão carregando — tente novamente em instantes.'); return; }
    renderPendencias();
    document.getElementById('pend-ov').classList.add('open');
}

(function () {
    const ov = document.createElement('div');
    ov.className = 'modal-ov';
    ov.id = 'pend-ov';
    ov.innerHTML = `<div class="modal">
    <h3>🔍 Pendências de preenchimento</h3>
    <div class="ph">Considera toda a base carregada, independente dos filtros de Período/Tipo/Comprador · exclui itens marcados como "Remover de Compras Ágeis".</div>
    <div id="pend-body" style="overflow-y:auto;flex:1;margin:10px 0"></div>
    <div class="modal-actions"><button class="btn ghost" id="pend-close">Fechar</button></div>
 </div>`;
    document.body.appendChild(ov);
    document.getElementById('pend-close').onclick = () => ov.classList.remove('open');
    ov.addEventListener('click', e => { if (e.target === ov) ov.classList.remove('open'); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape') ov.classList.remove('open'); });
    const btn = document.getElementById('btn_pend');
    if (btn) btn.onclick = openPendModal;
})();
