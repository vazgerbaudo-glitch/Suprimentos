// Auditoria de pendências de preenchimento — considera toda a base carregada (ALL),
// independente dos filtros de Período/Tipo/Comprador do painel, mas exclui itens marcados
// como "Remover de Compras Ágeis", RCs Canceladas/Devolvidas e itens liberados antes de
// DATA_INI (abril/2026) — salvo nas regras com `floor` próprio, que usam outro corte.
// Compartilhado entre os painéis Ágeis, Corporativo, Rodantes e Terminais.
const isBlankOrCancelada = v => {
    const s = ('' + (v || '')).trim();
    return !s || s.toLowerCase() === 'cancelada';
};

// A ordem dos cartões é a ordem de preenchimento pedida pela área — da pendência que trava o
// fechamento do indicador para a que é só inconsistência de data.
const PEND_RULES = [
    {
        label: 'Falta "Data de Conclusão"',
        desc: 'RCs marcadas como Concluída mas sem a data de conclusão preenchida.',
        hit: r => r.st === 'C' && !r.dc
    },
    // A pendência real é o Cenário SLA, não o SLA Alvo: o SLA Alvo é derivado do cenário por PROCV, e
    // "#N/D" ali é só o sintoma do cenário em branco (a correspondência é exata em todas as bases —
    // Cenário vazio nunca convive com SLA Alvo numérico). Já "Não se aplica" no SLA Alvo corresponde a
    // Cenário "Projeto(s) Complexo(s)"/"Não se Aplica", que é preenchimento correto e não pendência —
    // era o que a regra antiga (r.ss === 'S', que só enxerga "sem alvo numérico") acusava por engano.
    // Corte em jan/2026 (e não abr/2026): itens liberados no início do ano seguem sendo concluídos agora.
    {
        label: 'Cenário SLA não preenchido',
        desc: 'Itens concluídos sem Cenário SLA definido — sem ele o SLA Alvo não é calculado e chega como "#N/D". Não conta "Projeto Complexo"/"Não se Aplica", que são cenários válidos sem alvo numérico. Exclui Status RC, Tipo e Classificação vazios ou "Cancelada", e RCs sem Data de Conclusão. Considera desde janeiro/2026, diferente das demais regras (abril/2026).',
        hit: r => r.st !== '?' && !isBlankOrCancelada(r.td) && !isBlankOrCancelada(r.cl) && !!r.dc && !('' + (r.cen || '')).trim(),
        floor: DATA_INI_AGING
    },
    {
        label: 'Falta "Área Cliente"',
        desc: 'Itens sem a Área Cliente preenchida — exclui Status RC, Tipo e Classificação vazios ou "Cancelada".',
        hit: r => r.st !== '?' && !isBlankOrCancelada(r.td) && !isBlankOrCancelada(r.cl) && !r.ac
    },
    {
        label: 'Falta "Carteira/Categoria"',
        desc: 'Itens sem o código de Carteira/Categoria preenchido — exclui Status RC, Tipo e Classificação vazios ou "Cancelada". Considera desde janeiro/2026 (mesmo início da aba Contratualização), diferente das demais regras (abril/2026).',
        hit: r => r.st !== '?' && !isBlankOrCancelada(r.td) && !isBlankOrCancelada(r.cl) && !('' + (r.cat || '')).trim(),
        floor: DATA_INI_AGING
    },
    {
        label: 'Falta "Data Início 2"',
        desc: 'RCs em aberto sem a data de início da etapa 2 (Análise de Escopo) — processo ainda não avançou.',
        hit: r => r.st === 'A' && !r.di2
    },
    {
        label: 'SLA Real negativo',
        desc: 'Itens com SLA Real negativo — inconsistência de datas a corrigir.',
        hit: r => r.sr < 0
    }
];

function computePend(rule) {
    const rows = ALL.filter(r => !r.rm && r.st !== 'X' && r.st !== 'D' && r.dl && r.dl >= (rule.floor || DATA_INI) && rule.hit(r));
    const byResp = {};
    rows.forEach(r => { const cp = r.cp || 'N/D'; byResp[cp] = (byResp[cp] || 0) + 1; });
    const top = Object.entries(byResp).map(([cp, n]) => ({ cp, n })).sort((a, b) => b.n - a.n);
    return { total: rows.length, top };
}

// A intensidade do vermelho acompanha o volume: o maior responsável fica no tom cheio
// e os menores desbotam, para o olho ranquear a lista sem precisar ler os números.
function pendBars(rows) {
    if (!rows.length) return '<div class="pend-empty">Nenhuma pendência no recorte atual.</div>';
    const max = rows[0].n;
    return rows.map(r => {
        const a = .35 + .65 * r.n / max;
        return `<div class="pend-row">
<span class="pend-name" title="${r.cp}">${r.cp}</span>
<span class="pend-val" style="color:rgba(210,55,60,${a.toFixed(2)})">${r.n.toLocaleString('pt-BR')}</span>
</div>`;
    }).join('');
}

function renderPendencias() {
    const cards = PEND_RULES.map(rule => {
        const data = computePend(rule);
        return `<div class="pend-card">
<h4 title="${rule.desc}">${rule.label}<span class="pend-total">${data.total.toLocaleString('pt-BR')} itens</span></h4>
${pendBars(data.top)}
</div>`;
    }).join('');
    // Colunas fixas pelo nº de regras (e não auto-fit): todos os cartões ficam lado a lado numa
    // única faixa, que é o que mantém os cabeçalhos e as linhas alinhados entre si.
    const cols = `repeat(${PEND_RULES.length},minmax(0,1fr))`;
    document.getElementById('pend-body').innerHTML = `<div class="pend-shot" id="pend-shot"><div class="pend-frame"><div class="pend-grid" style="grid-template-columns:${cols}">${cards}</div></div></div>`;
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

// html2canvas não calcula bem CSS Grid (os cartões saem sobrepostos na imagem, mesmo alinhados
// na tela) — antes de capturar, "congela" o grid em posições absolutas idênticas às da tela
// (pixel a pixel), captura, e desfaz depois para o layout responsivo continuar funcionando.
function freezeGridForCapture(grid) {
    const cards = Array.from(grid.querySelectorAll('.pend-card'));
    const gridRect = grid.getBoundingClientRect();
    const positions = cards.map(card => {
        const r = card.getBoundingClientRect();
        return { left: r.left - gridRect.left, top: r.top - gridRect.top, width: r.width, height: r.height };
    });
    const maxBottom = Math.max(0, ...positions.map(p => p.top + p.height));
    const prevGridStyle = grid.getAttribute('style');
    grid.style.position = 'relative';
    grid.style.height = maxBottom + 'px';
    cards.forEach((card, i) => {
        const prev = card.getAttribute('style');
        const p = positions[i];
        card.style.position = 'absolute';
        card.style.margin = '0';
        card.style.left = p.left + 'px';
        card.style.top = p.top + 'px';
        card.style.width = p.width + 'px';
        // A altura precisa vir junto: fora do grid o cartão perde o stretch e encolhe até o
        // conteúdo, que era o motivo dos cartões saírem desalinhados só na imagem exportada.
        card.style.height = p.height + 'px';
        card._prevStyle = prev;
    });
    return () => {
        if (prevGridStyle == null) grid.removeAttribute('style'); else grid.setAttribute('style', prevGridStyle);
        cards.forEach(card => {
            if (card._prevStyle == null) card.removeAttribute('style'); else card.setAttribute('style', card._prevStyle);
            delete card._prevStyle;
        });
    };
}

function exportPendImage() {
    const btn = document.getElementById('pend-export');
    const target = document.getElementById('pend-shot');
    if (!target) return;
    const grid = target.querySelector('.pend-grid');
    const label = btn.textContent;
    btn.textContent = '⏳ Gerando...';
    btn.disabled = true;
    const unfreeze = grid ? freezeGridForCapture(grid) : null;
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
        if (unfreeze) unfreeze();
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
    <div class="ph">Considera toda a base carregada a partir de abril/2026 — exceto "Cenário SLA" e "Carteira/Categoria", que contam desde janeiro/2026 — independente dos filtros de Período/Tipo/Comprador · exclui Canceladas, Devolvidas e itens marcados como "Remover de Compras Ágeis" · passe o mouse no título de cada cartão para ver o critério exato.</div>
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
