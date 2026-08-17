// ===== Aba Contratualização — Carteira × Tipo =====
// Motor único, compartilhado pelos dois painéis (Ágeis e Terminais). O que muda entre eles é só a
// "gerência alvo" (GERENCIA_ALVO / GER_ALVO_LABEL, derivados de data-painel no <body> — ver
// js/config.js): é a Gerência Final cujas RCs a Gestão à Vista carregada na página cobre, e por isso
// a única que pode ter carteira resolvida/validada contra ela. As demais Gerências Finais entram só
// nos gráficos por Coordenação; a própria gerência alvo sai de lá, para não repetir o gráfico
// dedicado "% Contrato × Spot por carteira G/R/S".
// Depende de: kpi/fmtDia (render.js ou render_setor.js), mkChart/stackPctLabels/crosshair/noG/soG/
// upgradeHeaders (charts.js), mode/nrm/normRC/normPed/splitPedidos/periodHit/tpHit/isoWeek/wkLabel
// (data.js) e CARTEIRAS/ALL/STATE/SUM (state.js).

// Carregamento do 2º arquivo (base de Carteiras / Spend), fonte principal desta aba. Mora aqui, e não
// em main.js/main_setor.js, porque o fluxo é idêntico nos dois painéis — aqueles cuidam só da base
// Gestão à Vista. A guarda no getElementById deixa o arquivo inerte numa página sem a aba.
function loadCarteirasFile(file) {
    if (!file) return;
    const rd = new FileReader();
    rd.onload = () => {
        const st = document.getElementById('cart_status');
        try {
            const rows = fromCarteirasCSV(rd.result);
            const n = rows.length;
            if (!n) throw new Error('nenhuma linha reconhecida (confira as colunas Requisição de compra/Car)');
            CARTEIRAS = rows;
            st.textContent = n.toLocaleString('pt-BR') + ' linhas do Spend carregadas de ' + file.name;
            st.style.color = '';
            render();
        } catch (err) {
            st.textContent = 'Falha ao ler o CSV (' + err.message + ').';
            st.style.color = '#C0272D';
        }
    };
    rd.onerror = () => { document.getElementById('cart_status').textContent = 'Erro ao abrir o arquivo.'; };
    rd.readAsText(file, 'UTF-8');
}
const cartFileInput = document.getElementById('f_cart');
if (cartFileInput) cartFileInput.onchange = e => loadCarteirasFile(e.target.files[0]);

function renderContr() {
    const CCON = '#003865';
    const cartLoaded = CARTEIRAS.length > 0;
    const rootLetter = code => { const m = /^[A-Za-z]/.exec((code || '').trim()); return m ? m[0].toUpperCase() : ''; };

    // Caixa "Excluir RCs pendentes" — ligada antes da guarda de base carregada, senão marcá-la sem o
    // Spend em memória não teria efeito nenhum depois que o arquivo chegasse.
    const exclChk = document.getElementById('f_excl_pend');
    if (exclChk) {
        exclChk.checked = !!STATE.exclPend;
        exclChk.onchange = () => { STATE.exclPend = exclChk.checked; render(); };
    }
    const exclPend = !!STATE.exclPend;

    if (!cartLoaded) {
        document.getElementById('kpi-contr').classList.add('k3');
        kpi('kpi-contr', [{ l: 'Base de Carteiras / Spend', v: 'Não carregada', c: 'warn', n: 'Carregue o 2º arquivo (Spend) para calcular o mix Contrato × Spot' }]);
        document.getElementById('ins-contr').innerHTML = '<b>Carregue a base de carteiras (2º arquivo / Spend) para ver esta aba.</b>';
        SUM.contr = null;
        return;
    }

    // A partir daqui, só a gerência alvo — é a única com Gestão à Vista na página para cruzar/validar carteira
    const cartAlvo = CARTEIRAS.filter(ln => ln.gerFinalNorm === GERENCIA_ALVO);

    // ===== Índices da Gestão à Vista (base principal, ALL) para resolver/validar carteiras =====
    // Chave por Pedido: "Contrato SAP/ Pedido" pode trazer vários pedidos (barra, vírgula, ponto
    // e vírgula ou quebra de linha), cada um indexado. Chave por RC: só dígitos, sem zeros à
    // esquerda. NUNCA usa Item — o Item do Spend é item do PEDIDO, não o "Item RC" da Gestão à
    // Vista, então RC+Item nunca é usado para casar as duas bases nesta aba.
    const gvByPed = new Map(), gvByRC = new Map();
    ALL.forEach(r => {
        if (!r.ccd) return;
        const rcNorm = normRC(r.rc);
        if (rcNorm) {
            if (!gvByRC.has(rcNorm)) gvByRC.set(rcNorm, []);
            gvByRC.get(rcNorm).push({ ccd: r.ccd, tp: r.tp, cp: r.cp });
        }
        splitPedidos(r.ped).forEach(pn => {
            if (!gvByPed.has(pn)) gvByPed.set(pn, []);
            gvByPed.get(pn).push({ ccd: r.ccd, tp: r.tp, cp: r.cp });
        });
    });
    const summarize = arr => {
        if (!arr || !arr.length) return null;
        const ccds = [...new Set(arr.map(x => x.ccd))];
        return { unique: ccds.length === 1, ccd: ccds.length === 1 ? ccds[0] : null, tp: mode(arr.map(x => x.tp)), cp: mode(arr.map(x => x.cp)) };
    };
    // Ordem de resolução: 1) Pedido — só aceito quando TODAS as ocorrências apontam para a mesma
    // Carteira/Categoria; 2) Contrato básico — mesma regra, casado contra a mesma coluna "Contrato
    // SAP/ Pedido" da Gestão à Vista (gvByPed), usado quando o Pedido não resolveu sozinho; 3) RC —
    // só entra quando nem Pedido nem Contrato básico resolveram com segurança, e só é aceito quando
    // TODAS as linhas dessa RC na Gestão à Vista apontam para a mesma carteira. Nunca escolhe a
    // primeira ocorrência num conflito.
    function resolveCarteira(pedidoNorm, cbNorm, rcNorm) {
        const pedSum = summarize(gvByPed.get(pedidoNorm));
        if (pedSum && pedSum.unique) return { ...pedSum, method: 'Pedido', outcome: 'pedido_unique' };
        const cbSum = cbNorm && cbNorm !== pedidoNorm ? summarize(gvByPed.get(cbNorm)) : null;
        if (cbSum && cbSum.unique) return { ...cbSum, method: 'Contrato básico', outcome: 'pedido_unique' };
        if (pedSum || cbSum) {
            const rcSum = summarize(gvByRC.get(rcNorm));
            if (rcSum && rcSum.unique) return { ...rcSum, method: 'RC única', outcome: 'rc_unique' };
            return { ccd: null, tp: null, cp: null, method: 'Original', outcome: 'pedido_conflict' };
        }
        const rcSum = summarize(gvByRC.get(rcNorm));
        if (rcSum) return rcSum.unique ? { ...rcSum, method: 'RC única', outcome: 'rc_unique' } : { ccd: null, tp: null, cp: null, method: 'Original', outcome: 'rc_ambiguous' };
        return { ccd: null, tp: null, cp: null, method: 'Não encontrado', outcome: 'no_match' };
    }
    // Status de auditoria do eixo Contrato×Spot — não substitui a classificação original do Spend,
    // só compara contra o que a Gestão à Vista indica para a mesma Carteira/Categoria resolvida.
    const tipoStatus = (tdSpend, res) => {
        if (res.outcome === 'pedido_conflict') return 'Pedido conflitante';
        if (res.outcome === 'rc_ambiguous') return 'RC ambígua';
        if (res.outcome === 'no_match') return 'Sem correspondência na Gestão';
        if (!tdSpend || tdSpend === 'N/D' || !res.tp || res.tp === 'Outros') return 'Informação insuficiente';
        if (tdSpend === 'Contrato' && res.tp === 'Contrato') return 'Contrato validado';
        if (tdSpend === 'Spot' && res.tp === 'Spot') return 'Spot validado';
        if (tdSpend === 'Contrato' && res.tp === 'Spot') return 'Spend Contrato x Gestão Spot';
        if (tdSpend === 'Spot' && res.tp === 'Contrato') return 'Spend Spot x Gestão Contrato';
        return 'Informação insuficiente';
    };

    // ===== Reclassificação de Car por linha do Spend =====
    // "A..." (Grupo Comprador, não classificado): tenta resolver por Pedido, depois por Contrato
    // básico, depois por RC única; sem resolução segura mantém o código "A..." original. "G/S/R":
    // nunca reclassifica — a Gestão à Vista só valida (marca "Divergente" quando os códigos não batem).
    const resolvedLines = cartAlvo.map(ln => {
        const root = rootLetter(ln.car);
        const res = resolveCarteira(ln.pedidoNorm, ln.cbNorm, ln.rcNorm);
        let carFinal, statusCarteira;
        if (root === 'A') {
            if (res.outcome === 'pedido_unique') { carFinal = res.ccd; statusCarteira = 'Resolvido por Pedido'; }
            else if (res.outcome === 'rc_unique') { carFinal = res.ccd; statusCarteira = 'Resolvido por RC única'; }
            else if (res.outcome === 'pedido_conflict') { carFinal = ln.car; statusCarteira = 'Pedido conflitante'; }
            else if (res.outcome === 'rc_ambiguous') { carFinal = ln.car; statusCarteira = 'RC ambígua'; }
            else { carFinal = ln.car; statusCarteira = 'A não resolvido'; }
        } else if (root === 'G' || root === 'S' || root === 'R') {
            carFinal = ln.car;
            if (res.outcome === 'pedido_unique' || res.outcome === 'rc_unique') statusCarteira = res.ccd === ln.car ? 'Mantido e validado' : 'Divergente';
            else if (res.outcome === 'pedido_conflict') statusCarteira = 'Pedido conflitante';
            else if (res.outcome === 'rc_ambiguous') statusCarteira = 'RC ambígua';
            else statusCarteira = 'RC não encontrada';
        } else {
            carFinal = ln.car || '';
            statusCarteira = 'Informação insuficiente';
        }
        return { ...ln, root, carFinal, statusCarteira, statusTipo: tipoStatus(ln.td, res), carEncontrado: res.ccd || '', compradorEncontrado: res.cp || '', metodoConexao: res.method };
    });

    // ===== Rollup por RC — consolida as linhas do Spend sem duplicar contagens/valores =====
    const byRC = {};
    resolvedLines.forEach(ln => { if (!ln.rcNorm) return; (byRC[ln.rcNorm] = byRC[ln.rcNorm] || []).push(ln); });
    const rcRows = Object.keys(byRC).map(rcNorm => {
        const lines = byRC[rcNorm];
        const carFinals = [...new Set(lines.map(l => (l.carFinal || '').trim()).filter(Boolean))];
        // Ambígua tanto quando os próprios itens da RC apontam para carteiras finais diferentes,
        // quanto quando a resolução por RC (fallback) encontrou mais de uma carteira na Gestão à Vista
        const rcAmbigua = carFinals.length > 1 || lines.some(l => l.statusCarteira === 'RC ambígua');
        const car = rcAmbigua ? '' : (carFinals[0] || '');
        const hasCon = lines.some(l => l.td === 'Contrato'), hasSpo = lines.some(l => l.td === 'Spot');
        // Regra explícita: RC com itens de Contrato E Spot vira "Mista" — nunca usa a 1ª ocorrência
        const td = hasCon && hasSpo ? 'Mista' : hasCon ? 'Contrato' : hasSpo ? 'Spot' : (mode(lines.map(l => l.td)) || 'N/D');
        let dt = null;
        lines.forEach(l => { if (l.dt && (!dt || l.dt < dt)) dt = l.dt; });
        const pedido = [...new Set(lines.map(l => l.pedido).filter(Boolean))].join(', ');
        const cb = [...new Set(lines.map(l => l.cb).filter(Boolean))].join(', ');
        return {
            rc: lines[0].rc, rcNorm, car, rcAmbigua, td, dt, it: lines.length, pedido, cb,
            matN: lines.reduce((a, l) => a + (l.ms === 'Material' ? 1 : 0), 0),
            servN: lines.reduce((a, l) => a + (l.ms === 'Serviço' ? 1 : 0), 0),
            semCarteira: !rcAmbigua && !car,
            anyDivergente: lines.some(l => l.statusCarteira === 'Divergente'),
            anyPedidoConflitante: lines.some(l => l.statusCarteira === 'Pedido conflitante'),
            anyANaoResolvido: lines.some(l => l.statusCarteira === 'A não resolvido'),
            anyAResolved: lines.some(l => l.statusCarteira === 'Resolvido por Pedido' || l.statusCarteira === 'Resolvido por RC única')
        };
    });

    // ===== RCs pendentes por Grupo Comprador (Sistema) — conjunto de exclusão opcional =====
    // Pendente = RC cujo código de carteira continua "A..." (Grupo Comprador do Sistema) depois da
    // resolução. Na gerência alvo usa a carteira consolidada da RC (rcRows.car, mesmo critério da
    // tabela informativa t_gcs mais abaixo); nas outras Gerências Finais não existe Gestão à Vista
    // nesta página para resolver, então o próprio "A..." do Spend é o critério.
    // Varre o ARQUIVO INTEIRO, sem recorte de Período/Tipo/Carteira: é isso que "excluir de todo o
    // arquivo" significa — a RC sai de todos os gráficos, KPIs e tabelas da aba em qualquer recorte,
    // inclusive dos gráficos por Coordenação, e não só do mês/semana em tela.
    const pendRCSet = new Set();
    rcRows.forEach(r => { if (r.rcNorm && rootLetter(r.car) === 'A') pendRCSet.add(r.rcNorm); });
    CARTEIRAS.forEach(ln => { if (ln.rcNorm && ln.gerFinalNorm !== GERENCIA_ALVO && rootLetter(ln.car) === 'A') pendRCSet.add(ln.rcNorm); });
    const keepRC = r => !exclPend || !pendRCSet.has(r.rcNorm);

    // Distribuição histórica de carteiras por Grupo Comprador (Sistema) — usada só pelo painel
    // informativo e para fracionar (só analítico) RCs "A..." ainda não resolvidas no gráfico por carteira G
    const gcsDist = {};
    ALL.forEach(r => {
        if (!r.gcs || !r.ccd) return;
        const d = gcsDist[r.gcs] = gcsDist[r.gcs] || {};
        d[r.ccd] = (d[r.ccd] || 0) + 1;
    });

    // Recorte: respeita Período e Tipo de compra do painel lateral; a base de Carteiras/Spend não
    // tem Comprador Responsável nem Status RC (Status de Liberação é outro conceito), então nenhum
    // dos dois filtros se aplica aqui. Carteira também respeita o filtro lateral, mas contra r.car
    // (rcRows, resolvido/Spend) — não r.ccd (ALL/ALLRC), daí não usar carHit aqui.
    // baseAll é o recorte antes da exclusão de pendentes; a tabela t_gcs sai dele, para continuar
    // listando as RCs pendentes mesmo quando a caixa de exclusão está marcada.
    const inRecorte = r => r.dt && r.dt >= DATA_INI_AGING && periodHit(r.dt) && tpHit(r) && (STATE.car === 'GERAL' || r.car === STATE.car);
    const baseAll = rcRows.filter(inRecorte);
    const base = exclPend ? baseAll.filter(keepRC) : baseAll;
    const carOf = r => r.car || '';
    const typeOf = r => r.td || 'N/D';
    const baseRCSet = new Set(base.map(r => r.rcNorm));

    const typeCounts = {};
    base.forEach(r => { const t = typeOf(r); typeCounts[t] = (typeCounts[t] || 0) + 1; });
    const nCon = typeCounts['Contrato'] || 0, nSpo = typeCounts['Spot'] || 0, nMista = typeCounts['Mista'] || 0, nOut = base.length - nCon - nSpo - nMista;
    const pctCon = base.length ? nCon / base.length * 100 : 0, pctSpo = base.length ? nSpo / base.length * 100 : 0;

    const matSum = base.reduce((a, r) => a + r.matN, 0), servSum = base.reduce((a, r) => a + r.servN, 0), totMS = matSum + servSum;
    const divergCount = base.filter(r => r.anyDivergente).length;
    const aResolvidoCount = base.filter(r => r.anyAResolved).length;
    const aNaoResolvidoCount = base.filter(r => r.anyANaoResolvido).length;
    const pedidoConflitanteCount = base.filter(r => r.anyPedidoConflitante).length;
    const rcAmbiguaCount = base.filter(r => r.rcAmbigua).length;

    // Contagem por item (linha do Spend), não por RC — só nos 2 cartões abaixo; RC com várias
    // linhas de Contrato/Spot conta cada linha. Não mexe em nCon/nSpo/pctCon/pctSpo (RC única),
    // que seguem alimentando os gráficos de mix, evolução e o doughnut mais abaixo.
    let nConItens = 0, nSpoItens = 0, itensTot = 0;
    cartAlvo.forEach(it => {
        if (!baseRCSet.has(it.rcNorm)) return;
        itensTot++;
        if (it.td === 'Contrato') nConItens++;
        else if (it.td === 'Spot') nSpoItens++;
    });
    const pctConItens = itensTot ? nConItens / itensTot * 100 : 0, pctSpoItens = itensTot ? nSpoItens / itensTot * 100 : 0;

    const kpiContr = [
        { l: 'RCs Contrato', v: nConItens.toLocaleString('pt-BR'), n: pctConItens.toFixed(0) + '% do recorte (itens)' },
        { l: 'RCs Spot', v: nSpoItens.toLocaleString('pt-BR'), n: pctSpoItens.toFixed(0) + '% do recorte (itens)' },
        { l: 'Material', v: totMS ? Math.round(matSum / totMS * 100) + '%' : '—', n: matSum.toLocaleString('pt-BR') + ' itens' },
        { l: 'Serviço', v: totMS ? Math.round(servSum / totMS * 100) + '%' : '—', n: servSum.toLocaleString('pt-BR') + ' itens' },
        { l: 'Códigos "A" resolvidos', v: aResolvidoCount.toLocaleString('pt-BR') + ' RCs', c: 'good', n: 'Por Pedido ou por RC única' },
        { l: 'Códigos "A" não resolvidos', v: aNaoResolvidoCount.toLocaleString('pt-BR') + ' RCs', c: aNaoResolvidoCount > 0 ? 'warn' : 'good', n: exclPend ? 'Excluídas do recorte pela caixa "Excluir RCs pendentes"' : 'Sem correspondência segura na Gestão à Vista' }
    ];

    document.getElementById('kpi-contr').classList.remove('k3');
    kpi('kpi-contr', kpiContr);

    // Volumetria dos gráficos de % Contrato × Spot: o tooltip abre a contagem que originou o
    // percentual (numerador) e o total da coluna (denominador) — "un" muda porque os gráficos por
    // RC contam RCs e os de Material/Serviço contam itens do Spend.
    const volTooltip = (un, totalsFn) => ({
        callbacks: {
            label: c => {
                const n = c.dataset.vol && c.dataset.vol[c.dataIndex];
                const pct = c.dataset.label + ': ' + c.parsed.y + '%';
                return typeof n === 'number' ? pct + ' · ' + Math.round(n).toLocaleString('pt-BR') + ' ' + un : pct;
            },
            footer: items => {
                const t = items && items.length ? totalsFn(items[0].dataIndex) : 0;
                return t ? 'Total: ' + Math.round(t).toLocaleString('pt-BR') + ' ' + un : '';
            }
        }
    });

    // Contrato × Spot — Geral: soma de todas as carteiras, uma coluna 100% empilhada (c_contrmix)
    const conSpoTot = nCon + nSpo;
    const mixConPct = conSpoTot ? Math.round(nCon / conSpoTot * 100) : 0;
    const mixSpoPct = conSpoTot ? 100 - mixConPct : 0;
    mkChart('c_contrmix', { type: 'bar', plugins: [stackPctLabels], data: { labels: ['Geral'], volTotals: [conSpoTot], datasets: [{ label: 'Contrato', data: [mixConPct], vol: [nCon], backgroundColor: CCON, stack: 's' }, { label: 'Spot', data: [mixSpoPct], vol: [nSpo], backgroundColor: C.steel, stack: 's' }] }, options: { maintainAspectRatio: false, plugins: { legend: { position: 'top', labels: { boxWidth: 11, usePointStyle: true, font: { size: 10 } } }, tooltip: volTooltip('RCs', () => conSpoTot) }, scales: { x: { stacked: true, ...noG }, y: { stacked: true, ...soG, min: 0, max: 100, ticks: { callback: v => v + '%' } } } } });

    // Contrato × Spot — Material e Serviço: mesma coluna 100% empilhada, cada uma só com os itens da classe (c_contrmix_mat/serv)
    const msMix = { Material: { Contrato: 0, Spot: 0 }, Serviço: { Contrato: 0, Spot: 0 } };
    cartAlvo.forEach(it => {
        if (!baseRCSet.has(it.rcNorm) || (it.ms !== 'Material' && it.ms !== 'Serviço')) return;
        if (it.td === 'Contrato') msMix[it.ms].Contrato++;
        else if (it.td === 'Spot') msMix[it.ms].Spot++;
    });
    const mkMixChart = (id, counts, tot) => {
        const conPct = tot ? Math.round(counts.Contrato / tot * 100) : 0, spoPct = tot ? 100 - conPct : 0;
        mkChart(id, { type: 'bar', plugins: [stackPctLabels], data: { labels: ['Geral'], volTotals: [tot], datasets: [{ label: 'Contrato', data: [conPct], vol: [counts.Contrato], backgroundColor: CCON, stack: 's' }, { label: 'Spot', data: [spoPct], vol: [counts.Spot], backgroundColor: C.steel, stack: 's' }] }, options: { maintainAspectRatio: false, plugins: { legend: { position: 'top', labels: { boxWidth: 11, usePointStyle: true, font: { size: 10 } } }, tooltip: volTooltip('itens', () => tot) }, scales: { x: { stacked: true, ...noG }, y: { stacked: true, ...soG, min: 0, max: 100, ticks: { callback: v => v + '%' } } } } });
    };
    mkMixChart('c_contrmix_mat', msMix.Material, msMix.Material.Contrato + msMix.Material.Spot);
    mkMixChart('c_contrmix_serv', msMix.Serviço, msMix.Serviço.Contrato + msMix.Serviço.Spot);

    // Contrato, Spot e Mista como tipos principais + demais tipos individualmente (não agrupados em "Outros")
    const typesOther = Object.keys(typeCounts).filter(t => t !== 'Contrato' && t !== 'Spot' && t !== 'Mista').sort((a, b) => a === 'N/D' ? 1 : b === 'N/D' ? -1 : typeCounts[b] - typeCounts[a]);
    const typeList = ['Contrato', 'Spot', 'Mista', ...typesOther];

    // RCs por Código de Carteira — G/S/R/A e Ambígua (c_ccd) — raiz da carteira final da RC.
    // "Ambígua" (itens da própria RC apontam para carteiras diferentes) fica separada de "A" (Grupo
    // Comprador ainda não resolvido) e de "N/D" (sem Car preenchido) — são alertas distintos.
    const cdOrder = ['G', 'S', 'R', 'A', 'AMB'];
    const ALLOWED_CD = ['G', 'S', 'R', 'A', 'AMB', 'N/D'];
    const cdOf = r => { if (r.rcAmbigua) return 'AMB'; const c = rootLetter(carOf(r)) || 'N/D'; return ALLOWED_CD.includes(c) ? c : 'A'; };
    const cdLabel = k => k === 'AMB' ? 'Ambígua' : k;
    const byCd = {};
    base.forEach(r => { const c = cdOf(r); byCd[c] = (byCd[c] || 0) + 1; });
    const cdKeys = Object.keys(byCd).sort((a, b) => { const ia = cdOrder.indexOf(a), ib = cdOrder.indexOf(b); if (ia > -1 && ib > -1) return ia - ib; if (ia > -1) return -1; if (ib > -1) return 1; if (a === 'N/D') return 1; if (b === 'N/D') return -1; return a.localeCompare(b); });
    const cdCOL = k => k === 'G' ? '#1E9F7F' : k === 'S' ? '#0E538C' : k === 'R' ? '#D9A400' : k === 'A' ? C.red : k === 'AMB' ? '#8C1419' : k === 'N/D' ? '#9AACB5' : C.red;
    mkChart('c_ccd', { type: 'bar', data: { labels: cdKeys.map(cdLabel), datasets: [{ data: cdKeys.map(k => byCd[k]), backgroundColor: cdKeys.map(cdCOL), borderRadius: 18 }] }, options: { maintainAspectRatio: false, layout: { padding: { top: 16 } }, plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => c.parsed.y.toLocaleString('pt-BR') + ' RCs' } } }, scales: { x: noG, y: { ...soG, beginAtZero: true } } } });

    // % Contrato × Spot por carteira G/R/S — 100% empilhado, uma coluna por carteira específica
    // (c_ccd_tipo), ordem G > R > S e numérica dentro de cada letra (ver sort de gCarArr abaixo).
    // Só RCs com carteira G/R/S já confirmada no Spend — os "A..." (Grupo Comprador, sem
    // Carteira/Categoria resolvida) saíram daqui e viraram o gráfico separado "A (raiz)"
    // (c_ccd_tipo_araiz, amarelo), fracionados por G via histórico da Gestão à Vista.
    const ROOT_PRIO = { G: 0, R: 1, S: 2 };
    // Só Contrato/Spot entram nesses dois gráficos — a coluna Contrato×Spot do Spend não tem outro
    // valor válido, então RC/linha sem um dos dois (ex.: "Mista", item de RC com os dois tipos) não conta.
    const buildGCarStats = (items, getType, getCode) => {
        const byGCar = {}, byGCarA = {};
        items.forEach(r => {
            const t = getType(r);
            if (t !== 'Contrato' && t !== 'Spot') return;
            const code = getCode(r);
            if (ROOT_PRIO[rootLetter(code)] !== undefined) {
                const o = byGCar[code] = byGCar[code] || {};
                o[t] = (o[t] || 0) + 1;
                return;
            }
            const dist = gcsDist[code];
            if (!dist) return;
            const gEntries = Object.entries(dist).filter(([c]) => rootLetter(c) === 'G');
            const gTotal = gEntries.reduce((a, [, n]) => a + n, 0);
            if (!gTotal) return;
            gEntries.forEach(([c, n]) => {
                const o = byGCarA[c] = byGCarA[c] || {};
                o[t] = (o[t] || 0) + n / gTotal;
            });
        });
        return { byGCar, byGCarA };
    };
    // "Por Requisição" — comportamento original, uma RC (já deduplicada) conta 1x. "Por Linha" —
    // cada linha do Spend conta 1x (usa resolvedLines, que já tem a carteira resolvida por linha),
    // restrita ao mesmo recorte de RCs de "base" via baseRCSet. Alterna pelo botão no painel (STATE.ccdTipoMode).
    const { byGCar, byGCarA } = STATE.ccdTipoMode === 'linha'
        ? buildGCarStats(resolvedLines.filter(ln => baseRCSet.has(ln.rcNorm)), ln => ln.td, ln => ln.carFinal || '')
        : buildGCarStats(base, typeOf, carOf);
    const typeListG = ['Contrato', 'Spot'];
    const colorMapG = { Contrato: CCON, Spot: C.steel };
    const gCarArr = Object.entries(byGCar).map(([c, o]) => ({ c, o, tot: Object.values(o).reduce((a, v) => a + v, 0) })).sort((a, b) => {
        const ra = ROOT_PRIO[rootLetter(a.c)], rb = ROOT_PRIO[rootLetter(b.c)];
        if (ra !== rb) return ra - rb;
        const na = parseInt(a.c.slice(1), 10), nb = parseInt(b.c.slice(1), 10);
        if (!isNaN(na) && !isNaN(nb) && na !== nb) return na - nb;
        return a.c.localeCompare(b.c);
    });
    const gCarKeys = gCarArr.map(x => x.c);
    // largura mínima por coluna pra caber o rótulo "100%" sem sobrepor a coluna vizinha — com 40+
    // carteiras G, coluna fixa vira ilegível, então aqui vira scroll horizontal (ver .cv-scroll)
    const ccdTipoCv = document.getElementById('c_ccd_tipo_cv');
    if (ccdTipoCv) ccdTipoCv.style.minWidth = Math.max(gCarKeys.length * 42, 1) + 'px';
    const ccdTipoUn = STATE.ccdTipoMode === 'linha' ? 'itens' : 'RCs';
    // Pré-seleciona STATE.cartTbl (se ainda não houver escolha) com a 1ª carteira do escopo, mesmo
    // critério do fillCarOpts do painel "Consulta por carteira" mais abaixo — sem isso, no 1º render
    // da página o destaque desta coluna e a linha da tabela "Base detalhada — Carteira × Tipo" só
    // apareceriam depois da 1ª interação do usuário (o painel abaixo é quem normalmente define
    // STATE.cartTbl, mas ele roda depois deste gráfico no mesmo render).
    if (!STATE.cartTbl) {
        const scopeCars = CARTEIRAS.filter(ln => ln.dt && ln.dt >= DATA_INI_AGING && periodHit(ln.dt) && tpHit(ln) && (STATE.car === 'GERAL' || ln.car === STATE.car) && keepRC(ln) && (STATE.cartTblGer === 'alvo' ? ln.gerFinalNorm === GERENCIA_ALVO : true)).map(ln => (ln.car || '').trim()).filter(Boolean);
        STATE.cartTbl = [...new Set(scopeCars)].sort((a, b) => a.localeCompare(b, 'pt-BR'))[0] || '';
    }
    // Coluna da carteira selecionada (STATE.cartTbl, mesma seleção da tabela "Consulta por carteira"
    // e de "Base detalhada — Carteira × Tipo" abaixo) ganha borda pra destacar a seleção em comum;
    // clicar numa coluna também seleciona a carteira, do mesmo jeito que o dropdown.
    mkChart('c_ccd_tipo', { type: 'bar', plugins: [stackPctLabels], data: { labels: gCarKeys, volTotals: gCarArr.map(x => x.tot), datasets: typeListG.map(t => ({ label: t, data: gCarArr.map(x => x.tot ? Math.round((x.o[t] || 0) / x.tot * 100) : 0), vol: gCarArr.map(x => x.o[t] || 0), backgroundColor: colorMapG[t], borderColor: gCarKeys.map(c => c === STATE.cartTbl ? '#13303F' : 'transparent'), borderWidth: gCarKeys.map(c => c === STATE.cartTbl ? 2 : 0), stack: 's' })) }, options: { maintainAspectRatio: false, onClick: (evt, els) => { if (els.length) { const car = gCarKeys[els[0].index]; if (car) { STATE.cartTbl = car; render(); } } }, onHover: (evt, els) => { evt.native.target.style.cursor = els.length ? 'pointer' : 'default'; }, plugins: { legend: { position: 'top', labels: { boxWidth: 11, usePointStyle: true, font: { size: 10 } } }, tooltip: volTooltip(ccdTipoUn, i => gCarArr[i] && gCarArr[i].tot) }, scales: { x: { stacked: true, ...noG, ticks: { font: { size: 9 }, maxRotation: 45, minRotation: 35 } }, y: { stacked: true, ...soG, min: 0, max: 100, ticks: { callback: v => v + '%' } } } } });

    // Botões "Por Linha" / "Por Requisição" — troca STATE.ccdTipoMode e re-renderiza (o próprio
    // gráfico "A (raiz)" abaixo usa a mesma fonte, então acompanha o toggle junto)
    document.querySelectorAll('#ccdTipoModeSeg button').forEach(b => {
        b.classList.toggle('active', b.dataset.mode === STATE.ccdTipoMode);
        b.onclick = () => { STATE.ccdTipoMode = b.dataset.mode; render(); };
    });

    // % Contrato × Spot por carteira, uma coluna de gráficos por Coordenação (c_ger_N, dinâmico).
    // Rollup por RC direto do Spend (Car + Contrato/Spot do próprio RC — RC com item de Contrato E
    // Spot ao mesmo tempo, ou nenhum dos dois, fica fora do gráfico, ver filtro abaixo), sem
    // cruzar com a Gestão à Vista. A coluna "Coordenação" do Spend já traz a gerência principal
    // resolvida por RC — inclui as RCs da gerência alvo já atribuídas à Coordenação correta, então
    // aqui só agrupa, sem precisar somar/mesclar com a gerência alvo à parte. Mostra todas as
    // carteiras que aparecerem na Coordenação (sem filtro de lista fixa), ordenadas G > R > S e
    // numérica dentro de cada letra (mesmo critério de gCarArr acima).
    // Carteira do filtro lateral também se aplica aqui — contra ln.car (Spend), mesmo espaço de
    // código de r.ccd (ALL/ALLRC), mas campo diferente, por isso não reaproveita carHit.
    const carBase = CARTEIRAS.filter(ln => ln.dt && ln.dt >= DATA_INI_AGING && periodHit(ln.dt) && tpHit(ln) && (STATE.car === 'GERAL' || ln.car === STATE.car) && keepRC(ln));
    const byRCAll = {};
    carBase.forEach(ln => { if (!ln.rcNorm) return; (byRCAll[ln.rcNorm] = byRCAll[ln.rcNorm] || []).push(ln); });
    const coordCarStats = {};
    const coordRCSet = {};
    Object.values(byRCAll).forEach(lines => {
        const hasCon = lines.some(l => l.td === 'Contrato'), hasSpo = lines.some(l => l.td === 'Spot');
        const coord = mode(lines.map(l => l.coord)) || 'N/D';
        (coordRCSet[coord] = coordRCSet[coord] || new Set()).add(lines[0].rcNorm);
        // Só Contrato/Spot entram no gráfico — a coluna Contrato×Spot do Spend não tem outro valor
        // válido, então RC com os dois tipos misturados (ou nenhum) não conta aqui.
        if (hasCon === hasSpo) return;
        const td = hasCon ? 'Contrato' : 'Spot';
        const car = mode(lines.map(l => l.car)) || 'N/D';
        const cc = coordCarStats[coord] = coordCarStats[coord] || {};
        const o = cc[car] = cc[car] || { Contrato: 0, Spot: 0 };
        o[td]++;
    });
    const GER_TYPE_COLORS = { Contrato: '#0F6B4C', Spot: '#8FD9BE' };
    const sortCarKeys = (a, b) => {
        if (a.c === 'N/D' || b.c === 'N/D') return a.c === b.c ? 0 : a.c === 'N/D' ? 1 : -1;
        const ra = ROOT_PRIO[rootLetter(a.c)], rb = ROOT_PRIO[rootLetter(b.c)];
        const pa = ra !== undefined ? ra : 3, pb = rb !== undefined ? rb : 3;
        if (pa !== pb) return pa - pb;
        if (pa === 3) return a.c.localeCompare(b.c);
        const na = parseInt(a.c.slice(1), 10), nb = parseInt(b.c.slice(1), 10);
        if (!isNaN(na) && !isNaN(nb) && na !== nb) return na - nb;
        return a.c.localeCompare(b.c);
    };
    // A gerência alvo da página sai daqui — já tem gráfico dedicado acima (c_ccd_tipo, "por carteira
    // G/R/S"), sem sentido repetir a mesma Coordenação nesta lista. No painel Terminais isso quer
    // dizer que "Terminais" sai e "Compras Ágeis" fica; no painel Ágeis, o contrário.
    const coordList = Object.entries(coordRCSet).filter(([g]) => nrm(g) !== GERENCIA_ALVO).sort((a, b) => b[1].size - a[1].size).map(x => x[0]);
    const gerCharts = coordList.map((g, gi) => {
        const cars = coordCarStats[g] || {};
        const carKeys = Object.entries(cars).map(([c, o]) => ({ c, o, tot: o.Contrato + o.Spot })).filter(k => k.tot > 0).sort(sortCarKeys);
        return { g, cid: 'c_ger_' + gi, carKeys };
    }).filter(x => x.carKeys.length);

    // Painel "A (raiz)" — mesma estimativa fracionada por G do gráfico principal (byGCarA acima),
    // mas com o Contrato/Spot já conhecido de cada RC (não é estimado, só a carteira G é que é
    // estimada) — entra no mesmo grid das outras Gerências, em amarelo, pra não competir visualmente
    // com o gráfico confirmado por carteira G. Com a exclusão de pendentes ligada ele fica vazio (as
    // RCs que o alimentam são justamente as pendentes) e o painel simplesmente não aparece.
    const ARAIZ_COLORS = { Contrato: '#9C7A00', Spot: '#F2D479' };
    const gCarAArr = Object.entries(byGCarA).map(([c, o]) => ({ c, o, tot: Object.values(o).reduce((a, v) => a + v, 0) })).sort((a, b) => b.tot - a.tot);
    const araizPanel = gCarAArr.length ? { cid: 'c_ccd_tipo_araiz', carArr: gCarAArr } : null;

    document.getElementById('gerfinal-charts').innerHTML = gerCharts.map(x => `<div class="panel" style="margin-bottom:0">
<h3>% Contrato × Spot por carteira — ${x.g}</h3>
<div class="ph">RCs desta Coordenação (já inclui ${GER_ALVO_LABEL}, atribuído pela coluna Coordenação do Spend), consolidadas por código de carteira · número acima da coluna é o total de RCs que gera o %, e o número dentro de cada faixa é a contagem daquela faixa</div>
<div class="cv-scroll"><div class="cv" id="${x.cid}_cv"><canvas id="${x.cid}"></canvas></div></div>
</div>`).join('') + (araizPanel ? `<div class="panel" style="margin-bottom:0">
<h3>% Contrato × Spot — A (raiz), estimado</h3>
<div class="ph">Carteira G estimada pelo histórico da Gestão à Vista para RCs ainda em Grupo Comprador "A..." (não resolvidas) — Contrato × Spot vem direto do Spend, só a coluna G é que é estimativa. Volumetria em RCs, também estimada (fracionada entre as carteiras G), por isso arredondada.</div>
<div class="cv-scroll"><div class="cv" id="${araizPanel.cid}_cv"><canvas id="${araizPanel.cid}"></canvas></div></div>
</div>` : '');
    upgradeHeaders();
    const setMinBarWidth = (cvId, nBars) => { const el = document.getElementById(cvId); if (el) el.style.minWidth = Math.max(nBars * 42, 1) + 'px'; };
    gerCharts.forEach(x => setMinBarWidth(x.cid + '_cv', x.carKeys.length));
    if (araizPanel) setMinBarWidth(araizPanel.cid + '_cv', araizPanel.carArr.length);
    gerCharts.forEach(x => {
        const types = ['Contrato', 'Spot'];
        mkChart(x.cid, { type: 'bar', plugins: [stackPctLabels], data: { labels: x.carKeys.map(k => k.c), volTotals: x.carKeys.map(k => k.tot), datasets: types.map(t => ({ label: t, data: x.carKeys.map(k => k.tot ? Math.round((k.o[t] || 0) / k.tot * 100) : 0), vol: x.carKeys.map(k => k.o[t] || 0), backgroundColor: GER_TYPE_COLORS[t], stack: 's' })) }, options: { maintainAspectRatio: false, plugins: { legend: { position: 'top', labels: { boxWidth: 11, usePointStyle: true, font: { size: 10 } } }, tooltip: volTooltip('RCs', i => x.carKeys[i] && x.carKeys[i].tot) }, scales: { x: { stacked: true, ...noG, ticks: { font: { size: 9 }, maxRotation: 45, minRotation: 35 } }, y: { stacked: true, ...soG, min: 0, max: 100, ticks: { callback: v => v + '%' } } } } });
    });
    if (araizPanel) {
        const types = ['Contrato', 'Spot'];
        mkChart(araizPanel.cid, { type: 'bar', plugins: [stackPctLabels], data: { labels: araizPanel.carArr.map(x => x.c), volTotals: araizPanel.carArr.map(x => x.tot), datasets: types.map(t => ({ label: t, data: araizPanel.carArr.map(x => x.tot ? Math.round((x.o[t] || 0) / x.tot * 100) : 0), vol: araizPanel.carArr.map(x => x.o[t] || 0), backgroundColor: ARAIZ_COLORS[t], stack: 's' })) }, options: { maintainAspectRatio: false, plugins: { legend: { position: 'top', labels: { boxWidth: 11, usePointStyle: true, font: { size: 10 } } }, tooltip: volTooltip('RCs', i => araizPanel.carArr[i] && araizPanel.carArr[i].tot) }, scales: { x: { stacked: true, ...noG, ticks: { font: { size: 9 }, maxRotation: 45, minRotation: 35 } }, y: { stacked: true, ...soG, min: 0, max: 100, ticks: { callback: v => v + '%' } } } } });
    }

    // ===== Consulta por carteira — Fornecedor / RC / Tipo / Pedido / Contrato (t_cart_forn) =====
    // Sai direto do Spend (carBase, todas as Gerências Finais, respeitando Período e Tipo de compra),
    // sem cruzar com a Gestão à Vista: o Spend não tem coluna de responsável, e "Nome Fornecedor" é a
    // coluna equivalente. Dedupe por RC + fornecedor + pedido + contrato básico — o Spend tem uma
    // linha por ITEM de pedido, então sem isso o mesmo pedido viraria dezenas de linhas iguais.
    // Carteiras grandes passam de 7 mil linhas, por isso a tabela mostra as CART_TBL_MAX primeiras
    // na ordenação escolhida e informa o total no rodapé do filtro.
    // A coluna Tipo é o Contrato/Spot do próprio Spend (td). Como a linha da tabela agrega vários
    // itens de pedido, ela pode juntar itens de tipos diferentes: nesse caso vira "Mista", mesmo
    // critério usado no resto da aba. O filtro Escopo troca entre todas as Gerências Finais e só a
    // gerência alvo da página — a lista de carteiras é remontada junto, para não sobrar carteira vazia.
    const CART_TBL_MAX = 500;
    const cartTblSel = document.getElementById('f_cart_tbl'), cartTblOrd = document.getElementById('f_cart_ord'), cartTblBody = document.querySelector('#t_cart_forn tbody');
    const cartTblGer = document.getElementById('f_cart_ger');
    // Base de "Base detalhada — Carteira × Tipo" (t_contr, montada mais abaixo, fora deste bloco) —
    // carteira × tipo agregados direto do Spend, sem cruzar com a Gestão à Vista, no mesmo Escopo
    // (Todas as Gerências Finais / Só a gerência alvo) desta tabela "Consulta por carteira".
    let byCatSpend = {};
    if (cartTblSel && cartTblOrd && cartTblBody) {
        const tipoDaLinha = set => { const t = [...set].filter(x => x && x !== 'N/D'); return !t.length ? 'N/D' : t.length === 1 ? t[0] : 'Mista'; };
        const TIPO_CLS = { Contrato: 't-con', Spot: 't-spot', Mista: 't-mix' };
        const byKey = new Map(), carNome = {};
        carBase.forEach(ln => {
            const car = (ln.car || '').trim();
            if (!car) return;
            if (ln.nome && !carNome[car]) carNome[car] = ln.nome;
            const k = car + '|' + ln.rcNorm + '|' + ln.forn + '|' + ln.pedido + '|' + ln.cb;
            let r = byKey.get(k);
            if (!r) { r = { car, forn: ln.forn || '', rc: ln.rc, rcNorm: ln.rcNorm, pedido: ln.pedido || '', cb: ln.cb || '', dt: null, alvo: false, tds: new Set() }; byKey.set(k, r); }
            r.tds.add(ln.td || 'N/D');
            if (ln.dt && (!r.dt || ln.dt < r.dt)) r.dt = ln.dt;
            if (ln.gerFinalNorm === GERENCIA_ALVO) r.alvo = true;
        });
        const allRows = [...byKey.values()];
        allRows.forEach(r => { r.tipo = tipoDaLinha(r.tds); });
        const byCar = { todas: {}, alvo: {} };
        allRows.forEach(r => {
            (byCar.todas[r.car] = byCar.todas[r.car] || []).push(r);
            if (r.alvo) (byCar.alvo[r.car] = byCar.alvo[r.car] || []).push(r);
        });
        if (cartTblGer) cartTblGer.value = STATE.cartTblGer === 'alvo' ? 'alvo' : 'todas';
        cartTblOrd.value = STATE.cartTblOrd || 'forn_asc';
        // fornecedor em branco vai sempre para o fim, nas duas direções — em cima só atrapalha a leitura
        const blankLast = (a, b) => (!a.forn !== !b.forn) ? (a.forn ? -1 : 1) : 0;
        const cmpRC = (a, b) => ('' + a.rcNorm).localeCompare('' + b.rcNorm, undefined, { numeric: true });
        const cmpForn = (a, b) => a.forn.localeCompare(b.forn, 'pt-BR') || cmpRC(a, b);
        const TIPO_PRIO = { Contrato: 0, Spot: 1, Mista: 2 };
        const prioTipo = t => TIPO_PRIO[t] !== undefined ? TIPO_PRIO[t] : 3;
        const ORD = {
            forn_asc: (a, b) => blankLast(a, b) || cmpForn(a, b),
            forn_desc: (a, b) => blankLast(a, b) || b.forn.localeCompare(a.forn, 'pt-BR') || cmpRC(a, b),
            rc_asc: cmpRC,
            rc_desc: (a, b) => cmpRC(b, a),
            tipo_asc: (a, b) => prioTipo(a.tipo) - prioTipo(b.tipo) || blankLast(a, b) || cmpForn(a, b)
        };
        // Lista de carteiras do escopo atual; mantém a carteira escolhida se ela existir nele
        const fillCarOpts = () => {
            const map = byCar[STATE.cartTblGer === 'alvo' ? 'alvo' : 'todas'];
            const carOpts = Object.keys(map).sort((a, b) => a.localeCompare(b, 'pt-BR'));
            const carSel = STATE.cartTbl && map[STATE.cartTbl] ? STATE.cartTbl : (carOpts[0] || '');
            STATE.cartTbl = carSel;
            cartTblSel.innerHTML = carOpts.length ? carOpts.map(c => `<option value="${c}"${c === carSel ? ' selected' : ''}>${c}${carNome[c] ? ' — ' + carNome[c] : ''}</option>`).join('') : '<option value="">Sem carteiras no recorte</option>';
            return map;
        };
        const drawCartTbl = () => {
            STATE.cartTblGer = cartTblGer ? cartTblGer.value : 'todas';
            STATE.cartTblOrd = cartTblOrd.value;
            if (cartTblSel.value) STATE.cartTbl = cartTblSel.value;
            const map = fillCarOpts();
            const rows = (map[STATE.cartTbl] || []).slice();
            rows.sort(ORD[STATE.cartTblOrd] || ORD.forn_asc);
            const shown = rows.slice(0, CART_TBL_MAX);
            cartTblBody.innerHTML = shown.map(r => `<tr><td>${r.forn || '—'}</td><td>${r.rc}</td><td><span class="tpill ${TIPO_CLS[r.tipo] || 't-nd'}">${r.tipo}</span></td><td>${r.pedido || '—'}</td><td>${r.cb || '—'}</td><td>${fmtDia(r.dt)}</td></tr>`).join('') || '<tr><td colspan="6" style="color:#46606F">Sem linhas para esta carteira no recorte.</td></tr>';
            const st = document.getElementById('cart_tbl_status');
            if (st) {
                const nRC = new Set(rows.map(r => r.rcNorm)).size, nForn = new Set(rows.filter(r => r.forn).map(r => r.forn)).size;
                const nCon = rows.filter(r => r.tipo === 'Contrato').length, nSpo = rows.filter(r => r.tipo === 'Spot').length;
                st.textContent = rows.length ? `${rows.length.toLocaleString('pt-BR')} linhas · ${nRC.toLocaleString('pt-BR')} RCs · ${nForn.toLocaleString('pt-BR')} fornecedores · ${nCon.toLocaleString('pt-BR')} Contrato / ${nSpo.toLocaleString('pt-BR')} Spot${rows.length > CART_TBL_MAX ? ` · mostrando as ${CART_TBL_MAX} primeiras nesta ordenação` : ''}` : 'Sem linhas neste escopo.';
            }
        };
        // Troca de carteira/escopo passa por render() completo (não só drawCartTbl) porque a seleção
        // (STATE.cartTbl) também dirige o destaque no gráfico acima e a linha única da tabela
        // "Base detalhada — Carteira × Tipo", mais abaixo neste mesmo render.
        cartTblSel.onchange = () => { STATE.cartTbl = cartTblSel.value; render(); };
        cartTblOrd.onchange = () => { STATE.cartTblOrd = cartTblOrd.value; render(); };
        if (cartTblGer) cartTblGer.onchange = () => { STATE.cartTblGer = cartTblGer.value; render(); };
        drawCartTbl();
        // Agrega byCar (já filtrado pelo Escopo escolhido) por carteira × tipo, pro t_contr — reaproveita
        // as mesmas linhas/Escopo desta tabela, sem nenhum cruzamento novo com a Gestão à Vista.
        const byCarScope = byCar[STATE.cartTblGer === 'alvo' ? 'alvo' : 'todas'];
        Object.keys(byCarScope).forEach(car => {
            const o = byCatSpend[car] = { Contrato: 0, Spot: 0, Mista: 0, Outros: 0 };
            byCarScope[car].forEach(r => { if (o[r.tipo] !== undefined) o[r.tipo]++; else o.Outros++; });
        });
    }

    // Carteira/Categoria por RC — só o código (G35, S12...); RC ambígua ganha rótulo próprio (não
    // se confunde com "N/D", que é falta de preenchimento) — mantido para a tabela detalhada e o
    // resumo usado na apresentação (os gráficos por carteira específica foram removidos)
    const catOf = r => r.rcAmbigua ? 'Ambígua' : (carOf(r) || 'N/D');
    const byCat = {};
    base.forEach(r => { const c = catOf(r); const t = typeOf(r); const o = byCat[c] = byCat[c] || {}; o[t] = (o[t] || 0) + 1; });
    const cats = Object.entries(byCat).map(([c, o]) => ({ c, o, tot: typeList.reduce((a, t) => a + (o[t] || 0), 0) })).sort((a, b) => b.tot - a.tot).slice(0, 15);
    const top8 = cats.slice(0, 8);

    // Evolução semanal — Contrato e Spot com série própria; Mista e demais tipos agregados em
    // "Outros tipos" (c_contrevol) — por semana da Data do Pedido
    const bw = {};
    base.forEach(r => { const w = isoWeek(r.dt); const o = bw[w] = bw[w] || { Contrato: 0, Spot: 0, Outros: 0 }; const t = typeOf(r); if (t === 'Contrato') o.Contrato++; else if (t === 'Spot') o.Spot++; else o.Outros++; });
    const wks = Object.keys(bw).sort();
    mkChart('c_contrevol', {
        type: 'line', plugins: [crosshair], data: {
            labels: wks.map(wkLabel), datasets:
                [
                    { label: 'Contrato', data: wks.map(w => bw[w].Contrato), borderColor: CCON, backgroundColor: 'rgba(0,56,101,.10)', fill: true, tension: .3, borderWidth: 2, pointRadius: 0, pointHoverRadius: 5, pointHoverBackgroundColor: CCON },
                    { label: 'Spot', data: wks.map(w => bw[w].Spot), borderColor: C.steel, backgroundColor: 'rgba(90,140,174,.14)', fill: true, tension: .3, borderWidth: 2, pointRadius: 0, pointHoverRadius: 5, pointHoverBackgroundColor: C.steel },
                    { label: 'Outros tipos', data: wks.map(w => bw[w].Outros), borderColor: '#7A8C97', backgroundColor: 'rgba(122,140,151,.10)', fill: true, tension: .3, borderWidth: 2, pointRadius: 0, pointHoverRadius: 5, pointHoverBackgroundColor: '#7A8C97', borderDash: [4, 3] }
                ]
        }, options: { maintainAspectRatio: false, interaction: { mode: 'index', intersect: false }, plugins: { legend: { position: 'top', labels: { boxWidth: 11, usePointStyle: true, font: { size: 10 } } }, tooltip: { mode: 'index', intersect: false, callbacks: { title: c => 'Semana de ' + c[0].label, label: c => c.dataset.label + ': ' + c.parsed.y.toLocaleString('pt-BR') + ' RCs' } } }, scales: { x: { ...noG, ticks: { maxTicksLimit: 13, font: { size: 8 } } }, y: { ...soG, beginAtZero: true } } }
    });

    // Tabela detalhada — Carteira x Tipo (t_contr) — direto do Spend (byCatSpend, montado acima junto
    // com "Consulta por carteira"), sem cruzar com a Gestão à Vista, no mesmo Escopo daquela tabela.
    // Amarrada à mesma carteira selecionada ali (STATE.cartTbl): mostra só a linha dessa carteira.
    document.querySelector('#t_contr thead').innerHTML = '<tr><th>Carteira/Categoria</th><th class="num">Contrato</th><th class="num">Spot</th><th class="num">Mista</th><th class="num">Total</th><th class="num">% Contrato</th></tr>';
    const selCar = STATE.cartTbl || '';
    const selCarRow = selCar ? byCatSpend[selCar] : null;
    if (selCarRow) {
        const selTot = selCarRow.Contrato + selCarRow.Spot + selCarRow.Mista + selCarRow.Outros;
        document.querySelector('#t_contr tbody').innerHTML = `<tr><td>${selCar}</td><td class="num">${selCarRow.Contrato}</td><td class="num">${selCarRow.Spot}</td><td class="num">${selCarRow.Mista}</td><td class="num">${selTot}</td><td class="num">${selTot ? Math.round(selCarRow.Contrato / selTot * 100) : 0}%</td></tr>`;
    } else {
        document.querySelector('#t_contr tbody').innerHTML = `<tr><td colspan="6" style="color:#46606F">${selCar ? `Nenhuma RC de "${selCar}" no recorte.` : 'Selecione uma carteira em "Consulta por carteira" para ver o detalhamento.'}</td></tr>`;
    }

    // RCs pendentes de resolução (código do Spend ainda "A...", não resolvido por Pedido, Contrato
    // básico nem RC única) — listagem individual pra conferência manual: Grupo Comprador (Sistema),
    // RC, Pedido, Contrato básico. Sai de baseAll (antes da exclusão), então a lista continua
    // completa mesmo com a caixa "Excluir RCs pendentes" marcada — é ela que serve de conferência
    // do que está sendo tirado da conta.
    const pendA = baseAll
        .filter(r => rootLetter(carOf(r)) === 'A')
        .map(r => ({ a: carOf(r), rc: r.rc, pedido: r.pedido || '', cb: r.cb || '' }))
        .sort((a, b) => a.a.localeCompare(b.a) || ('' + a.rc).localeCompare('' + b.rc));
    const t_gcs = document.querySelector('#t_gcs tbody');
    if (t_gcs) t_gcs.innerHTML = pendA.map(x => `<tr><td>${x.a}</td><td>${x.rc}</td><td>${x.pedido}</td><td>${x.cb}</td></tr>`).join('') || `<tr><td colspan="4" style="color:#46606F">Nenhuma RC pendente de resolução no recorte.</td></tr>`;
    const exclSt = document.getElementById('excl_pend_status');
    if (exclSt) {
        const nRec = pendA.length.toLocaleString('pt-BR'), nArq = pendRCSet.size.toLocaleString('pt-BR');
        exclSt.textContent = exclPend
            ? `Exclusão ligada: ${nArq} RCs pendentes fora dos gráficos, KPIs e tabelas desta aba em todo o arquivo (${nRec} delas no recorte atual, listadas abaixo) · o gráfico "A (raiz), estimado" fica de fora enquanto a exclusão estiver ligada.`
            : `Exclusão desligada: ${nRec} RCs pendentes no recorte (${nArq} no arquivo inteiro) seguem contando normalmente nos gráficos, KPIs e tabelas desta aba.`;
    }

    // Leitura (texto de insight) — alerta sobre os pontos de qualidade de dado exigidos: código "A"
    // não resolvido, carteira divergente, Pedido conflitante, RC ambígua e registros N/D
    const topCat = cats[0], nd = byCat['N/D'], ndTot = nd ? Object.values(nd).reduce((a, v) => a + v, 0) : 0;
    const topOther = typesOther.find(t => t !== 'N/D');
    const alerts = [];
    if (exclPend) alerts.push(`${pendRCSet.size} RCs pendentes por Grupo Comprador (Sistema) excluídas de todo o arquivo`);
    if (aNaoResolvidoCount) alerts.push(`${aNaoResolvidoCount} RCs com código "A" não resolvido`);
    if (divergCount) alerts.push(`${divergCount} RCs com carteira divergente`);
    if (pedidoConflitanteCount) alerts.push(`${pedidoConflitanteCount} Pedidos conflitantes`);
    if (rcAmbiguaCount) alerts.push(`${rcAmbiguaCount} RCs ambíguas`);
    if (ndTot) alerts.push(`${ndTot} RCs (${Math.round(ndTot / base.length * 100)}%) sem Carteira/Categoria`);
    document.getElementById('ins-contr').innerHTML = base.length ? `<b>Leitura:</b> no recorte entraram <b>${nCon} RCs de Contrato</b> e <b>${nSpo} RCs de Spot</b> (${pctCon.toFixed(0)}% / ${pctSpo.toFixed(0)}% do mix)${nMista ? `, <b>${nMista} RCs Mista</b> (Contrato e Spot na mesma RC)` : ''}${topOther ? `, além de <b>${nOut} RCs em outros tipos</b> — o mais comum é <b>${topOther}</b> (${typeCounts[topOther]}). ` : '. '}${topCat ? `Carteira com maior volume: <b>${topCat.c}</b> (${topCat.tot} RCs). ` : ''}${alerts.length ? `<b style="color:#8A6D00">${alerts.join(' · ')}</b> — priorize o saneamento para uma leitura confiável por carteira.` : ''}` : '<b>Sem RCs no recorte.</b>';
    SUM.contr = { nCon, nSpo, nOut, nMista, pctCon, pctSpo, total: base.length, top: top8.map(x => ({ c: x.c, tot: x.tot })) };
}
