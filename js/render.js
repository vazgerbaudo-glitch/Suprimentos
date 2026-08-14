function kpiCardHTML(k) {
    return `<div class="kpi ${k.c || ''}"><div class="lbl">${k.l}</div><div class="val">${k.v}</div>${k.p ? `<span class="pill ${k.pc}">${k.p}</span>` : ''}</div>`;
}
function kpi(el, a) {
    document.getElementById(el).innerHTML = a.map(kpiCardHTML).join('');
}
function gaugeSVG(pct) {
    const MAX = 160, cl = Math.max(0, Math.min(pct, MAX)), cx = 90, cy = 85, r = 68;
    const pt = v => { const t = (180 - 180 * v / MAX) * Math.PI / 180; return { x: cx + r * Math.cos(t), y: cy - r * Math.sin(t) }; };
    const zones = [[0, 80, '#D2373C'], [80, 100, '#D9A400'], [100, MAX, '#1E9F7F']];
    const arcs = zones.map(([s0, s1, col]) => {
        const p0 = pt(s0), p1 = pt(s1);
        return `<path d="M ${p0.x.toFixed(1)} ${p0.y.toFixed(1)} A ${r} ${r} 0 0 1 ${p1.x.toFixed(1)} ${p1.y.toFixed(1)}" stroke="${col}" stroke-width="13" fill="none"/>`;
    }).join('');
    const np = pt(cl);
    return `<svg viewBox="0 0 180 95" style="width:100%;height:72px;overflow:visible">${arcs}<line x1="${cx}" y1="${cy}" x2="${np.x.toFixed(1)}" y2="${np.y.toFixed(1)}" stroke="#13303F" stroke-width="3" stroke-linecap="round"/><circle cx="${cx}" cy="${cy}" r="5" fill="#13303F"/></svg>`;
}
function gaugeCardHTML(label, val, unit, pct, cor) {
    return `<div class="kpi ${cor}">
        <div class="lbl">${label}</div>
        ${gaugeSVG(pct)}
        <div style="text-align:center;margin-top:-4px"><span style="font-size:20px;font-weight:700;letter-spacing:-.5px;font-variant-numeric:tabular-nums">${val}</span><span style="font-size:11px;color:var(--muted)"> ${unit}</span></div>
    </div>`;
}
function initials(name) {
    return (name || '').trim().split(/\s+/).slice(0, 2).map(w => w[0] || '').join('').toUpperCase() || '?';
}
function compRowHTML(cp, label, metricTxt, active, isGeral) {
    return `<div class="comp-row${active ? ' active' : ''}${isGeral ? ' geral' : ''}" data-cp="${cp}"><div class="comp-avatar">${isGeral ? '👥' : initials(cp)}</div><div class="ci"><b>${label}</b><span>${metricTxt}</span></div></div>`;
}
function renderCompList(rows) {
    const html = compRowHTML('GERAL', 'Geral (todos)', rows.length + ' compradores', STATE.comp === 'GERAL', true) +
        rows.map(r => compRowHTML(r.cp, r.cp, r.ipd ? r.ipd.toFixed(2) + ' itens/dia' : 'sem dados no recorte', STATE.comp === r.cp, false)).join('');
    document.getElementById('comp-list').innerHTML = html;
    document.querySelectorAll('#comp-list .comp-row').forEach(el => el.onclick = () => { STATE.comp = el.dataset.cp; render(); });
}
function fmtDia(d) {
    return d ? String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0') + '/' + String(d.getFullYear()).slice(2) : '—';
}
// Semáforo de RC aberta vs. SLA Alvo — conta é SLA Alvo × SLA Real (mesma régua da tabela da aba Aging)
function sevOpen(r) {
    const lim = r.sa > 0 ? r.sa : 15;
    if (r.sr > lim) return ['s-rd', 'Crítico', 'f-rd'];
    if (lim - r.sr <= 2) return ['s-or', 'Atenção', 'f-or'];
    return ['s-am', 'Dentro do prazo', 'f-am'];
}
// RCs abertas para acompanhamento (aba Compradores) — mesma base da aba Aging (2025+2026, sem corte de data); cp=null traz todo o time
function openRCsFor(cp) {
    return ALLRC.filter(r => r.st === 'A' && r.dl && periodHitAging(r.dl) && tpHit(r) && stHit(r) && (!cp || r.cp === cp))
        .map(r => ({ ...r, age: bizDaysDiff(r.dl, HOJE) }))
        .filter(r => r.age > 0)
        .sort((a, b) => b.age - a.age);
}
function renderOpenRCPanel(tblId, sumId, rcs, showComp, showExtra = true, sortable = false) {
    const cnt = { 'Dentro do prazo': 0, 'Atenção': 0, 'Crítico': 0 };
    rcs.forEach(r => cnt[sevOpen(r)[1]]++);
    const avg = rcs.length ? Math.round(rcs.reduce((a, r) => a + r.age, 0) / rcs.length) : 0;
    document.getElementById(sumId).innerHTML = rcs.length ? `<b>${rcs.length}</b> RC${rcs.length > 1 ? 's' : ''} em aberto no recorte · aging médio <b>${avg}d</b> · <span class="tag-sev s-am">Dentro do prazo: ${cnt['Dentro do prazo']}</span> <span class="tag-sev s-or">Atenção: ${cnt['Atenção']}</span> <span class="tag-sev s-rd">Crítico: ${cnt['Crítico']}</span>` : 'Nenhuma RC em aberto no recorte.';
    if (sortable) {
        const dir = rcOpenSort.dir, key = rcOpenSort.key;
        rcs = rcs.map(r => ({ ...r, saldo: r.sa > 0 ? r.sa - r.sr : null })).sort((a, b) => {
            let va = a[key], vb = b[key];
            if (va == null) va = (key === 'cp' || key === 'rc') ? '' : -1;
            if (vb == null) vb = (key === 'cp' || key === 'rc') ? '' : -1;
            if (typeof va === 'string') return va.localeCompare(vb) * dir;
            return (va - vb) * dir;
        });
        document.querySelector('#' + tblId + ' thead').innerHTML = '<tr>' + RCOPEN_COLS.map(c => `<th class="${c.k === 'cp' || c.k === 'rc' ? '' : 'num'}" data-key="${c.k}" style="cursor:pointer">${c.l}${rcOpenSort.key === c.k ? (rcOpenSort.dir > 0 ? ' ▲' : ' ▼') : ''}</th>`).join('') + '<th>Semáforo</th></tr>';
    }
    document.querySelector('#' + tblId + ' tbody').innerHTML = rcs.map(r => {
        const s = sevOpen(r);
        const saldo = r.sa > 0 ? r.sa - r.sr : null;
        const saldoTxt = saldo == null ? '—' : (saldo >= 0 ? '+' : '') + saldo + 'd';
        const saldoCol = saldo == null ? 'color:var(--muted)' : saldo >= 0 ? 'color:#14705A' : 'color:#C0272D';
        return `<tr${showComp ? ` class="jump" data-cp="${r.cp}" style="cursor:pointer"` : ''}>${showComp ? `<td>${r.cp}</td>` : ''}<td>${r.rc || '-'}</td><td class="num">${r.it}</td>${showExtra ? `<td>${(r.td || '').trim() || '-'}</td><td>${(r.et || '').replace(/^\d+\.?\s*/, '') || '-'}</td><td class="num">${fmtDia(r.dl)}</td>` : ''}<td class="num">${r.sa || '—'}</td><td class="num">${r.age}</td><td class="num" style="${saldoCol}">${saldoTxt}</td><td><span class="farol ${s[2]}"></span><span class="tag-sev ${s[0]}">${s[1]}</span></td></tr>`;
    }).join('') || `<tr><td colspan="${(showComp ? 1 : 0) + (showExtra ? 3 : 0) + 6}" style="color:#46606F">Nenhuma RC em aberto no recorte.</td></tr>`;
    if (showComp) document.querySelectorAll('#' + tblId + ' tbody tr.jump').forEach(tr => tr.onclick = () => { STATE.comp = tr.dataset.cp; render(); });
    if (sortable) document.querySelectorAll('#' + tblId + ' thead th[data-key]').forEach(th => th.onclick = () => { const k = th.dataset.key; if (rcOpenSort.key === k) rcOpenSort.dir *= -1; else { rcOpenSort.key = k; rcOpenSort.dir = (k === 'cp' || k === 'rc') ? 1 : -1; } renderCompradores(); });
}
function render() {
    DUCAL = buildDuCalendar(ALL);
    ALLRC = rollupRC(ALL);
    renderProd();
    renderAging();
    renderSLA();
    renderSaving();
    renderContr();
    renderCompradores();
    renderOverview();
    // proj.js é carregado depois deste arquivo (a chamada só acontece em runtime, com os dados já
    // lidos); a guarda evita quebrar o painel inteiro se a aba Projeções não estiver na página.
    if (typeof renderProj === 'function') renderProj();
}
function renderProd() {
    // KPI + velocímetro — atingimento da meta ponderada (Material/Serviço)
    const base = ALL.filter(r => r.st === 'C' && r.dc >= DATA_INI_PROD && periodHit(r.dc) && compHit(r) && tpHit(r) && stHit(r));
    const CAP = { 'Material': STATE.metaMat, 'Serviço': STATE.metaServ };
    const byW = {};
    base.forEach(r => {
        const w = isoWeek(r.dc);
        const o = (byW[w] = byW[w] || { n: 0, ipd: 0, ipc: 0, ipcN: 0, bs: new Set(), cap: 0, duM: new Map(), faM: new Map() });
        o.n++; o.ipd += r.ipd; o.ipc += r.ipc; if (r.ipc > 0) o.ipcN++; o.bs.add(r.cp);
        const capMeta = CAP[r.cl];
        if (capMeta > 0) o.cap += 1 / capMeta;
        if (r.du > 0) o.duM.set(r.du, (o.duM.get(r.du) || 0) + 1);
        if (r.fa > 0) o.faM.set(r.fa, (o.faM.get(r.fa) || 0) + 1);
    });
    const weeks = Object.keys(byW).sort(), ger = STATE.comp === 'GERAL';
    let _fb = false;
    const wv = weeks.map(w => {
        const o = byW[w];
        if (!ger) return o.ipd;
        // "Item/dia/comprador" só é confiável quando preenchida na maioria dos itens da semana — nas
        // semanas com a coluna corretamente preenchida, TODO item concluído a traz. Uma semana com só
        // 1 ou 2 valores perdidos no meio de dezenas em branco (ex.: resíduo de fórmula não recalculada)
        // não é "a coluna preenchida", e usar a soma inteira nesse caso derruba o indicador para perto
        // de zero — cai no fallback (Item/dia ÷ compradores ativos) como se a coluna estivesse vazia.
        if (o.ipc > 0 && o.ipcN >= o.n / 2) return o.ipc;
        if (o.ipd > 0 && o.bs.size) { _fb = true; return o.ipd / o.bs.size; }
        return 0;
    });
    const val = weeks.length ? wv.reduce((a, b) => a + b, 0) / weeks.length : 0;
    const modeM3 = (m, def) => { let b = def, bc = -1; m.forEach((c, v) => { if (c > bc) { bc = c; b = v; } }); return b; };
    const totCap = weeks.reduce((a, w) => a + byW[w].cap, 0);
    // Denominador = dias úteis × headcount. Usa "Número de funcionários ativos" (fa) da própria base —
    // a mesma referência de Item/dia/comprador que alimenta o número exibido no velocímetro. Cair para
    // "compradores que concluíram algo na semana" (bs.size) inflava o atingimento sempre que alguém do
    // time ficava a semana inteira sem concluir nada; só é usado quando a base não traz o headcount.
    let _fbFa = false;
    const totDenom = weeks.reduce((a, w) => {
        const o = byW[w];
        const du = modeM3(o.duM, 5);
        let buyers = 1;
        if (ger) {
            if (o.faM.size) buyers = modeM3(o.faM, o.bs.size);
            else { buyers = o.bs.size || 1; if (o.bs.size) _fbFa = true; }
        }
        return a + du * buyers;
    }, 0);
    const ating = totDenom > 0 ? totCap / totDenom * 100 : 0;
    const cor = ating >= 100 ? 'good' : ating >= 80 ? 'warn' : 'bad';
    document.getElementById('kpi-prod').innerHTML = gaugeCardHTML(ger ? 'Itens/dia/comprador' : 'Itens/dia', val.toFixed(2), ger ? 'itens/dia/comp' : 'itens/dia', ating, cor) + [
        { l: 'Atingimento da meta', v: ating.toFixed(0) + '%', c: cor, p: ating >= 100 ? 'meta' : ating >= 80 ? '80%' : '<80%', pc: ating >= 100 ? 'p-good' : ating >= 80 ? 'p-warn' : 'p-bad', n: 'meta ponderada: Material ' + STATE.metaMat + ' · Serviço ' + STATE.metaServ + ' (itens/dia)' },
        { l: 'Itens concluídos', v: base.length.toLocaleString('pt-BR'), n: 'no recorte' },
        { l: 'Semanas no recorte', v: weeks.length, n: STATE.comp === 'GERAL' ? 'todos compradores' : STATE.comp }].map(kpiCardHTML).join('');
    mkChart('c_gauge', { type: 'bar', data: { labels: ['Atingimento'], datasets: [{ data: [Math.min(ating, 200)], backgroundColor: ating >= 100 ? C.teal : ating >= 80 ? C.amber : C.red, borderRadius: 18, barThickness: 34 }] }, options: { indexAxis: 'y', maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { callbacks: { label: () => ating.toFixed(0) + '%' } } }, scales: { x: { min: 0, max: 200, grid: { color: '#E5EBEE' }, border: { display: false }, ticks: { callback: v => v + '%' }, afterBuildTicks: a => { a.ticks = [{ value: 80 }, { value: 100 }, { value: 150 }]; } }, y: noG } } });

    // Itens concluídos por semana — desde abr/2026 (DATA_INI_PROD), usada pelo gráfico c_psem, pelos
    // gráficos abaixo (c_ipdsem, c_tipo, c_escomp) e pelo card "Itens concluídos por semana" da Visão
    // Geral (SUM.prod).
    const ctx = ALL.filter(r => r.st === 'C' && r.dc >= DATA_INI_PROD && inY(r.dc) && compHit(r) && tpHit(r) && stHit(r));
    const cw = {};
    ctx.forEach(r => { const w = isoWeek(r.dc); cw[w] = (cw[w] || 0) + 1; });
    const ew = {};
    ALL.filter(r => r.dl && r.dl >= DATA_INI_PROD && inY(r.dl) && compHit(r) && tpHit(r) && stHit(r)).forEach(r => { const w = isoWeek(r.dl); ew[w] = (ew[w] || 0) + 1; });
    const cwk = [...new Set([...Object.keys(cw), ...Object.keys(ew)])].sort();
    mkChart('c_psem', { type: 'bar', data: { labels: cwk.map(w => wkLabel(w)), datasets: [{ label: 'Entrada', data: cwk.map(w => ew[w] || 0), backgroundColor: C.steel, borderRadius: 18 }, { label: 'Concluídos', data: cwk.map(w => cw[w] || 0), backgroundColor: C.teal, borderRadius: 18 }] }, options: { maintainAspectRatio: false, layout: { padding: { top: 16 } }, plugins: { legend: { display: false } }, scales: { x: { ...noG, ticks: { maxTicksLimit: 18, font: { size: 8 } } }, y: { ...soG, beginAtZero: true } } } });

    // Evolução de itens/dia/comprador por semana (c_ipdsem) — visão do ano
    const byWY = {};
    ctx.forEach(r => { const w = isoWeek(r.dc); const o = (byWY[w] = byWY[w] || { ipd: 0, ipc: 0, bs: new Set() }); o.ipd += r.ipd; o.ipc += r.ipc; o.bs.add(r.cp); });
    const wkY = Object.keys(byWY).sort();
    const ipdW = wkY.map(w => { const o = byWY[w]; let v; if (!ger) v = o.ipd; else if (o.ipc > 0) v = o.ipc; else v = o.bs.size ? o.ipd / o.bs.size : 0; return +v.toFixed(2); });
    const avgY = ipdW.length ? ipdW.reduce((a, b) => a + b, 0) / ipdW.length : 0;
    mkChart('c_ipdsem', { type: 'line', plugins: [crosshair], data: { labels: wkY.map(wkLabel), datasets: [{ label: ger ? 'Itens/dia/comprador' : 'Itens/dia', data: ipdW, borderColor: C.blue, backgroundColor: 'rgba(14,83,140,.08)', fill: true, tension: .3, borderWidth: 2, pointRadius: 0, pointHoverRadius: 5, pointHoverBackgroundColor: C.blue }, { label: 'Média do período', data: wkY.map(() => +avgY.toFixed(2)), borderColor: C.mist, borderDash: [6, 4], borderWidth: 1.4, pointRadius: 0, pointHoverRadius: 4, pointHoverBackgroundColor: C.mist, fill: false }] }, options: { maintainAspectRatio: false, interaction: { mode: 'index', intersect: false }, plugins: { tooltip: { mode: 'index', intersect: false, callbacks: { title: c => 'Semana de ' + c[0].label, label: c => c.dataset.label + ': ' + c.parsed.y.toFixed(2) + ' itens/dia' } } }, scales: { x: { ...noG, ticks: { maxTicksLimit: 13, font: { size: 8 } } }, y: { ...soG, beginAtZero: true } } } });

    // Concluídos por comprador (c_pcomp)
    const pcb = ALL.filter(r => r.st === 'C' && r.dc >= DATA_INI_PROD && periodHit(r.dc) && tpHit(r) && stHit(r));
    const pc = {};
    pcb.forEach(r => { pc[r.cp] = (pc[r.cp] || 0) + 1; });
    const pca = Object.entries(pc).sort((a, b) => b[1] - a[1]).slice(0, 12);
    const clByCompP = {};
    pcb.forEach(r => { const o = clByCompP[r.cp] = clByCompP[r.cp] || { Material: 0, Serviço: 0 }; if (r.cl === 'Material') o.Material++; else if (r.cl === 'Serviço') o.Serviço++; });
    const classColorP = cp => { const o = clByCompP[cp]; if (!o || (!o.Material && !o.Serviço)) return C.steel; return o.Material >= o.Serviço ? C.steel : C.blue; };
    mkChart('c_pcomp', { type: 'bar', data: { labels: pca.map(x => x[0]), datasets: [{ data: pca.map(x => x[1]), backgroundColor: pca.map(x => x[0] === STATE.comp ? C.accent : classColorP(x[0])), borderRadius: 18, barPercentage: 1, categoryPercentage: .85 }] }, options: { legendChips: [['Material', C.steel], ['Serviço', C.blue], ['Selecionado', C.accent]], indexAxis: 'y', maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => c.parsed.x.toLocaleString('pt-BR') + ' itens' } } }, scales: { x: { ...soG, beginAtZero: true }, y: { ...noG, ticks: { font: { size: 10 } } } } } });

    // ===== visuais adicionais: tipo de demanda, entrada x saída, meta, heatmap dia =====
    // Produtividade por tipo de demanda (c_tipo)
    const ctxL = ALL.filter(r => r.dl && r.dl >= DATA_INI_PROD && inY(r.dl) && compHit(r) && tpHit(r) && stHit(r));
    const TIPOS = ['Spot', 'Urgente', 'MRP', 'Determinada', 'Contrato', 'Regularização'];
    const TCOL = { Spot: '#5A8CAE', Urgente: '#D2373C', MRP: '#1E9F7F', Determinada: '#D9A400', Contrato: '#003865', 'Regularização': '#7A8C97', Outros: '#CAD6DD' };
    const wkset = [...new Set(ctx.map(r => isoWeek(r.dc)))].sort();
    const tdcat = r => TIPOS.indexOf(r.td) >= 0 ? r.td : 'Outros';
    const catsT = [...TIPOS, 'Outros'];
    const dsT = catsT.map(cat => ({ label: cat, data: wkset.map(w => ctx.filter(r => isoWeek(r.dc) === w && tdcat(r) === cat).length), backgroundColor: TCOL[cat], stack: 's' }));
    mkChart('c_tipo', { type: 'bar', data: { labels: wkset.map(w => wkLabel(w)), datasets: dsT }, options: { maintainAspectRatio: false, plugins: { legend: { position: 'top', labels: { boxWidth: 11, usePointStyle: true, font: { size: 10 } } } }, scales: { x: { stacked: true, grid: { display: false }, ticks: { maxTicksLimit: 13, font: { size: 8 } } }, y: { stacked: true, ...soG, beginAtZero: true } } } });

    // Entrada × saída por comprador (c_escomp)
    const ent = {}, sai = {};
    ctxL.forEach(r => { const w = isoWeek(r.dl); ent[w] = (ent[w] || 0) + 1; });
    ctx.forEach(r => { const w = isoWeek(r.dc); sai[w] = (sai[w] || 0) + 1; });
    const wksES = [...new Set([...Object.keys(ent), ...Object.keys(sai)])].sort();
    const eV = wksES.map(w => ent[w] || 0), sV = wksES.map(w => sai[w] || 0), labES = wksES.map(w => wkLabel(w));
    const entC = {}, saiC = {}, devC = {};
    ALL.filter(r => r.dl && r.dl >= DATA_INI_PROD && periodHit(r.dl) && compHit(r) && tpHit(r) && stHit(r)).forEach(r => { entC[r.cp] = (entC[r.cp] || 0) + 1; });
    ALL.filter(r => r.st === 'C' && r.dc >= DATA_INI_PROD && periodHit(r.dc) && compHit(r) && tpHit(r) && stHit(r)).forEach(r => { saiC[r.cp] = (saiC[r.cp] || 0) + 1; });
    ALL.filter(r => r.st === 'D' && r.dl && r.dl >= DATA_INI_PROD && periodHit(r.dl) && compHit(r) && tpHit(r) && stHit(r)).forEach(r => { devC[r.cp] = (devC[r.cp] || 0) + 1; });
    const compsES = [...new Set([...Object.keys(entC), ...Object.keys(saiC), ...Object.keys(devC)])].sort((a, b) => (saiC[b] || 0) - (saiC[a] || 0)).slice(0, 12);
    mkChart('c_escomp', { type: 'bar', data: { labels: compsES, datasets: [{ label: 'Entrada', data: compsES.map(c => entC[c] || 0), backgroundColor: C.steel, borderRadius: 18 }, { label: 'Saída', data: compsES.map(c => saiC[c] || 0), backgroundColor: C.teal, borderRadius: 18 }, { label: 'Devolvida', data: compsES.map(c => devC[c] || 0), backgroundColor: C.red, borderRadius: 18 }] }, options: { maintainAspectRatio: false, plugins: { legend: { position: 'top', labels: { boxWidth: 11, usePointStyle: true, font: { size: 10 } } } }, scales: { x: { ...noG, ticks: { font: { size: 9 }, maxRotation: 45, minRotation: 35 } }, y: { ...soG, beginAtZero: true } } } });

    // Entrada × saída vs meta de capacidade (c_esmeta)
    const wkInfo = {};
    ctx.forEach(r => { const w = isoWeek(r.dc); const o = (wkInfo[w] = wkInfo[w] || { fa: new Map(), du: new Map(), bs: new Set(), mat: 0, srv: 0 }); if (r.fa > 0) o.fa.set(r.fa, (o.fa.get(r.fa) || 0) + 1); if (r.du > 0) o.du.set(r.du, (o.du.get(r.du) || 0) + 1); o.bs.add(r.cp); if (r.cl === 'Material') o.mat++; else if (r.cl === 'Serviço') o.srv++; });
    const modeM = (m, def) => { let b = def, bc = -1; m.forEach((c, v) => { if (c > bc) { bc = c; b = v; } }); return b; };
    // Meta da semana = headcount × dias úteis × meta ponderada pelo mix Material/Serviço concluído nela.
    // Antes usava 7 itens/dia/comprador fixo, que não acompanhava as metas configuráveis (Material/Serviço)
    // e divergia do atingimento mostrado no velocímetro sempre que o mix saía do padrão.
    const metaV = wksES.map(w => {
        const o = wkInfo[w]; if (!o) return null;
        const du = modeM(o.du, 5);
        const buyers = STATE.comp === 'GERAL' ? (o.fa.size ? modeM(o.fa, o.bs.size) : o.bs.size) : 1;
        const totMix = o.mat + o.srv, capMix = o.mat / STATE.metaMat + o.srv / STATE.metaServ;
        const metaDia = capMix > 0 ? totMix / capMix : STATE.metaMat;
        return Math.round(metaDia * buyers * du);
    });
    mkChart('c_esmeta', { type: 'line', plugins: [crosshair], data: { labels: wksES.map(wkLabelFull), datasets: [{ label: 'Entrada', data: eV, borderColor: C.steel, backgroundColor: 'rgba(90,140,174,.16)', fill: true, tension: .3, borderWidth: 2, pointRadius: 0, pointHoverRadius: 5, pointHoverBackgroundColor: C.steel }, { label: 'Saída', data: sV, borderColor: C.teal, backgroundColor: 'rgba(30,159,127,.14)', fill: true, tension: .3, borderWidth: 2, pointRadius: 0, pointHoverRadius: 5, pointHoverBackgroundColor: C.teal }, { label: 'Meta', data: metaV, borderColor: '#003865', borderDash: [6, 4], borderWidth: 1.6, pointRadius: 0, pointHoverRadius: 5, pointHoverBackgroundColor: '#003865', tension: .2, fill: false }] }, options: { maintainAspectRatio: false, interaction: { mode: 'index', intersect: false }, plugins: { legend: { position: 'top', labels: { boxWidth: 11, usePointStyle: true, font: { size: 9 } } }, tooltip: { mode: 'index', intersect: false, callbacks: { title: c => 'Semana de ' + c[0].label } } }, scales: { x: { ...soG, ticks: { maxTicksLimit: 13, font: { size: 8 }, callback: function (v) { return labES[v]; } } }, y: { ...soG, beginAtZero: true } } } });

    // Itens por faixa de valor de entrada (c_valfaixa)
    const valB = ALL.filter(r => r.dl && r.dl >= DATA_INI_PROD && periodHit(r.dl) && compHit(r) && tpHit(r) && stHit(r));
    const VF = [['≤ 200k', C.steel], ['200k – 300k', C.blue], ['> 300k', '#003865']];
    const vfIdx = v => v <= 200000 ? 0 : v <= 300000 ? 1 : 2;
    const vfCnt = [0, 0, 0];
    valB.forEach(r => { vfCnt[vfIdx(r.vl)]++; });
    mkChart('c_valfaixa', { type: 'bar', data: { labels: VF.map(x => x[0]), datasets: [{ data: vfCnt, backgroundColor: VF.map(x => x[1]), borderRadius: 18 }] }, options: { maintainAspectRatio: false, layout: { padding: { top: 14 } }, plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => c.parsed.y.toLocaleString('pt-BR') + ' itens' } } }, scales: { x: noG, y: { ...soG, beginAtZero: true } } } });

    // Mapa de calor — produtividade por dia da semana (heat_prod)
    const ctxH = ALL.filter(r => r.st === 'C' && r.dc >= DATA_INI_PROD && periodHit(r.dc) && compHit(r) && tpHit(r) && stHit(r));
    const DOW = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex'];
    const hp = {};
    ctxH.forEach(r => { const wd = r.dc.getDay(); if (wd < 1 || wd > 5) return; (hp[r.cp] = hp[r.cp] || [0, 0, 0, 0, 0])[wd - 1]++; });
    const rowsP = Object.entries(hp).map(([c, a]) => [c, a, a.reduce((x, y) => x + y, 0)]).sort((a, b) => b[2] - a[2]).slice(0, 12);
    const mxP = Math.max(1, ...rowsP.flatMap(r => r[1]));
    const cellP = v => { if (!v) return '<td class="cell" style="background:#F2F5F6;color:#9AACB5">·</td>'; const a = .10 + .75 * v / mxP; return `<td class="cell" style="background:rgba(14,83,140,${a.toFixed(2)});color:${a > .5 ? '#FFFFFF' : '#13303F'}">${v}</td>`; };
    document.getElementById('heat_prod').innerHTML = `<table><thead><tr><th class="rl"></th>${DOW.map(d => `<th>${d}</th>`).join('')}<th>Total</th></tr></thead><tbody>${rowsP.map(r => `<tr><td class="rl">${r[0]}</td>${r[1].map(cellP).join('')}<td class="cell" style="background:#FBD300;color:#1F2933">${r[2]}</td></tr>`).join('') || '<tr><td class="rl" colspan=7 style="color:#46606F">Sem conclusões no recorte.</td></tr>'}</tbody></table>`;

    // Itens/dia por comprador — taxa individual (c_ipdcomp)
    const ipdBase = ALL.filter(r => r.st === 'C' && r.dc >= DATA_INI_PROD && periodHit(r.dc) && tpHit(r) && stHit(r));
    const ipdMap = {};
    ipdBase.forEach(r => { const m = ipdMap[r.cp] = ipdMap[r.cp] || {}; const w = isoWeek(r.dc); m[w] = (m[w] || 0) + r.ipd; });
    const ipdAvg = {};
    Object.keys(ipdMap).forEach(cp => { const vs = Object.values(ipdMap[cp]); ipdAvg[cp] = vs.reduce((a, b) => a + b, 0) / vs.length; });
    const ipdArr = Object.entries(ipdAvg).sort((a, b) => b[1] - a[1]).slice(0, 12);
    const clByCompI = {};
    ipdBase.forEach(r => { const o = clByCompI[r.cp] = clByCompI[r.cp] || { Material: 0, Serviço: 0 }; if (r.cl === 'Material') o.Material++; else if (r.cl === 'Serviço') o.Serviço++; });
    const classColorI = cp => { const o = clByCompI[cp]; if (!o || (!o.Material && !o.Serviço)) return C.teal; return o.Material >= o.Serviço ? C.steel : C.blue; };
    mkChart('c_ipdcomp', { type: 'bar', plugins: [refLines([{ v: STATE.metaMat, color: C.steel, label: 'Meta Material ' + STATE.metaMat }, { v: STATE.metaServ, color: C.amber, label: 'Meta Serviço ' + STATE.metaServ }])], data: { labels: ipdArr.map(x => x[0]), datasets: [{ data: ipdArr.map(x => +x[1].toFixed(2)), backgroundColor: ipdArr.map(x => x[0] === STATE.comp ? C.accent : classColorI(x[0])), borderRadius: 18, barPercentage: 1, categoryPercentage: .85 }] }, options: { legendChips: [['Material', C.steel], ['Serviço', C.blue], ['Selecionado', C.accent]], indexAxis: 'y', maintainAspectRatio: false, layout: { padding: { top: 14 } }, plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => c.parsed.x.toFixed(2) + ' itens/dia' } } }, scales: { x: { ...soG, beginAtZero: true, suggestedMax: Math.max(STATE.metaMat, STATE.metaServ) }, y: { ...noG, ticks: { font: { size: 10 } } } } } });

    // Material x Serviço — quantidade e % (c_mat_qtd, c_mat_pct)
    const msB = ALL.filter(r => r.st === 'C' && r.dc >= DATA_INI_PROD && periodHit(r.dc) && compHit(r) && tpHit(r) && stHit(r));
    const MSc = ['Material', 'Serviço'];
    const msQ = MSc.map(c => msB.filter(r => r.cl === c).length);
    const totMS = msQ[0] + msQ[1];
    mkChart('c_mat_qtd', { type: 'bar', data: { labels: MSc, datasets: [{ data: msQ, backgroundColor: [C.steel, C.blue], borderRadius: 18 }] }, options: { maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => c.parsed.y.toLocaleString('pt-BR') + ' itens' } } }, scales: { x: noG, y: { ...soG, beginAtZero: true } } } });
    mkChart('c_mat_pct', { type: 'doughnut', data: { labels: MSc, datasets: [{ data: msQ, backgroundColor: [C.steel, C.blue], borderWidth: 2, borderColor: '#FFFFFF' }] }, options: { maintainAspectRatio: false, cutout: '62%', plugins: { legend: { position: 'bottom', labels: { boxWidth: 12, usePointStyle: true } }, centerText: { label: 'Itens' }, tooltip: { callbacks: { label: c => c.parsed.toLocaleString('pt-BR') + ' (' + (totMS ? Math.round(c.parsed / totMS * 100) : 0) + '%)' } } } } });

    // Entrada x Saída total no recorte (c_esgeral)
    const entG = ALL.filter(r => r.dl && r.dl >= DATA_INI_PROD && periodHit(r.dl) && compHit(r) && tpHit(r) && stHit(r)).length;
    mkChart('c_esgeral', { type: 'bar', data: { labels: ['Entrada', 'Saída'], datasets: [{ data: [entG, msB.length], backgroundColor: [C.steel, C.teal], borderRadius: 18 }] }, options: { maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => c.parsed.y.toLocaleString('pt-BR') + ' RCs' } } }, scales: { x: noG, y: { ...soG, beginAtZero: true } } } });

    // Leitura (texto de insight)
    const t = ating >= 100 ? `acima da meta (${ating.toFixed(0)}%)` : ating >= 80 ? `em atenção (${ating.toFixed(0)}% da meta)` : `abaixo do mínimo (${ating.toFixed(0)}%)`;
    document.getElementById('ins-prod').innerHTML = `<b>Leitura:</b> ${ger ? 'a equipe concluiu em média' : STATE.comp + ' concluiu'} <b>${val.toFixed(2)} ${ger ? 'itens/dia/comprador' : 'itens/dia'}</b> no recorte, ${t}. 100% considera o mix real de Material e Serviço concluídos, contra as metas por classe (Material ${STATE.metaMat}/dia · Serviço ${STATE.metaServ}/dia) — ajuste-as acima se os alvos mudarem.${_fb ? ' <b style="color:#8A6D00">⚠ Valor estimado:</b> a coluna <i>Item/dia/comprador</i> está vazia na base para a(s) semana(s) do recorte, então o itens/dia/comprador foi calculado como Item/dia ÷ compradores ativos. Para o número oficial, preencha o headcount da semana na planilha.' : ''}${_fbFa && !_fb ? ' <b style="color:#8A6D00">⚠ Atingimento estimado:</b> a coluna <i>Número de funcionários ativos</i> está vazia na base para a(s) semana(s) do recorte, então o denominador da meta caiu para os compradores que concluíram algo — o que tende a superestimar o atingimento.' : ''}`;
    SUM.prod = { ating, val, ger, concluidos: base.length, entradas: entG, weeks: cwk.map(wkLabel), weekly: cwk.map(w => cw[w] || 0), entries: cwk.map(w => ew[w] || 0), matLabels: MSc, matQ: msQ, matTot: totMS };
}
function renderAging() {
    // Aging das RCs em aberto — distribuição e KPIs base
    const base = ALLRC.filter(r => r.st === 'A' && r.dl && periodHitAging(r.dl) && compHit(r) && tpHit(r) && stHit(r));
    const ag = base.map(r => ({ ...r, age: bizDaysDiff(r.dl, HOJE) })).filter(r => r.age > 0);
    const FA = [['0-3', 0, 3], ['4-7', 4, 7], ['8-15', 8, 15], ['16-30', 16, 30], ['>30', 31, 1e9]];
    const FCOL = ['#1E9F7F', '#7FE06C', '#FBD300', '#C79100', '#D2373C'];
    const faIdx = a => { for (let i = 0; i < FA.length; i++) if (a >= FA[i][1] && a <= FA[i][2]) return i; return FA.length - 1; };
    const f = FA.map(() => 0);
    ag.forEach(r => { f[faIdx(r.age)]++; });
    const arr = ag.map(r => r.age).sort((a, b) => a - b);
    const med = arr.length ? (arr.length % 2 ? arr[(arr.length - 1) / 2] : (arr[arr.length / 2 - 1] + arr[arr.length / 2]) / 2) : 0;
    const avg = arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : 0;
    const crit = ag.filter(r => r.age > 30).length;

    // Material x Serviço — RCs abertas e aging médio por classe
    const MSag = ['Material', 'Serviço'];
    const msAgQ = MSag.map(c => ag.filter(r => r.cl === c).length);
    const msAgAvg = MSag.map(c => { const b = ag.filter(r => r.cl === c); return b.length ? Math.round(b.reduce((a, r) => a + r.age, 0) / b.length) : 0; });

    // Meta de Aging por tipo — Geral x Contrato x Spot (kpi-aging)
    // Regra: exclui RC Cancelada/vazia e itens "Remover de Compras Ágeis" = Sim; aging só com
    // datas válidas e maior que zero (aging = 0 é desconsiderado); consolida por RC (Geral) e por RC+Tipo
    // (Contrato/Spot) usando o MAIOR aging quando os itens da mesma RC divergem — assim uma RC
    // com vários itens não pesa mais que uma com um item só. Filtros de Comprador/Período/Tipo
    // entram só depois de consolidar, sobre os atributos já consolidados da RC.
    const consolidateAging = splitByTipo => {
        const groups = {};
        ALL.forEach(it => {
            const rc = ('' + (it.rc || '')).trim();
            if (!rc || it.st === 'X' || it.rm) return;
            // Contrato/Spot aqui usa "tp" (classTipo: Cenário SLA + Tipo) — a mesma classificação de
            // SLA/Produtividade/Overview — e não a coluna "Tipo" crua (it.td). A coluna crua só bate
            // "Contrato"/"Spot" literalmente, então RCs Spot cadastradas como Urgente/MRP/Determinada/
            // Regularização (a maioria) ficavam fora, encolhendo os cartões de meta para uma fração da
            // carteira real.
            if (splitByTipo && it.tp !== 'Contrato' && it.tp !== 'Spot') return;
            let age;
            if (it.st === 'A') age = bizDaysDiff(it.dl, HOJE);
            else if (it.st === 'C' && it.dl && it.dc) age = bizDaysDiff(it.dl, it.dc);
            else return;
            if (!Number.isFinite(age) || age <= 0) return;
            const key = splitByTipo ? rc + '|' + it.tp : rc;
            const o = groups[key] = groups[key] || { td: it.tp, ages: [], cps: [], dl: null, open: false };
            o.ages.push(age); o.cps.push(it.cp);
            if (!o.dl || it.dl < o.dl) o.dl = it.dl;
            if (it.st === 'A') o.open = true;
        });
        let divergent = 0;
        const rows = Object.values(groups).map(o => {
            if (new Set(o.ages).size > 1) divergent++;
            return { td: o.td, cp: mode(o.cps) || 'N/D', dl: o.dl, st: o.open ? 'A' : 'C', age: Math.max(...o.ages) };
        });
        return { rows, divergent };
    };
    // No recorte de Mês, a meta acumula desde jan/2026 até o fim do mês selecionado (não só aquele mês
    // isolado) — soma bruta de dias e RCs, com UM % vs meta calculado sobre o total acumulado. Mês
    // isolado oscila demais com poucas RCs; o acumulado mostra a tendência do ano até ali, igual a como
    // a meta é lida na prática (progresso acumulado, não reinício a cada mês). Geral/Semana não mudam —
    // o acumulado só faz sentido quando o corte é por mês.
    const mesAcumulado = STATE.modo === 'mes' && !!STATE.mes;
    const filtRow = r => r.dl && (mesAcumulado ? r.dl.getFullYear() === 2026 && ymKey(r.dl) <= STATE.mes : periodHitAging(r.dl)) && compHit(r) && tpHit(r) && stHit(r);
    const geralAg = consolidateAging(false), tipoAg = consolidateAging(true);
    const gRows = geralAg.rows.filter(filtRow);
    const cRows = tipoAg.rows.filter(r => r.td === 'Contrato').filter(filtRow);
    const sRows = tipoAg.rows.filter(r => r.td === 'Spot').filter(filtRow);
    // O aging médio comparado com a meta é da carteira inteira: RC aberta entra com o tempo já esperado
    // e RC concluída com o tempo de ciclo. Como as concluídas são a maioria esmagadora, o número fica bem
    // abaixo do aging só das abertas — que é o que todos os gráficos desta aba desenham. Por isso avgOpen
    // e n andam junto, para o card dizer de que população ele está falando (ver notas do kpi abaixo).
    const statsOf = rows => {
        const op = rows.filter(r => r.st === 'A');
        return {
            open: op.length, n: rows.length,
            avg: rows.length ? Math.round(rows.reduce((a, r) => a + r.age, 0) / rows.length) : 0,
            avgOpen: op.length ? Math.round(op.reduce((a, r) => a + r.age, 0) / op.length) : 0
        };
    };
    const gSt = statsOf(gRows), cSt = statsOf(cRows), sSt = statsOf(sRows);
    // Contagem crua de "Status RC = Em Aberto" na planilha (stRaw, antes da regra de "Remover de Compras
    // Ágeis") — é o número que o BI "Gestão à Vista" mostra no cartão "RCs em Aberto". Vale lembrar que
    // esse total é de ITENS, não de RCs: openRCsTotal traz as RCs distintas por trás dele.
    const openItemsTotal = ALL.filter(r => r.stRaw === 'A').length;
    const openRCsTotal = new Set(ALL.filter(r => r.stRaw === 'A' && r.rc).map(r => r.rc)).size;
    const agDivergentes = geralAg.divergent + tipoAg.divergent;
    const gPct = STATE.metaAgG > 0 ? (gSt.avg - STATE.metaAgG) / STATE.metaAgG * 100 : 0;
    const cPct = STATE.metaAgC > 0 ? (cSt.avg - STATE.metaAgC) / STATE.metaAgC * 100 : 0;
    const sPct = STATE.metaAgS > 0 ? (sSt.avg - STATE.metaAgS) / STATE.metaAgS * 100 : 0;
    const pf = p => (p > 0 ? '+' : '') + p.toFixed(1) + '%';
    kpi('kpi-aging', [
        { l: 'Itens em aberto — Geral', v: openItemsTotal, n: `total bruto · Status RC = Em Aberto, sem filtro · em ${openRCsTotal} RCs distintas` },
        { l: 'Aging médio — Geral', v: gSt.avg + 'd', c: gPct <= 0 ? 'good' : 'bad', n: `meta ≤ ${STATE.metaAgG}d · ${gSt.n.toLocaleString('pt-BR')} RCs (abertas + concluídas) · só as ${gSt.open} abertas: ${gSt.avgOpen}d` },
        { l: '% vs meta — Geral', v: pf(gPct), c: gPct <= 0 ? 'good' : 'bad', n: gPct <= 0 ? 'dentro da meta' : 'acima da meta' },
        { l: 'RC em aberto — Contrato', v: cSt.open, n: STATE.comp === 'GERAL' ? 'todos compradores' : STATE.comp },
        { l: 'Aging médio — Contrato', v: cSt.avg + 'd', c: cPct <= 0 ? 'good' : 'bad', n: `meta ≤ ${STATE.metaAgC}d · ${cSt.n.toLocaleString('pt-BR')} RCs (abertas + concluídas) · só as ${cSt.open} abertas: ${cSt.avgOpen}d` },
        { l: '% vs meta — Contrato', v: pf(cPct), c: cPct <= 0 ? 'good' : 'bad', n: cPct <= 0 ? 'dentro da meta' : 'acima da meta' },
        { l: 'RC em aberto — Spot', v: sSt.open, n: STATE.comp === 'GERAL' ? 'todos compradores' : STATE.comp },
        { l: 'Aging médio — Spot', v: sSt.avg + 'd', c: sPct <= 0 ? 'good' : 'bad', n: `meta ≤ ${STATE.metaAgS}d · ${sSt.n.toLocaleString('pt-BR')} RCs (abertas + concluídas) · só as ${sSt.open} abertas: ${sSt.avgOpen}d` },
        { l: '% vs meta — Spot', v: pf(sPct), c: sPct <= 0 ? 'good' : 'bad', n: sPct <= 0 ? 'dentro da meta' : 'acima da meta' }
    ]);

    // Distribuição por faixa de aging (c_afaixa)
    mkChart('c_afaixa', { type: 'bar', data: { labels: FA.map(x => x[0]), datasets: [{ data: f, backgroundColor: FCOL, borderRadius: 18 }] }, options: { maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: noG, y: { ...soG, beginAtZero: true } } } });

    // Backlog por mês de criação (c_agbacklog)
    const bm = {};
    ag.forEach(r => { const k = ymKey(r.dl); bm[k] = (bm[k] || 0) + 1; });
    const bmk = Object.keys(bm).sort();
    mkChart('c_agbacklog', { type: 'bar', data: { labels: bmk.map(mLabel), datasets: [{ data: bmk.map(k => bm[k]), backgroundColor: bmk.map((k, i) => i < bmk.length - 1 ? C.red : C.steel), borderRadius: 18 }] }, options: { maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => c.parsed.y + ' RCs' } } }, scales: { x: { ...noG, ticks: { font: { size: 9 } } }, y: { ...soG, beginAtZero: true } } } });

    // Aging por comprador x faixa (c_agcompfaixa)
    const byCp = {};
    ag.forEach(r => { (byCp[r.cp] = byCp[r.cp] || []).push(r.age); });
    const cpStats = Object.entries(byCp).map(([cp, ages]) => ({ cp, n: ages.length, avg: ages.reduce((a, b) => a + b, 0) / ages.length, ages: ages.slice().sort((x, y) => x - y) }));
    const topVol = cpStats.slice().sort((a, b) => b.n - a.n).slice(0, 10);
    const dsF = FA.map((fx, fi) => ({ label: fx[0], data: topVol.map(s => byCp[s.cp].filter(a => faIdx(a) === fi).length), backgroundColor: FCOL[fi], stack: 's' }));
    mkChart('c_agcompfaixa', { type: 'bar', data: { labels: topVol.map(s => s.cp), datasets: dsF }, options: { maintainAspectRatio: false, plugins: { legend: { position: 'top', labels: { boxWidth: 10, font: { size: 9 } } } }, scales: { x: { stacked: true, grid: { display: false }, ticks: { font: { size: 9 }, maxRotation: 40, minRotation: 30 } }, y: { stacked: true, ...soG, beginAtZero: true } } } });

    // Top 10 — maior aging médio (c_agtopcomp)
    const topAvg = cpStats.slice().filter(s => s.n >= 2).sort((a, b) => b.avg - a.avg).slice(0, 10);
    mkChart('c_agtopcomp', { type: 'bar', data: { labels: topAvg.map(s => s.cp), datasets: [{ data: topAvg.map(s => Math.round(s.avg)), backgroundColor: topAvg.map(s => s.avg > 30 ? C.red : s.avg > 15 ? C.amber : C.teal), borderRadius: 18, barPercentage: 1, categoryPercentage: .85 }] }, options: { legendChips: [['≤15d', C.teal], ['16–30d', C.amber], ['>30d', C.red]], indexAxis: 'y', maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => c.parsed.x + 'd médio (' + topAvg[c.dataIndex].n + ' RCs)' } } }, scales: { x: { ...soG, beginAtZero: true }, y: { ...noG, ticks: { font: { size: 10 } } } } } });

    // Mapa de calor — responsável x faixa (heat_aging)
    const rowsH = topVol.map(s => [s.cp, FA.map((fx, fi) => byCp[s.cp].filter(a => faIdx(a) === fi).length), s.n]);
    const mxH = Math.max(1, ...rowsH.flatMap(r => r[1]));
    const cellH = v => { if (!v) return '<td class="cell" style="background:#F2F5F6;color:#9AACB5">·</td>'; const a = .10 + .75 * v / mxH; return `<td class="cell" style="background:rgba(210,55,60,${a.toFixed(2)});color:${a > .5 ? '#FFFFFF' : '#13303F'}">${v}</td>`; };
    document.getElementById('heat_aging').innerHTML = `<table><thead><tr><th class="rl"></th>${FA.map(fx => `<th>${fx[0]}</th>`).join('')}<th>Total</th></tr></thead><tbody>${rowsH.map(r => `<tr><td class="rl">${r[0]}</td>${r[1].map(cellH).join('')}<td class="cell" style="background:#FBD300;color:#1F2933">${r[2]}</td></tr>`).join('') || '<tr><td class="rl" colspan=7 style="color:#46606F">Sem RCs abertas no recorte.</td></tr>'}</tbody></table>`;

    // Volume x aging por responsável (c_agscatter)
    const scat = cpStats.map(s => ({ x: s.n, y: Math.round(s.avg), cp: s.cp }));
    mkChart('c_agscatter', { type: 'scatter', data: { datasets: [{ data: scat, backgroundColor: scat.map(p => p.y > 30 ? C.red : p.y > 15 ? C.amber : C.steel), pointRadius: 6, pointHoverRadius: 8 }] }, options: { maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => scat[c.dataIndex].cp + ': ' + c.parsed.x + ' RCs · ' + c.parsed.y + 'd médio' } } }, scales: { x: { ...soG, beginAtZero: true, title: { display: true, text: 'Volume (RCs abertas)', font: { size: 10 } } }, y: { ...soG, beginAtZero: true, title: { display: true, text: 'Aging médio (dias)', font: { size: 10 } } } } } });

    // Boxplot — variação do aging por comprador (box_aging)
    const quart = (s, p) => { const idx = (s.length - 1) * p, lo = Math.floor(idx), hi = Math.ceil(idx); return s[lo] + (s[hi] - s[lo]) * (idx - lo); };
    const boxComps = cpStats.filter(s => s.n >= 3).sort((a, b) => b.n - a.n).slice(0, 8);
    const gmax = Math.max(1, ...boxComps.flatMap(s => s.ages));
    const W = 460, L = 95, R = W - 14, plot = R - L, sx = v => L + plot * v / gmax, rowH = 26, H = boxComps.length * rowH + 30;
    let svg = `<svg viewBox="0 0 ${W} ${H}" style="width:100%;height:${H}px;font-family:Verdana,sans-serif">
 `;
    [0, .25, .5, .75, 1].forEach(t => { const x = L + plot * t; svg += `<line x1="${x}" y1="20" x2="${x}" y2="${H - 8}" stroke="#E5EBEE"/><text x="${x}" y="14" font-size="9" fill="#46606F" text-anchor="middle">${Math.round(gmax * t)}d</text>`; });
    boxComps.forEach((s, i) => {
        const a = s.ages, q1 = quart(a, .25), md = quart(a, .5), q3 = quart(a, .75), mn = a[0], mx = a[a.length - 1], y = 30 + i * rowH, cy = y + 7;
        svg += `<text x="${L - 6}" y="${cy + 3}" font-size="10.5" fill="#13303F" text-anchor="end">${s.cp}</text>`;
        svg += `<line x1="${sx(mn)}" y1="${cy}" x2="${sx(mx)}" y2="${cy}" stroke="#7A8C97"/><line x1="${sx(mn)}" y1="${cy - 4}" x2="${sx(mn)}" y2="${cy + 4}" stroke="#7A8C97"/><line x1="${sx(mx)}" y1="${cy - 4}" x2="${sx(mx)}" y2="${cy + 4}" stroke="#7A8C97"/>`;
        svg += `<rect x="${sx(q1)}" y="${cy - 7}" width="${Math.max(1, sx(q3) - sx(q1))}" height="14" fill="rgba(90,140,174,.20)" stroke="#35708E"/><line x1="${sx(md)}" y1="${cy - 7}" x2="${sx(md)}" y2="${cy + 7}" stroke="#003865" stroke-width="2"/>`;
    });
    svg += '</svg>';
    document.getElementById('box_aging').innerHTML = boxComps.length ? svg : '<div style="color:#46606F;font-size:12px">Dados insuficientes para boxplot no recorte.</div>';

    // Evolução do tempo de ciclo (c_agevol) — visão geral, ano completo · Contrato e Spot em séries próprias.
    // Usa "tp" (classTipo: Cenário SLA + Tipo, mesma régua dos cartões de meta logo acima) — não a coluna
    // "Tipo" crua (td), que só bate "Contrato"/"Spot" literalmente e deixava a maioria dos Spot (cadastrados
    // como Urgente/MRP/Determinada/Regularização) de fora, esparsando ainda mais as semanas.
    const concl = ALLRC.filter(r => r.st === 'C' && r.dc && r.dl && inYAging(r.dc) && compHit(r) && tpHit(r) && stHit(r)).map(r => ({ w: isoWeek(r.dc), td: r.tp, cyc: bizDaysDiff(r.dl, r.dc) })).filter(r => r.cyc >= 0);
    const byW = {};
    concl.forEach(r => { (byW[r.w] = byW[r.w] || []).push(r.cyc); });
    const wk = Object.keys(byW).sort();
    const byWTD = { Contrato: {}, Spot: {} };
    concl.forEach(r => { if (byWTD[r.td]) (byWTD[r.td][r.w] = byWTD[r.td][r.w] || []).push(r.cyc); });
    // Semana com 1 única RC concluída faz a "média" virar o valor exato daquela RC — inclusive 0d quando
    // é uma conclusão no mesmo dia da liberação (comum em Spot, raro mas real em Contrato). Isso lê como
    // um mergulho real na tendência sem ser um. Exige pelo menos 2 RCs para plotar o ponto; spanGaps
    // (já ligado nos dois datasets) interpola por cima das semanas sem dado suficiente.
    const avgCyc = (td, w) => { const a = byWTD[td][w]; return a && a.length >= 2 ? Math.round(a.reduce((x, y) => x + y, 0) / a.length) : null; };
    mkChart('c_agevol', { type: 'line', plugins: [crosshair], data: { labels: wk.map(wkLabel), datasets: [
        { label: 'Contrato', data: wk.map(w => avgCyc('Contrato', w)), borderColor: C.purple, backgroundColor: 'rgba(0,56,101,.10)', fill: true, tension: .3, borderWidth: 2, pointRadius: 0, pointHoverRadius: 5, pointHoverBackgroundColor: C.purple, spanGaps: true },
        { label: 'Spot', data: wk.map(w => avgCyc('Spot', w)), borderColor: C.steel, backgroundColor: 'rgba(90,140,174,.14)', fill: true, tension: .3, borderWidth: 2, pointRadius: 0, pointHoverRadius: 5, pointHoverBackgroundColor: C.steel, spanGaps: true }
    ] }, options: { maintainAspectRatio: false, interaction: { mode: 'index', intersect: false }, plugins: { legend: { position: 'top', labels: { boxWidth: 12, usePointStyle: true, font: { size: 10 } } }, tooltip: { mode: 'index', intersect: false, callbacks: { label: c => c.dataset.label + ': ' + c.parsed.y + 'd' } } }, scales: { x: { ...noG, ticks: { maxTicksLimit: 10, font: { size: 8 } } }, y: { ...soG, beginAtZero: true } } } });

    // Evolução dos itens críticos >30d (c_agcrit)
    const critW = {};
    concl.forEach(r => { if (r.cyc > 30) critW[r.w] = (critW[r.w] || 0) + 1; });
    mkChart('c_agcrit', { type: 'line', plugins: [crosshair], data: { labels: wk.map(wkLabel), datasets: [{ label: 'Ciclo >30d', data: wk.map(w => critW[w] || 0), borderColor: C.red, backgroundColor: 'rgba(210,55,60,.10)', fill: true, tension: .3, borderWidth: 2, pointRadius: 0, pointHoverRadius: 5, pointHoverBackgroundColor: C.red }] }, options: { maintainAspectRatio: false, interaction: { mode: 'index', intersect: false }, plugins: { legend: { display: false }, tooltip: { mode: 'index', intersect: false } }, scales: { x: { ...noG, ticks: { maxTicksLimit: 10, font: { size: 8 } } }, y: { ...soG, beginAtZero: true } } } });

    // Funil — aging por etapa do processo (funnel_aging)
    const et = {};
    ag.forEach(r => { const e = r.et.replace(/^\d+\.?\s*/, '').slice(0, 28) || 'N/D'; et[e] = (et[e] || 0) + 1; });
    const eta = Object.entries(et).sort((a, b) => b[1] - a[1]).slice(0, 8);
    const mxE = Math.max(1, ...eta.map(x => x[1]));
    document.getElementById('funnel_aging').innerHTML = eta.map((x, i) => { const w = Math.max(16, Math.round(x[1] / mxE * 100)); return `<div style="display:flex;align-items:center;gap:10px;margin:5px 0"><div title="${x[0]}" style="width:180px;flex:0 0 180px;font-size:11px;text-align:right;color:#46606F;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${x[0]}</div><div style="height:26px;width:${w}%;background:hsl(205,${48 - i * 2}%,${28 + i * 3}%);border-radius:4px;display:flex;align-items:center;justify-content:center;color:#FFFFFF;font-size:11px;font-weight:700;min-width:32px">${x[1]}</div></div>`; }).join('') || '<div style="color:#46606F;font-size:12px">Sem RCs abertas no recorte.</div>';

    // Tabela detalhada — semáforo de aging (t_aging)
    const sevAg = r => sevOpen(r);
    const tabAll = ALLRC.filter(r => (r.st === 'A' || r.st === 'C') && r.dl && periodHitAging(r.dl) && compHit(r) && tpHit(r) && stHit(r)).map(r => { const isOpen = r.st === 'A'; const age = isOpen ? bizDaysDiff(r.dl, HOJE) : (r.dc ? bizDaysDiff(r.dl, r.dc) : null); return { ...r, age, isOpen }; }).filter(r => r.age != null && r.age > 0);
    const tab = tabAll.slice().sort((a, b) => b.age - a.age).slice(0, 40);
    document.querySelector('#t_aging tbody').innerHTML = tab.map(r => { const s = sevAg(r); const stBadge = `<span class="tag-sev" style="background:${r.isOpen ? '#E1EDF5' : '#DFF2EA'};color:${r.isOpen ? '#0E538C' : '#14705A'}">${r.isOpen ? 'Em Aberto' : 'Concluída'}</span>`; return `<tr><td>${r.rc || '-'}</td><td>${r.it || '-'}</td><td>${r.cp}</td><td>${stBadge}</td><td>${r.et.replace(/^\d+\.?\s*/, '') || '-'}</td><td class="num">${r.sa || '-'}</td><td class="num">${r.age}</td><td><span class="farol ${s[2]}"></span><span class="tag-sev ${s[0]}">${s[1]}</span></td></tr>`; }).join('') || '<tr><td colspan=8 style="color:#46606F">Nenhuma RC no recorte.</td></tr>';

    // Leitura (texto de insight)
    const critSem = ag.filter(r => sevAg(r)[1] === 'Crítico').length;
    document.getElementById('ins-aging').innerHTML = `<b>Leitura:</b> das <b>${ag.length} RCs em aberto</b> — que são a base de todos os gráficos desta aba — mediana <b>${med}d</b> vs média <b>${avg}d</b>: a maioria flui, mas <b>${crit} passam de 30 dias</b> e <b>${critSem}</b> estão em criticidade frente ao SLA alvo. ${topAvg.length ? `Maior aging médio: <b>${topAvg[0].cp}</b> (${Math.round(topAvg[0].avg)}d). ` : ''}Os cartões de meta no topo têm outra régua: entram também as <b>${gSt.n - gSt.open} RCs já concluídas</b> com o tempo de ciclo delas, por isso o "Aging médio — Geral" (${gSt.avg}d) fica abaixo do aging só das abertas (${gSt.avgOpen}d). Use o funil e o backlog por mês para priorizar a limpeza da carteira.${mesAcumulado ? ` <b>Acumulado:</b> os cartões de meta somam desde jan/2026 até ${mLabel(STATE.mes)} (não só o mês selecionado) — reflete a tendência do ano até ali.` : ''}${agDivergentes ? ` <b style="color:#8A6D00">⚠ ${agDivergentes} RC(s) com aging divergente entre itens</b> no cálculo de meta Geral/Contrato/Spot — usado o maior aging de cada uma, para controle de qualidade.` : ''}`;
    SUM.aging = { open: gSt.open, openTotal: openItemsTotal, avg: gSt.avg, meta: STATE.metaAgG, crit, faixaLabels: FA.map(x => x[0]), faixaCounts: f, faixaColors: FCOL, con: { open: cSt.open, avg: cSt.avg, meta: STATE.metaAgC, pct: cPct }, spo: { open: sSt.open, avg: sSt.avg, meta: STATE.metaAgS, pct: sPct }, gpct: gPct, matLabels: MSag, matQ: msAgQ, matAvg: msAgAvg };
}
function renderSLA() {
    const stAberto = STATE.st === 'A';
    const pnlTrend = document.getElementById('pnl_slatrend'), pnlAberto = document.getElementById('pnl_slaaberto');
    if (pnlTrend) pnlTrend.style.display = stAberto ? 'none' : '';
    if (pnlAberto) pnlAberto.style.display = stAberto ? '' : 'none';

    // KPIs — aderência ao SLA (kpi-sla)
    // Apuração POR ITEM DE RC (ALL, não ALLRC) — é a mesma unidade do BI "Gestão à Vista" e da coluna
    // "SLA Status" da planilha. Consolidar por RC dava um número sistematicamente menor, porque a regra
    // "qualquer item fora ⇒ RC fora" transformava cada item dentro do prazo de uma RC mista em fora.
    // SLA Real negativo (Data Liberação posterior à Data de Conclusão na base) fica fora da conta — não há
    // aderência a apurar —, mas o total descartado aparece no KPI e na leitura em vez de sumir sem rastro.
    const baseBruta = ALL.filter(r => r.st === 'C' && r.dc && r.dc >= DATA_INI_SLA && inY(r.dc) && periodHit(r.dc) && compHit(r) && tpHit(r) && stHit(r) && (r.ss === 'I' || r.ss === 'F') && slaHit(r));
    const base = baseBruta.filter(r => r.sr >= 0);
    const srNegN = baseBruta.length - base.length;
    const ins = base.filter(r => r.ss === 'I').length, foraR = base.filter(r => r.ss === 'F'), fora = foraR.length, tot = ins + fora, pct = tot ? ins / tot * 100 : 0;
    const cor = pct >= 90 ? 'good' : pct >= 80 ? 'warn' : 'bad';
    const atrasos = foraR.map(r => r.sr - r.sa).filter(d => d > 0);
    const atrMed = atrasos.length ? Math.round(atrasos.reduce((a, b) => a + b, 0) / atrasos.length) : 0;
    let wk = [], bw = {};

    if (stAberto) {
        // Status = Em Aberto: a base de concluídas fica vazia (contraditória com o filtro), então o recorte
        // vira um "corte de hoje" das RCs abertas — projeta a severidade atual (sevOpen) como se cada uma
        // fosse concluída agora, e mostra o efeito disso sobre o % dentro do SLA (baseline: concluídas no
        // recorte de Período/Tipo/Comprador, sem o filtro de Status, que serve só de referência aqui)
        const baseConcl = ALL.filter(r => r.st === 'C' && r.dc && r.dc >= DATA_INI_SLA && inY(r.dc) && periodHit(r.dc) && compHit(r) && tpHit(r) && (r.ss === 'I' || r.ss === 'F') && r.sr >= 0 && slaHit(r));
        const insConcl = baseConcl.filter(r => r.ss === 'I').length, totConcl = baseConcl.length, pctConcl = totConcl ? insConcl / totConcl * 100 : 0;
        const openSla = ALLRC.filter(r => r.st === 'A' && r.dl && r.dl >= DATA_INI_AGING && periodHit(r.dl) && compHit(r) && tpHit(r) && slaHit(r))
            .map(r => ({ ...r, age: bizDaysDiff(r.dl, HOJE), sev: sevOpen(r) }))
            .filter(r => r.age > 0);
        const critN = openSla.filter(r => r.sev[1] === 'Crítico').length, insOpen = openSla.length - critN;
        const pctOpen = openSla.length ? insOpen / openSla.length * 100 : 0;
        const totComb = totConcl + openSla.length, pctComb = totComb ? (insConcl + insOpen) / totComb * 100 : 0;
        const delta = pctComb - pctConcl;
        const atrasosOpen = openSla.filter(r => r.sev[1] === 'Crítico').map(r => r.sr - (r.sa > 0 ? r.sa : 15));
        const atrMedOpen = atrasosOpen.length ? Math.round(atrasosOpen.reduce((a, b) => a + b, 0) / atrasosOpen.length) : 0;

        kpi('kpi-sla', [
            { l: '% dentro do SLA (concluídas)', v: totConcl ? pctConcl.toFixed(1) + '%' : '—', n: totConcl + ' concluídas no recorte · referência, sem o filtro de Status' },
            { l: 'RCs em aberto no recorte', v: openSla.length.toLocaleString('pt-BR'), n: 'corte de hoje' },
            { l: '% dentro se fechassem hoje', v: openSla.length ? pctOpen.toFixed(1) + '%' : '—', c: openSla.length ? (pctOpen >= 90 ? 'good' : pctOpen >= 80 ? 'warn' : 'bad') : '', n: critN + ' já fora do SLA Alvo' + (atrMedOpen ? ' · atraso médio ' + atrMedOpen + 'd' : '') },
            { l: 'Efeito no SLA geral', v: totComb ? (delta >= 0 ? '+' : '') + delta.toFixed(1) + 'pp' : '—', c: delta >= 0 ? 'good' : 'bad', n: totComb ? 'projeção combinada: ' + pctComb.toFixed(1) + '%' : 'sem base para projeção' }
        ]);

        document.getElementById('sum_sla_aberto').innerHTML = openSla.length ? `<b>${openSla.length}</b> RC${openSla.length > 1 ? 's' : ''} em aberto no recorte · <b>${critN}</b> já fora do SLA Alvo (${(100 - pctOpen).toFixed(1)}%)${atrMedOpen ? `, atraso médio de <b>${atrMedOpen}d</b>` : ''}${totConcl ? ` · se todas fechassem hoje, o % dentro do SLA iria de <b>${pctConcl.toFixed(1)}%</b> para <b>${pctComb.toFixed(1)}%</b>` : ''}.` : 'Nenhuma RC em aberto no recorte.';

        mkChart('c_slaaberto', { type: 'bar', data: { labels: ['Atual (só concluídas)', 'Projetado (+ abertas, se fechassem hoje)'], datasets: [{ data: [totConcl ? +pctConcl.toFixed(1) : 0, totComb ? +pctComb.toFixed(1) : 0], backgroundColor: [C.steel, delta >= 0 ? C.teal : C.red], borderRadius: 18 }] }, options: { indexAxis: 'y', maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => c.parsed.x.toFixed(1) + '%' } } }, scales: { x: { ...soG, min: 0, max: 100, ticks: { callback: v => v + '%' } }, y: noG } } });
    } else {
        kpi('kpi-sla', [{ l: '% dentro do SLA', v: pct.toFixed(1) + '%', c: cor, p: pct >= 90 ? 'meta 90%' : pct >= 80 ? '80%' : '<80%', pc: pct >= 90 ? 'p-good' : pct >= 80 ? 'p-warn' : 'p-bad' }, { l: 'Base avaliada', v: tot.toLocaleString('pt-BR'), n: 'itens de RC concluídos desde abr/2026' + (srNegN ? ` · ${srNegN} fora da conta (SLA Real negativo)` : '') }, { l: 'Fora do SLA', v: fora.toLocaleString('pt-BR'), c: 'bad', n: tot ? (100 - pct).toFixed(1) + '%' : '' }, { l: 'Atraso médio', v: atrMed + 'd', c: 'warn', n: 'além do alvo (Fora)' }]);

        // Evolução do % dentro do SLA (c_slatrend) — segue o filtro de Período: Geral mantém o ano por
        // semana; Mês restringe ao mês selecionado (ainda por semana); Semana/Atual muda a granularidade p/ dia
        const trendPorDia = STATE.modo === 'semana' || STATE.modo === 'atual';
        const baseTrend = ALL.filter(r => r.st === 'C' && r.dc && r.dc >= DATA_INI_SLA && inY(r.dc) && compHit(r) && tpHit(r) && stHit(r) && (r.ss === 'I' || r.ss === 'F') && r.sr >= 0 && slaHit(r) && periodHit(r.dc));
        baseTrend.forEach(r => { const k = trendPorDia ? ymdKey(r.dc) : isoWeek(r.dc); (bw[k] = bw[k] || { i: 0, t: 0 }); bw[k].t++; if (r.ss === 'I') bw[k].i++; });
        wk = Object.keys(bw).sort();
        const wkLbl = trendPorDia ? ymdLabel : wkLabel;
        mkChart('c_slatrend', { type: 'line', plugins: [crosshair], data: { labels: wk.map(w => wkLbl(w)), datasets: [{ label: '% dentro', data: wk.map(w => Math.round(bw[w].i / bw[w].t * 100)), borderColor: C.blue, backgroundColor: 'rgba(14,83,140,.08)', fill: true, tension: .3, borderWidth: 2, pointRadius: 0, pointHoverRadius: 5, pointHoverBackgroundColor: C.blue }, { label: 'Meta 150% (90%)', data: wk.map(() => 90), borderColor: C.teal, borderDash: [6, 4], borderWidth: 1.4, pointRadius: 0, pointHoverRadius: 4, pointHoverBackgroundColor: C.teal, fill: false }, { label: 'Meta 100% (80%)', data: wk.map(() => 80), borderColor: C.amber, borderDash: [6, 4], borderWidth: 1.3, pointRadius: 0, pointHoverRadius: 4, pointHoverBackgroundColor: C.amber, fill: false }, { label: 'Meta 90% (75%)', data: wk.map(() => 75), borderColor: C.red, borderDash: [6, 4], borderWidth: 1.2, pointRadius: 0, pointHoverRadius: 4, pointHoverBackgroundColor: C.red, fill: false }] }, options: { maintainAspectRatio: false, interaction: { mode: 'index', intersect: false }, plugins: { legend: { position: 'top', labels: { boxWidth: 12, usePointStyle: true, font: { size: 10 } } }, tooltip: { mode: 'index', intersect: false } }, scales: { x: { ...noG, ticks: { font: { size: 9 } } }, y: { ...soG, min: 0, max: 100, ticks: { callback: v => v + '%' } } } } });
    }

    // Gravidade do atraso por faixa (c_slafaixa)
    const gf = { '1-7': 0, '8-15': 0, '16-30': 0, '>30': 0 };
    foraR.forEach(r => { const d = r.sr - r.sa; if (d <= 0) return; if (d <= 7) gf['1-7']++; else if (d <= 15) gf['8-15']++; else if (d <= 30) gf['16-30']++; else gf['>30']++; });
    mkChart('c_slafaixa', { type: 'bar', data: { labels: Object.keys(gf), datasets: [{ data: Object.values(gf), backgroundColor: ['#E9C400', '#C79100', '#D2373C', '#8F1F23'], borderRadius: 18 }] }, options: { maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: noG, y: { ...soG, beginAtZero: true } } } });

    // Pareto — principais causas de atraso (c_pareto)
    const gc = {};
    foraR.forEach(r => { const k = r.gar || 'N/D'; if (k === 'N/D') return; gc[k] = (gc[k] || 0) + 1; });
    const par = Object.entries(gc).sort((a, b) => b[1] - a[1]);
    const tt = par.reduce((a, x) => a + x[1], 0);
    let cum = 0;
    const cumv = par.map(x => { cum += x[1]; return Math.round(cum / tt * 100); });
    mkChart('c_pareto', { data: { labels: par.map(x => x[0]), datasets: [{ type: 'bar', data: par.map(x => x[1]), backgroundColor: C.steel, borderRadius: 18, order: 2, yAxisID: 'y' }, { type: 'line', data: cumv, borderColor: '#003865', borderWidth: 2, pointRadius: 3, pointBackgroundColor: '#003865', order: 1, yAxisID: 'y1', tension: .2 }] }, options: { maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { ...noG, ticks: { font: { size: 9 }, maxRotation: 40, minRotation: 30 } }, y: { ...soG, beginAtZero: true, position: 'left' }, y1: { position: 'right', min: 0, max: 100, grid: { display: false }, ticks: { callback: v => v + '%' } } } } });

    // Mapa de calor — criticidade por comprador x faixa (heat)
    const HF = [['1-7', 1, 7], ['8-15', 8, 15], ['16-30', 16, 30], ['>30', 31, 9999]];
    const hc = {};
    foraR.forEach(r => { const d = r.sr - r.sa; if (d <= 0) return; const ci = HF.findIndex(f => d >= f[1] && d <= f[2]); if (ci < 0) return; (hc[r.cp] = hc[r.cp] || [0, 0, 0, 0])[ci]++; });
    const rowsH = Object.entries(hc).map(([c, a]) => [c, a, a[0] + a[1] + a[2] + a[3]]).sort((a, b) => b[2] - a[2]).slice(0, 12);
    const mx = Math.max(1, ...rowsH.flatMap(r => r[1]));
    const cell = v => { if (!v) return `<td class="cell" style="background:#F2F5F6;color:#9AACB5">·</td>`; const a = .10 + .75 * v / mx; return `<td class="cell" style="background:rgba(210,55,60,${a.toFixed(2)});color:${a > .5 ? '#FFFFFF' : '#13303F'}">${v}</td>`; };
    document.getElementById('heat').innerHTML = `<table><thead><tr><th class="rl"></th>${HF.map(f => `<th>${f[0]} d</th>`).join('')}<th>Total</th></tr></thead><tbody>${rowsH.map(r => `<tr><td class="rl">${r[0]}</td>${r[1].map(cell).join('')}<td class="cell" style="background:#FBD300;color:#1F2933">${r[2]}</td></tr>`).join('') || '<tr><td class="rl" colspan=6 style="color:#46606F">Sem itens fora do SLA no recorte.</td></tr>'}</tbody></table>`;

    // Material x Serviço — acumulado e %SLA (c_msacum, c_mssla)
    const MS = ['Material', 'Serviço'];
    const msV = MS.map(c => base.filter(r => r.cl === c).length);
    mkChart('c_msacum', { type: 'bar', data: { labels: MS, datasets: [{ data: msV, backgroundColor: [C.steel, C.blue], borderRadius: 18 }] }, options: { indexAxis: 'y', maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => c.parsed.x.toLocaleString('pt-BR') + ' RCs' } } }, scales: { x: { ...soG, beginAtZero: true }, y: noG } } });
    const msP = MS.map(c => { const b = base.filter(r => r.cl === c); const t = b.length, i = b.filter(r => r.ss === 'I').length; return t ? Math.round(i / t * 100) : 0; });
    mkChart('c_mssla', { type: 'bar', data: { labels: MS, datasets: [{ data: msP, backgroundColor: msP.map(p => p >= 90 ? C.teal : p >= 80 ? '#FBD300' : p >= 75 ? '#C79100' : C.red), borderRadius: 18 }] }, options: { indexAxis: 'y', maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => c.parsed.x + '%' } } }, scales: { x: { ...soG, min: 0, max: 100, ticks: { callback: v => v + '%' } }, y: noG } } });

    // % Dentro e TMA por Cenário — Contrato × Spot, separado por Material/Serviço (t_tma_mat, t_tma_serv)
    const tmaRows = tipoRows => {
        const g = { Contrato: {}, Spot: {} };
        tipoRows.forEach(r => {
            if (r.tp !== 'Contrato' && r.tp !== 'Spot') return;
            const k = r.cen || 'N/D';
            const o = (g[r.tp][k] = g[r.tp][k] || { n: 0, i: 0, sr: 0 });
            o.n++; if (r.ss === 'I') o.i++; o.sr += r.sr || 0;
        });
        let rowsHTML = '';
        ['Contrato', 'Spot'].forEach(tipo => {
            const cens = Object.keys(g[tipo]).sort((a, b) => g[tipo][b].n - g[tipo][a].n);
            cens.forEach((cen, ci) => {
                const o = g[tipo][cen], pct = o.n ? o.i / o.n * 100 : 0, tma = o.n ? Math.round(o.sr / o.n) : 0;
                const col = pct >= 90 ? 'var(--good)' : pct >= 80 ? '#FBD300' : pct >= 75 ? '#C79100' : 'var(--bad)';
                rowsHTML += `<tr>${ci === 0 ? `<td rowspan="${cens.length}"><b>${tipo}</b></td>` : ''}<td>${cen}</td><td class="num" style="color:${col};font-weight:700">${pct.toFixed(1)}%</td><td class="num">${tma}d</td></tr>`;
            });
        });
        return rowsHTML || '<tr><td colspan="4" style="color:var(--muted)">Sem dados no recorte.</td></tr>';
    };
    document.querySelector('#t_tma_mat tbody').innerHTML = tmaRows(base.filter(r => r.cl === 'Material'));
    document.querySelector('#t_tma_serv tbody').innerHTML = tmaRows(base.filter(r => r.cl === 'Serviço'));

    // % dentro do SLA por comprador (c_slacomp)
    const bc = {};
    base.forEach(r => { (bc[r.cp] = bc[r.cp] || { i: 0, t: 0 }); bc[r.cp].t++; if (r.ss === 'I') bc[r.cp].i++; });
    const ca = Object.entries(bc).filter(x => x[1].t >= 5).map(x => [x[0], x[1].i / x[1].t * 100, x[1].t]).sort((a, b) => a[1] - b[1]);
    mkChart('c_slacomp', { type: 'bar', data: { labels: ca.map(x => x[0]), datasets: [{ data: ca.map(x => Math.round(x[1])), backgroundColor: ca.map(x => x[1] >= 90 ? C.teal : x[1] >= 80 ? '#FBD300' : x[1] >= 75 ? '#C79100' : C.red), borderRadius: 18, barPercentage: 1, categoryPercentage: .85 }] }, options: { legendChips: [['≥90%', C.teal], ['80–90%', '#FBD300'], ['75–80%', '#C79100'], ['<75%', C.red]], indexAxis: 'y', maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => c.parsed.x + '% (' + ca[c.dataIndex][2] + ' itens)' } } }, scales: { x: { ...soG, min: 0, max: 100, ticks: { callback: v => v + '%' } }, y: { ...noG, ticks: { font: { size: 10 } } } } } });

    // Tabela detalhada — itens críticos por farol (t_crit). Uma linha por item de RC, mesma unidade do
    // KPI: a mesma RC pode aparecer mais de uma vez se tiver vários itens fora do alvo, cada um com o
    // próprio atraso — por isso a coluna Item.
    const sev = d => d > 15 ? ['f-rd', 's-rd', 'Crítico'] : d > 7 ? ['f-or', 's-or', 'Além do normal'] : ['f-am', 's-am', 'Fora do prazo'];
    const crit = foraR.map(r => ({ ...r, atr: r.sr - r.sa })).filter(r => r.atr > 0).sort((a, b) => b.atr - a.atr).slice(0, 40);
    document.querySelector('#t_crit tbody').innerHTML = crit.map(r => { const s = sev(r.atr); return `<tr><td>${r.rc || '-'}</td><td class="num">${r.it || '-'}</td><td>${r.cp}</td><td>Concluída</td><td class="num">${r.atr}</td><td><span class="farol ${s[0]}"></span><span class="tag-sev ${s[1]}">${s[2]}</span></td></tr>`; }).join('') || '<tr><td colspan=6 style="color:#46606F">Sem itens fora do SLA no recorte.</td></tr>';

    // Leitura (texto de insight)
    const pior = ca[0], melhor = ca[ca.length - 1], topcause = par[0];
    document.getElementById('ins-sla').innerHTML = tot ? `<b>Leitura:</b> aderência de <b>${pct.toFixed(1)}%</b> (meta 90%), atraso médio de <b>${atrMed} dias</b> quando fura. ${topcause ? `A maior causa de atraso é <b>${topcause[0]}</b> (${Math.round(topcause[1] / tt * 100)}% dos casos). ` : ''}${ca.length > 1 ? `Dispersão: ${melhor[0]} em ${melhor[1].toFixed(0)}% contra ${pior[0]} em ${pior[1].toFixed(0)}%. ` : ''}A apuração é por item de RC e a partir de abr/2026 — a mesma unidade e o mesmo recorte do BI "Gestão à Vista". Use a tabela-farol para agir nas críticas.${srNegN ? ` <b style="color:#8A6D00">⚠ ${srNegN} ${srNegN > 1 ? 'itens ficaram' : 'item ficou'} fora da apuração</b> por trazer SLA Real negativo — Data Liberação posterior à Data de Conclusão na base. Corrija as datas na planilha para que ${srNegN > 1 ? 'voltem' : 'volte'} à conta.` : ''}` : '<b>Sem itens concluídos no recorte (desde abr/2026).</b>';
    SUM.sla = { pct, tot, fora, atrMed, crit: foraR.filter(r => r.sr - r.sa > 15).length, weeks: wk.map(wkLabel), weekly: wk.map(w => bw[w] ? Math.round(bw[w].i / bw[w].t * 100) : 0), matLabels: MS, matQ: msV, matPct: msP };
}
function renderSaving() {
    // KPIs — saving e taxa de economia (kpi-saving)
    const base = ALL.filter(r => r.vp > 0 && r.vn > 0 && r.st !== 'X' && r.st !== 'D' && periodHit(r.dc) && compHit(r) && tpHit(r) && stHit(r));
    const tot = base.reduce((a, r) => a + (r.vp - r.vn), 0), prop = base.reduce((a, r) => a + r.vp, 0), taxa = prop ? tot / prop * 100 : 0;
    kpi('kpi-saving', [{ l: 'Saving total', v: Kf(tot), c: tot >= 0 ? 'good' : 'bad', n: BRL(tot) }, { l: 'Taxa de economia', v: taxa.toFixed(1) + '%', c: taxa >= 0 ? 'good' : 'bad', n: taxa >= 0 ? 'sobre 1ª proposta' : 'prejuízo sobre 1ª proposta' }, { l: 'Itens com saving', v: base.length.toLocaleString('pt-BR'), n: '1ª prop. e negociado' }, { l: 'Base negociada', v: Kf(prop), n: BRL(prop) }]);

    // Saving por semana (c_savsem)
    const bw = {};
    base.forEach(r => { if (!r.dc) return; const w = isoWeek(r.dc); bw[w] = (bw[w] || 0) + (r.vp - r.vn); });
    const wk = Object.keys(bw).sort();
    mkChart('c_savsem', { type: 'bar', data: { labels: wk.map(w => wkLabel(w)), datasets: [{ data: wk.map(w => bw[w]), backgroundColor: C.teal, borderRadius: 18 }] }, options: { maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => BRL(c.parsed.y) } } }, scales: { x: { ...noG, ticks: { maxTicksLimit: 13, font: { size: 8 } } }, y: { ...soG, beginAtZero: true, ticks: { callback: Kf } } } } });

    // Saving por categoria (c_savcat)
    const bca = {};
    base.forEach(r => { const c = r.cat || ''; if (!c) return; bca[c] = (bca[c] || 0) + (r.vp - r.vn); });
    const cat = Object.entries(bca).sort((a, b) => b[1] - a[1]).slice(0, 10);
    mkChart('c_savcat', { type: 'bar', data: { labels: cat.map(x => x[0].slice(0, 18)), datasets: [{ data: cat.map(x => x[1]), backgroundColor: C.steel, borderRadius: 18 }] }, options: { indexAxis: 'y', maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => BRL(c.parsed.x) } } }, scales: { x: { ...soG, ticks: { callback: Kf } }, y: { ...noG, ticks: { font: { size: 9 } } } } } });

    // Saving por comprador (c_savcomp)
    const bcc = {};
    base.forEach(r => { bcc[r.cp] = (bcc[r.cp] || 0) + (r.vp - r.vn); });
    const co = Object.entries(bcc).sort((a, b) => b[1] - a[1]).slice(0, 12);
    mkChart('c_savcomp', { type: 'bar', data: { labels: co.map(x => x[0]), datasets: [{ data: co.map(x => x[1]), backgroundColor: co.map(x => x[0] === STATE.comp ? C.accent : C.green), borderRadius: 18, barPercentage: 1, categoryPercentage: .85 }] }, options: { legendChips: [['Saving', C.green], ['Selecionado', C.accent]], indexAxis: 'y', maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => BRL(c.parsed.x) } } }, scales: { x: { ...soG, ticks: { callback: Kf } }, y: noG } } });

    // Pareto — categorias que geram 80% do saving (c_savpareto)
    const gcS = {};
    base.forEach(r => { const k = (r.cat || '').trim() || 'N/D'; gcS[k] = (gcS[k] || 0) + (r.vp - r.vn); });
    const parS = Object.entries(gcS).filter(x => x[1] > 0).sort((a, b) => b[1] - a[1]);
    const ttS = parS.reduce((a, x) => a + x[1], 0);
    let cumS = 0, n80 = 0, hit80 = false;
    const cumvS = parS.map(x => { cumS += x[1]; const p = ttS ? Math.round(cumS / ttS * 100) : 0; if (!hit80) { n80++; if (p >= 80) hit80 = true; } return p; });
    mkChart('c_savpareto', {
        data: {
            labels: parS.map(x => x[0].slice(0, 16)), datasets: [
                { type: 'bar', label: 'Saving (R$)', data: parS.map(x => x[1]), backgroundColor: C.teal, borderRadius: 18, order: 2, yAxisID: 'y' },
                { type: 'line', label: '% acumulado', data: cumvS, borderColor: '#003865', borderWidth: 2, pointRadius: 3, pointBackgroundColor: '#003865', order: 1, yAxisID: 'y1', tension: .2 },
                { type: 'line', label: 'Meta 80%', data: parS.map(() => 80), borderColor: C.amber, borderDash: [5, 4], borderWidth: 1.4, pointRadius: 0, order: 0, yAxisID: 'y1' }
            ]
        }, options: { maintainAspectRatio: false, plugins: { legend: { position: 'top', labels: { boxWidth: 11, usePointStyle: true, font: { size: 9.5 } } }, tooltip: { callbacks: { label: c => c.datasetIndex === 0 ? BRL(c.parsed.y) : c.parsed.y + '%' } } }, scales: { x: { ...noG, ticks: { font: { size: 9 }, maxRotation: 40, minRotation: 30 } }, y: { ...soG, beginAtZero: true, position: 'left', ticks: { callback: Kf } }, y1: { position: 'right', min: 0, max: 100, grid: { display: false }, ticks: { callback: v => v + '%' } } } }
    });

    // Saving x Volume de compras — matriz por categoria (c_savmatrix)
    const byCatS = {};
    base.forEach(r => { const c = (r.cat || '').trim() || 'N/D'; const o = byCatS[c] = byCatS[c] || { vol: 0, prop: 0, neg: 0 }; o.vol += (r.vl || r.vp || 0); o.prop += r.vp; o.neg += r.vn; });
    const matArr = Object.entries(byCatS).map(([c, o]) => ({ c, vol: o.vol, pct: o.prop ? (o.prop - o.neg) / o.prop * 100 : 0 }));
    const volsSorted = matArr.map(x => x.vol).sort((a, b) => a - b), medVol = volsSorted.length ? volsSorted[Math.floor(volsSorted.length / 2)] : 0;
    mkChart('c_savmatrix', { type: 'scatter', data: { datasets: [{ data: matArr.map(x => ({ x: x.vol, y: x.pct })), backgroundColor: matArr.map(x => x.vol >= medVol && x.pct < taxa ? '#C79100' : C.steel), pointRadius: 7, pointHoverRadius: 9 }] }, options: { maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => { const p = matArr[c.dataIndex]; return p.c + ': ' + BRL(p.vol) + ' · ' + p.pct.toFixed(1) + '% saving'; } } } }, scales: { x: { ...soG, beginAtZero: true, title: { display: true, text: 'Volume de compras (R$)', font: { size: 10 } }, ticks: { callback: Kf } }, y: { ...soG, title: { display: true, text: '% de saving', font: { size: 10 } }, ticks: { callback: v => v + '%' } } } } });

    // Formação do saving — waterfall Proposta → Negociado (c_savwaterfall)
    const totP = base.reduce((a, r) => a + r.vp, 0), totN = base.reduce((a, r) => a + r.vn, 0), totS = totP - totN;
    const groundedRadius = { topLeft: 18, topRight: 18, bottomLeft: 0, bottomRight: 0 };
    mkChart('c_savwaterfall', { type: 'bar', data: { labels: ['1ª Proposta', 'Saving', 'Negociado'], datasets: [{ data: [[0, totP], [totN, totP], [0, totN]], backgroundColor: [C.steel, totS >= 0 ? C.teal : C.red, C.blue], borderRadius: [groundedRadius, 18, groundedRadius], barPercentage: .55 }] }, options: { maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => BRL(c.raw[1] - c.raw[0]) } } }, scales: { x: noG, y: { ...soG, beginAtZero: true, ticks: { callback: Kf } } } } });
    document.getElementById('wf-summary').innerHTML = `1ª Proposta: <b>${BRL(totP)}</b> · Negociado: <b>${BRL(totN)}</b> · Saving: <b>${BRL(totS)}</b> (${taxa.toFixed(1)}%)`;

    // Base detalhada — saving por RC (t_saving)
    const detS = base.map(r => ({ ...r, sv: r.vp - r.vn })).filter(r => r.sv !== 0).sort((a, b) => b.sv - a.sv).slice(0, 40);
    document.querySelector('#t_saving tbody').innerHTML = detS.map(r => `<tr><td>${r.rc || '-'}</td><td>${r.it || '-'}</td><td>${r.cp}</td><td>${(r.cat || '').trim() || 'N/D'}</td><td class="num">${BRL(r.vp)}</td><td class="num">${BRL(r.vn)}</td><td class="num" style="${r.sv < 0 ? 'color:#C0272D' : ''}">${BRL(r.sv)}</td><td class="num" style="${r.sv < 0 ? 'color:#C0272D' : ''}">${r.vp ? Math.round(r.sv / r.vp * 100) : 0}%</td></tr>`).join('') || '<tr><td colspan=8 style="color:#46606F">Sem itens com saving no recorte.</td></tr>';

    // Leitura (texto de insight)
    const topParS = parS[0];
    document.getElementById('ins-saving').innerHTML = base.length ? `<b>Leitura:</b> economia de <b>${BRL(tot)}</b> (taxa <b>${taxa.toFixed(1)}%</b>) em ${base.length} itens no recorte. ${topParS ? `<b>${n80} de ${parS.length} categorias</b> concentram 80% do saving — a maior é <b>${topParS[0]}</b> (${BRL(topParS[1])}). ` : ''}Use a matriz Saving × Volume para achar categorias de alto gasto e baixo retorno.` : '<b>Sem itens com 1ª proposta e valor negociado no recorte.</b>';
    SUM.saving = { total: tot, taxa, itens: base.length, weeks: wk.map(wkLabel), weekly: wk.map(w => bw[w] || 0) };
}
function renderContr() {
    const CCON = '#003865';
    const cartLoaded = CARTEIRAS.length > 0;
    const rootLetter = code => { const m = /^[A-Za-z]/.exec((code || '').trim()); return m ? m[0].toUpperCase() : ''; };

    if (!cartLoaded) {
        document.getElementById('kpi-contr').classList.add('k3');
        kpi('kpi-contr', [{ l: 'Base de Carteiras / Spend', v: 'Não carregada', c: 'warn', n: 'Carregue o 2º arquivo (Spend) para calcular o mix Contrato × Spot' }]);
        document.getElementById('ins-contr').innerHTML = '<b>Carregue a base de carteiras (2º arquivo / Spend) para ver esta aba.</b>';
        SUM.contr = null;
        return;
    }

    // A partir daqui, só Compras Ágeis — é a única Gerência com Gestão à Vista para cruzar/validar carteira
    const cartAgeis = CARTEIRAS.filter(ln => ln.gerFinalNorm === GERENCIA_ALVO);

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
    const resolvedLines = cartAgeis.map(ln => {
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
    // dos dois filtros se aplica aqui
    const base = rcRows.filter(r => r.dt && r.dt >= DATA_INI_AGING && periodHit(r.dt) && tpHit(r));
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

    const kpiContr = [
        { l: 'RCs Contrato', v: nCon.toLocaleString('pt-BR'), n: pctCon.toFixed(0) + '% do recorte' },
        { l: 'RCs Spot', v: nSpo.toLocaleString('pt-BR'), n: pctSpo.toFixed(0) + '% do recorte' },
        { l: 'Material', v: totMS ? Math.round(matSum / totMS * 100) + '%' : '—', n: matSum.toLocaleString('pt-BR') + ' itens' },
        { l: 'Serviço', v: totMS ? Math.round(servSum / totMS * 100) + '%' : '—', n: servSum.toLocaleString('pt-BR') + ' itens' },
        { l: 'Códigos "A" resolvidos', v: aResolvidoCount.toLocaleString('pt-BR') + ' RCs', c: 'good', n: 'Por Pedido ou por RC única' },
        { l: 'Códigos "A" não resolvidos', v: aNaoResolvidoCount.toLocaleString('pt-BR') + ' RCs', c: aNaoResolvidoCount > 0 ? 'warn' : 'good', n: 'Sem correspondência segura na Gestão à Vista' }
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
    cartAgeis.forEach(it => {
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
    const OTH_PAL = [C.teal, C.blue, '#7FE06C', '#E9C400', '#35505E', '#B7D3E8', '#7A8C97', '#8FCDBA', '#CAD6DD'];
    const colorMap = {};
    typeList.forEach((t, i) => { colorMap[t] = t === 'Contrato' ? CCON : t === 'Spot' ? C.steel : t === 'Mista' ? C.amber : t === 'N/D' ? '#CAD6DD' : OTH_PAL[(i - 3) % OTH_PAL.length]; });

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
    const byGCar = {};
    const byGCarA = {};
    // Só Contrato/Spot entram nesses dois gráficos — a coluna Contrato×Spot do Spend não tem outro
    // valor válido, então RC sem um dos dois (ex.: "Mista", item de RC com os dois tipos) não conta.
    base.forEach(r => {
        const t = typeOf(r);
        if (t !== 'Contrato' && t !== 'Spot') return;
        const code = carOf(r);
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
    mkChart('c_ccd_tipo', { type: 'bar', plugins: [stackPctLabels], data: { labels: gCarKeys, volTotals: gCarArr.map(x => x.tot), datasets: typeListG.map(t => ({ label: t, data: gCarArr.map(x => x.tot ? Math.round((x.o[t] || 0) / x.tot * 100) : 0), vol: gCarArr.map(x => x.o[t] || 0), backgroundColor: colorMapG[t], stack: 's' })) }, options: { maintainAspectRatio: false, plugins: { legend: { position: 'top', labels: { boxWidth: 11, usePointStyle: true, font: { size: 10 } } }, tooltip: volTooltip('RCs', i => gCarArr[i] && gCarArr[i].tot) }, scales: { x: { stacked: true, ...noG, ticks: { font: { size: 9 }, maxRotation: 45, minRotation: 35 } }, y: { stacked: true, ...soG, min: 0, max: 100, ticks: { callback: v => v + '%' } } } } });

    // % Contrato × Spot por carteira, uma coluna de gráficos por Coordenação (c_ger_N, dinâmico).
    // Rollup por RC direto do Spend (Car + Contrato/Spot do próprio RC — RC com item de Contrato E
    // Spot ao mesmo tempo, ou nenhum dos dois, fica fora do gráfico, ver filtro abaixo), sem
    // cruzar com a Gestão à Vista. A coluna "Coordenação" do Spend já traz a gerência principal
    // resolvida por RC —
    // inclui as RCs de Compras Ágeis já atribuídas à Coordenação correta, então aqui só agrupa,
    // sem precisar somar/mesclar com Compras Ágeis à parte. Mostra todas as carteiras que
    // aparecerem na Coordenação (sem filtro de lista fixa), ordenadas G > R > S e numérica
    // dentro de cada letra (mesmo critério de gCarArr acima).
    const carBase = CARTEIRAS.filter(ln => ln.dt && ln.dt >= DATA_INI_AGING && periodHit(ln.dt) && tpHit(ln));
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
    // Compras Ágeis sai daqui — já tem gráfico dedicado acima (c_ccd_tipo, "por carteira G/R/S"),
    // sem sentido repetir a mesma Coordenação nesta lista.
    const coordList = Object.entries(coordRCSet).filter(([g]) => nrm(g) !== GERENCIA_ALVO).sort((a, b) => b[1].size - a[1].size).map(x => x[0]);
    const gerCharts = coordList.map((g, gi) => {
        const cars = coordCarStats[g] || {};
        const carKeys = Object.entries(cars).map(([c, o]) => ({ c, o, tot: o.Contrato + o.Spot })).filter(k => k.tot > 0).sort(sortCarKeys);
        return { g, cid: 'c_ger_' + gi, carKeys };
    }).filter(x => x.carKeys.length);

    // Painel "A (raiz)" — mesma estimativa fracionada por G do gráfico principal (byGCarA acima),
    // mas com o Contrato/Spot já conhecido de cada RC (não é estimado, só a carteira G é que é
    // estimada) — entra no mesmo grid das outras Gerências, em amarelo, pra não competir visualmente
    // com o gráfico confirmado por carteira G.
    const ARAIZ_COLORS = { Contrato: '#9C7A00', Spot: '#F2D479' };
    const gCarAArr = Object.entries(byGCarA).map(([c, o]) => ({ c, o, tot: Object.values(o).reduce((a, v) => a + v, 0) })).sort((a, b) => b.tot - a.tot);
    const araizPanel = gCarAArr.length ? { cid: 'c_ccd_tipo_araiz', carArr: gCarAArr } : null;

    document.getElementById('gerfinal-charts').innerHTML = gerCharts.map(x => `<div class="panel" style="margin-bottom:0">
<h3>% Contrato × Spot por carteira — ${x.g}</h3>
<div class="ph">RCs desta Coordenação (já inclui Compras Ágeis, atribuído pela coluna Coordenação do Spend), consolidadas por código de carteira · número acima da coluna é o total de RCs que gera o %, e o número dentro de cada faixa é a contagem daquela faixa</div>
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
    // critério usado no resto da aba. O filtro Escopo troca entre todas as Gerências Finais e só
    // Compras Ágeis — a lista de carteiras é remontada junto, para não sobrar carteira vazia.
    const CART_TBL_MAX = 500;
    const cartTblSel = document.getElementById('f_cart_tbl'), cartTblOrd = document.getElementById('f_cart_ord'), cartTblBody = document.querySelector('#t_cart_forn tbody');
    const cartTblGer = document.getElementById('f_cart_ger');
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
            if (!r) { r = { car, forn: ln.forn || '', rc: ln.rc, rcNorm: ln.rcNorm, pedido: ln.pedido || '', cb: ln.cb || '', ageis: false, tds: new Set() }; byKey.set(k, r); }
            r.tds.add(ln.td || 'N/D');
            if (ln.gerFinalNorm === GERENCIA_ALVO) r.ageis = true;
        });
        const allRows = [...byKey.values()];
        allRows.forEach(r => { r.tipo = tipoDaLinha(r.tds); });
        const byCar = { todas: {}, ageis: {} };
        allRows.forEach(r => {
            (byCar.todas[r.car] = byCar.todas[r.car] || []).push(r);
            if (r.ageis) (byCar.ageis[r.car] = byCar.ageis[r.car] || []).push(r);
        });
        if (cartTblGer) cartTblGer.value = STATE.cartTblGer === 'ageis' ? 'ageis' : 'todas';
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
            const map = byCar[STATE.cartTblGer === 'ageis' ? 'ageis' : 'todas'];
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
            cartTblBody.innerHTML = shown.map(r => `<tr><td>${r.forn || '—'}</td><td>${r.rc}</td><td><span class="tpill ${TIPO_CLS[r.tipo] || 't-nd'}">${r.tipo}</span></td><td>${r.pedido || '—'}</td><td>${r.cb || '—'}</td></tr>`).join('') || '<tr><td colspan="5" style="color:#46606F">Sem linhas para esta carteira no recorte.</td></tr>';
            const st = document.getElementById('cart_tbl_status');
            if (st) {
                const nRC = new Set(rows.map(r => r.rcNorm)).size, nForn = new Set(rows.filter(r => r.forn).map(r => r.forn)).size;
                const nCon = rows.filter(r => r.tipo === 'Contrato').length, nSpo = rows.filter(r => r.tipo === 'Spot').length;
                st.textContent = rows.length ? `${rows.length.toLocaleString('pt-BR')} linhas · ${nRC.toLocaleString('pt-BR')} RCs · ${nForn.toLocaleString('pt-BR')} fornecedores · ${nCon.toLocaleString('pt-BR')} Contrato / ${nSpo.toLocaleString('pt-BR')} Spot${rows.length > CART_TBL_MAX ? ` · mostrando as ${CART_TBL_MAX} primeiras nesta ordenação` : ''}` : 'Sem linhas neste escopo.';
            }
        };
        cartTblSel.onchange = drawCartTbl;
        cartTblOrd.onchange = drawCartTbl;
        if (cartTblGer) cartTblGer.onchange = drawCartTbl;
        drawCartTbl();
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

    // Tabela detalhada — Carteira x Tipo, uma coluna por tipo (t_contr) — ordenada por quantidade de Spot, maior para menor
    const catsBySpot = [...cats].sort((a, b) => (b.o['Spot'] || 0) - (a.o['Spot'] || 0));
    document.querySelector('#t_contr thead').innerHTML = `<tr><th>Carteira/Categoria</th>${typeList.map(t => `<th class="num">${t}</th>`).join('')}<th class="num">Total</th><th class="num">% Contrato</th></tr>`;
    document.querySelector('#t_contr tbody').innerHTML = catsBySpot.map(x => `<tr><td>${x.c}</td>${typeList.map(t => `<td class="num">${x.o[t] || 0}</td>`).join('')}<td class="num">${x.tot}</td><td class="num">${x.tot ? Math.round((x.o['Contrato'] || 0) / x.tot * 100) : 0}%</td></tr>`).join('') || `<tr><td colspan="${typeList.length + 3}" style="color:#46606F">Nenhuma RC no recorte.</td></tr>`;

    // RCs pendentes de resolução (código do Spend ainda "A...", não resolvido por Pedido, Contrato
    // básico nem RC única) — listagem individual pra conferência manual: Grupo Comprador (Sistema),
    // RC, Pedido, Contrato básico.
    const pendA = base
        .filter(r => rootLetter(carOf(r)) === 'A')
        .map(r => ({ a: carOf(r), rc: r.rc, pedido: r.pedido || '', cb: r.cb || '' }))
        .sort((a, b) => a.a.localeCompare(b.a) || ('' + a.rc).localeCompare('' + b.rc));
    const t_gcs = document.querySelector('#t_gcs tbody');
    if (t_gcs) t_gcs.innerHTML = pendA.map(x => `<tr><td>${x.a}</td><td>${x.rc}</td><td>${x.pedido}</td><td>${x.cb}</td></tr>`).join('') || `<tr><td colspan="4" style="color:#46606F">Nenhuma RC pendente de resolução no recorte.</td></tr>`;

    // Leitura (texto de insight) — alerta sobre os pontos de qualidade de dado exigidos: código "A"
    // não resolvido, carteira divergente, Pedido conflitante, RC ambígua e registros N/D
    const topCat = cats[0], nd = byCat['N/D'], ndTot = nd ? Object.values(nd).reduce((a, v) => a + v, 0) : 0;
    const topOther = typesOther.find(t => t !== 'N/D');
    const alerts = [];
    if (aNaoResolvidoCount) alerts.push(`${aNaoResolvidoCount} RCs com código "A" não resolvido`);
    if (divergCount) alerts.push(`${divergCount} RCs com carteira divergente`);
    if (pedidoConflitanteCount) alerts.push(`${pedidoConflitanteCount} Pedidos conflitantes`);
    if (rcAmbiguaCount) alerts.push(`${rcAmbiguaCount} RCs ambíguas`);
    if (ndTot) alerts.push(`${ndTot} RCs (${Math.round(ndTot / base.length * 100)}%) sem Carteira/Categoria`);
    document.getElementById('ins-contr').innerHTML = base.length ? `<b>Leitura:</b> no recorte entraram <b>${nCon} RCs de Contrato</b> e <b>${nSpo} RCs de Spot</b> (${pctCon.toFixed(0)}% / ${pctSpo.toFixed(0)}% do mix)${nMista ? `, <b>${nMista} RCs Mista</b> (Contrato e Spot na mesma RC)` : ''}${topOther ? `, além de <b>${nOut} RCs em outros tipos</b> — o mais comum é <b>${topOther}</b> (${typeCounts[topOther]}). ` : '. '}${topCat ? `Carteira com maior volume: <b>${topCat.c}</b> (${topCat.tot} RCs). ` : ''}${alerts.length ? `<b style="color:#8A6D00">⚠ ${alerts.join(' · ')}</b> — priorize o saneamento para uma leitura confiável por carteira.` : ''}` : '<b>Sem RCs no recorte.</b>';
    SUM.contr = { nCon, nSpo, nOut, nMista, pctCon, pctSpo, total: base.length, top: top8.map(x => ({ c: x.c, tot: x.tot })) };
}
function renderCompradores() {
    // Base independente do filtro Comprador (compHit) — para permitir comparação entre todos
    const doneBase = ALL.filter(r => r.st === 'C' && r.dc >= DATA_INI_VOL && periodHit(r.dc) && tpHit(r) && stHit(r));
    const openBase = ALLRC.filter(r => r.st === 'A' && r.dl && r.dl >= DATA_INI_AGING && periodHit(r.dl) && tpHit(r) && stHit(r));
    // Por item de RC, igual ao KPI da aba SLA (ver renderSLA) — senão a coluna "% SLA" desta tabela
    // mostraria um percentual diferente do que a aba SLA reporta para o mesmo comprador.
    const slaBase = ALL.filter(r => r.st === 'C' && r.dc && r.dc >= DATA_INI_SLA && periodHit(r.dc) && tpHit(r) && stHit(r) && (r.ss === 'I' || r.ss === 'F') && r.sr >= 0 && slaHit(r));
    const savBase = ALL.filter(r => r.vp > 0 && r.vn > 0 && r.st !== 'X' && r.st !== 'D' && periodHit(r.dc) && tpHit(r) && stHit(r));
    const comps = [...new Set([...doneBase, ...openBase, ...slaBase, ...savBase].map(r => r.cp))].filter(c => c && c !== 'N/D').sort();
    const rows = comps.map(cp => {
        const done = doneBase.filter(r => r.cp === cp);
        const byW = {};
        done.forEach(r => { const w = isoWeek(r.dc); byW[w] = (byW[w] || 0) + r.ipd; });
        const wks = Object.keys(byW);
        const ipd = wks.length ? wks.reduce((a, w) => a + byW[w], 0) / wks.length : 0;
        const open = openBase.filter(r => r.cp === cp);
        const openAged = open.map(r => ({ age: bizDaysDiff(r.dl, HOJE), sa: r.sa, sr: r.sr })).filter(o => o.age > 0);
        const agingAvg = openAged.length ? Math.round(openAged.reduce((a, o) => a + o.age, 0) / openAged.length) : null;
        // Saldo SLA médio (SLA Alvo − SLA Real) — mesma régua da tabela de RCs abertas, usada para apontar criticidade
        const saldos = openAged.map(o => (o.sa > 0 ? o.sa : 15) - o.sr);
        const saldoAvg = saldos.length ? Math.round(saldos.reduce((a, b) => a + b, 0) / saldos.length) : null;
        const sla = slaBase.filter(r => r.cp === cp);
        const slaPct = sla.length ? sla.filter(r => r.ss === 'I').length / sla.length * 100 : null;
        const sav = savBase.filter(r => r.cp === cp);
        const saving = sav.reduce((a, r) => a + (r.vp - r.vn), 0);
        return { cp, concl: done.length, ipd, openN: open.reduce((a, r) => a + r.it, 0), agingAvg, saldoAvg, slaPct, slaN: sla.length, saving, matN: done.filter(r => r.cl === 'Material').length, servN: done.filter(r => r.cl === 'Serviço').length };
    });
    renderCompList(rows);

    // KPIs — panorama do time
    const withIpd = rows.filter(r => r.ipd > 0), withAge = rows.filter(r => r.agingAvg != null), withSla = rows.filter(r => r.slaN >= 5);
    const avgIpd = withIpd.length ? withIpd.reduce((a, r) => a + r.ipd, 0) / withIpd.length : 0;
    const avgAge = withAge.length ? Math.round(withAge.reduce((a, r) => a + r.agingAvg, 0) / withAge.length) : 0;
    const avgSla = withSla.length ? withSla.reduce((a, r) => a + r.slaPct, 0) / withSla.length : 0;
    const topIpd = withIpd.slice().sort((a, b) => b.ipd - a.ipd)[0];
    const topAge = withAge.slice().sort((a, b) => b.agingAvg - a.agingAvg)[0];
    const topSla = withSla.slice().sort((a, b) => b.slaPct - a.slaPct)[0];
    const topSav = rows.slice().sort((a, b) => b.saving - a.saving)[0];
    kpi('kpi-comp', [
        { l: 'Compradores ativos', v: comps.length, n: 'no recorte de Período/Tipo' },
        { l: 'Produtividade média', v: avgIpd.toFixed(2), n: 'itens/dia (média do time)' },
        { l: 'Aging médio do time', v: avgAge + 'd', n: 'RCs em aberto' },
        { l: '% SLA médio do time', v: avgSla.toFixed(1) + '%', n: 'compradores com ≥5 itens avaliados' },
        { l: 'Maior produtividade', v: topIpd ? topIpd.cp : '—', c: 'good', n: topIpd ? topIpd.ipd.toFixed(2) + ' itens/dia' : '' },
        { l: 'Maior aging', v: topAge ? topAge.cp : '—', c: 'bad', n: topAge ? topAge.agingAvg + 'd médio' : '' },
        { l: 'Melhor % SLA', v: topSla ? topSla.cp : '—', c: 'good', n: topSla ? topSla.slaPct.toFixed(1) + '%' : '' },
        { l: 'Maior saving', v: topSav && topSav.saving > 0 ? topSav.cp : '—', c: 'good', n: topSav && topSav.saving > 0 ? BRL(topSav.saving) : '' }
    ]);

    // Produtividade x SLA — bolha (c_compscatter)
    const maxConcl = Math.max(1, ...rows.map(r => r.concl));
    const ageColor = r => r.saldoAvg == null ? '#7A8C97' : r.saldoAvg < 0 ? C.red : r.saldoAvg <= 2 ? C.amber : C.teal;
    const bubbles = rows.filter(r => r.ipd > 0 || r.slaPct != null).map(r => ({ x: +r.ipd.toFixed(2), y: r.slaPct != null ? Math.round(r.slaPct) : 0, r: 6 + 12 * Math.sqrt(r.concl / maxConcl), cp: r.cp, concl: r.concl }));
    mkChart('c_compscatter', { type: 'bubble', data: { datasets: [{ data: bubbles, backgroundColor: bubbles.map(b => ageColor(rows.find(r => r.cp === b.cp)) + 'cc'), borderColor: bubbles.map(b => b.cp === STATE.comp ? '#003865' : 'transparent'), borderWidth: bubbles.map(b => b.cp === STATE.comp ? 3 : 0) }] }, options: { maintainAspectRatio: false, onClick: (evt, els) => { if (els.length) { const cp = bubbles[els[0].index].cp; STATE.comp = STATE.comp === cp ? 'GERAL' : cp; render(); } }, plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => { const b = bubbles[c.dataIndex]; return b.cp + ': ' + b.x + ' itens/dia · ' + b.y + '% SLA · ' + b.concl + ' concluídos'; } } } }, scales: { x: { ...soG, beginAtZero: true, title: { display: true, text: 'Itens/dia', font: { size: 10 } } }, y: { ...soG, min: 0, max: 100, title: { display: true, text: '% dentro do SLA', font: { size: 10 } }, ticks: { callback: v => v + '%' } } } } });

    // Material x Serviço por comprador (c_compmix)
    const top12 = rows.slice().sort((a, b) => b.concl - a.concl).slice(0, 12);
    mkChart('c_compmix', { type: 'bar', data: { labels: top12.map(r => r.cp), datasets: [{ label: 'Material', data: top12.map(r => r.matN), backgroundColor: C.steel, stack: 's' }, { label: 'Serviço', data: top12.map(r => r.servN), backgroundColor: C.blue, stack: 's' }] }, options: { indexAxis: 'y', maintainAspectRatio: false, plugins: { legend: { position: 'top', labels: { boxWidth: 11, usePointStyle: true, font: { size: 10 } } } }, scales: { x: { stacked: true, ...soG, beginAtZero: true }, y: { stacked: true, ...noG, ticks: { font: { size: 9.5 } } } } } });

    // Tabela — ficha por comprador (ordenável)
    const dir = compSort.dir, key = compSort.key;
    const sorted = rows.slice().sort((a, b) => { let va = a[key], vb = b[key]; if (va == null) va = key === 'cp' ? '' : -1; if (vb == null) vb = key === 'cp' ? '' : -1; if (typeof va === 'string') return va.localeCompare(vb) * dir; return (va - vb) * dir; });
    document.querySelector('#t_comp thead').innerHTML = '<tr>' + COMP_COLS.map(c => `<th class="${c.k === 'cp' ? '' : 'num'}" data-key="${c.k}" style="cursor:pointer">${c.l}${compSort.key === c.k ? (compSort.dir > 0 ? ' ▲' : ' ▼') : ''}</th>`).join('') + '</tr>';
    document.querySelector('#t_comp tbody').innerHTML = sorted.map(r => {
        const slaTxt = r.slaPct != null ? r.slaPct.toFixed(1) + '%' : '—', slaCol = r.slaPct == null ? '' : r.slaPct >= 90 ? '#14705A' : r.slaPct >= 80 ? '#8A6D00' : '#C0272D';
        const ageTxt = r.agingAvg != null ? r.agingAvg + 'd' : '—', ageCol = r.saldoAvg == null ? '' : r.saldoAvg < 0 ? '#C0272D' : r.saldoAvg <= 2 ? '#8A6D00' : '#14705A';
        const bg = r.cp === STATE.comp ? 'background:rgba(0,56,101,.07)' : '';
        return `<tr class="jump" data-cp="${r.cp}" style="${bg}"><td>${r.cp}</td><td class="num">${r.concl.toLocaleString('pt-BR')}</td><td class="num">${r.ipd.toFixed(2)}</td><td class="num">${r.openN}</td><td class="num" style="color:${ageCol}">${ageTxt}</td><td class="num" style="color:${slaCol}">${slaTxt}</td><td class="num" style="${r.saving < 0 ? 'color:#C0272D' : ''}">${BRL(r.saving)}</td></tr>`;
    }).join('') || '<tr><td colspan="7" style="color:#46606F">Nenhum comprador com dados no recorte.</td></tr>';
    document.querySelectorAll('#t_comp thead th[data-key]').forEach(th => th.onclick = () => { const k = th.dataset.key; if (compSort.key === k) compSort.dir *= -1; else { compSort.key = k; compSort.dir = k === 'cp' ? 1 : -1; } renderCompradores(); });
    document.querySelectorAll('#t_comp tbody tr.jump').forEach(tr => tr.onclick = () => { const cp = tr.dataset.cp; STATE.comp = STATE.comp === cp ? 'GERAL' : cp; render(); });

    // RCs em aberto — acompanhamento do time (t_rcopen_all)
    renderOpenRCPanel('t_rcopen_all', 'sum_rcopen_all', openRCsFor(null), true, false, true);

    // Leitura
    document.getElementById('ins-comp').innerHTML = comps.length ? `<b>Leitura:</b> <b>${comps.length} compradores</b> ativos no recorte, produtividade média de <b>${avgIpd.toFixed(2)} itens/dia</b> e SLA médio de <b>${avgSla.toFixed(1)}%</b>. ${topIpd ? `Maior produtividade: <b>${topIpd.cp}</b> (${topIpd.ipd.toFixed(2)} itens/dia). ` : ''}${topAge ? `Maior aging: <b>${topAge.cp}</b> (${topAge.agingAvg}d). ` : ''}Use a bolha Produtividade × SLA para achar quem produz bem <i>e</i> cumpre prazo (canto superior direito) — e clique numa linha da tabela ou numa bolha para abrir a visão individual.` : '<b>Sem compradores com dados no recorte.</b>';

    // Alterna entre a visão geral (comparativo) e a visão individual do comprador selecionado no filtro do topo
    const geralEl = document.getElementById('comp-geral'), indEl = document.getElementById('comp-individual');
    if (STATE.comp === 'GERAL') { geralEl.style.display = ''; indEl.style.display = 'none'; }
    else { geralEl.style.display = 'none'; indEl.style.display = ''; renderCompIndividual(STATE.comp, { avgIpd, avgAge, avgSla }); }
}
function renderCompIndividual(cp, team) {
    document.getElementById('ind-nome').textContent = cp;
    document.getElementById('ind-avatar').textContent = initials(cp);
    const FA = [['0-3', 0, 3], ['4-7', 4, 7], ['8-15', 8, 15], ['16-30', 16, 30], ['>30', 31, 1e9]];
    const FCOL = ['#1E9F7F', '#7FE06C', '#FBD300', '#C79100', '#D2373C'];
    const faIdx = a => { for (let i = 0; i < FA.length; i++) if (a >= FA[i][1] && a <= FA[i][2]) return i; return FA.length - 1; };

    // Concluídos — recorte (KPI) e ano completo (tendência semanal)
    const doneP = ALL.filter(r => r.st === 'C' && r.dc >= DATA_INI_VOL && periodHit(r.dc) && tpHit(r) && stHit(r) && r.cp === cp);
    const doneY = ALL.filter(r => r.st === 'C' && r.dc >= DATA_INI_VOL && inY(r.dc) && tpHit(r) && stHit(r) && r.cp === cp);
    const cw = {};
    doneY.forEach(r => { const w = isoWeek(r.dc); cw[w] = (cw[w] || 0) + 1; });
    const cwk = Object.keys(cw).sort();

    // Média do time por semana (ano completo) — mesma base, todos os compradores
    const doneYAll = ALL.filter(r => r.st === 'C' && r.dc >= DATA_INI_VOL && inY(r.dc) && tpHit(r) && stHit(r));
    const cwAll = {}, cwBuyers = {};
    doneYAll.forEach(r => { const w = isoWeek(r.dc); cwAll[w] = (cwAll[w] || 0) + 1; (cwBuyers[w] = cwBuyers[w] || new Set()).add(r.cp); });
    const teamAvg = w => cwBuyers[w] && cwBuyers[w].size ? +(cwAll[w] / cwBuyers[w].size).toFixed(2) : 0;

    // Itens/dia — média das semanas no recorte
    const byWI = {};
    doneP.forEach(r => { const w = isoWeek(r.dc); byWI[w] = (byWI[w] || 0) + r.ipd; });
    const wksI = Object.keys(byWI);
    const ipdVal = wksI.length ? wksI.reduce((a, w) => a + byWI[w], 0) / wksI.length : 0;

    // Aging — RCs abertas no recorte
    const openP = ALLRC.filter(r => r.st === 'A' && r.dl && r.dl >= DATA_INI_AGING && periodHit(r.dl) && tpHit(r) && stHit(r) && r.cp === cp);
    const openPAged = openP.map(r => ({ age: bizDaysDiff(r.dl, HOJE), sa: r.sa, sr: r.sr })).filter(o => o.age > 0);
    const agesP = openPAged.map(o => o.age);
    const agingAvg = agesP.length ? Math.round(agesP.reduce((a, b) => a + b, 0) / agesP.length) : null;
    // Crítico = SLA Real ultrapassou o SLA Alvo (alvo fixo de 15d quando sem SLA Alvo) — mesma régua da tabela de RCs abertas
    const critN = openPAged.filter(o => o.sr > (o.sa > 0 ? o.sa : 15)).length;
    const fCounts = FA.map(() => 0);
    agesP.forEach(a => fCounts[faIdx(a)]++);

    // SLA — recorte (KPI) e ano completo (tendência semanal)
    const slaP = ALL.filter(r => r.st === 'C' && r.dc && r.dc >= DATA_INI_SLA && periodHit(r.dc) && tpHit(r) && stHit(r) && r.cp === cp && (r.ss === 'I' || r.ss === 'F') && r.sr >= 0 && slaHit(r));
    const slaPct = slaP.length ? slaP.filter(r => r.ss === 'I').length / slaP.length * 100 : null;
    const slaY = ALL.filter(r => r.st === 'C' && r.dc && r.dc >= DATA_INI_SLA && inY(r.dc) && tpHit(r) && stHit(r) && r.cp === cp && (r.ss === 'I' || r.ss === 'F') && r.sr >= 0 && slaHit(r));
    const bwS = {};
    slaY.forEach(r => { const w = isoWeek(r.dc); (bwS[w] = bwS[w] || { i: 0, t: 0 }); bwS[w].t++; if (r.ss === 'I') bwS[w].i++; });
    const wkS = Object.keys(bwS).sort();

    // Saving — recorte
    const savP = ALL.filter(r => r.vp > 0 && r.vn > 0 && r.st !== 'X' && r.st !== 'D' && periodHit(r.dc) && tpHit(r) && stHit(r) && r.cp === cp);
    const savTotal = savP.reduce((a, r) => a + (r.vp - r.vn), 0);
    const bwV = {};
    savP.forEach(r => { if (!r.dc) return; const w = isoWeek(r.dc); bwV[w] = (bwV[w] || 0) + (r.vp - r.vn); });
    const wkV = Object.keys(bwV).sort();

    // Mix Contrato x Spot — RCs liberadas no recorte
    const relP = ALLRC.filter(r => r.dl && r.dl >= DATA_INI_VOL && periodHit(r.dl) && tpHit(r) && stHit(r) && r.cp === cp);
    const nConP = relP.filter(r => (r.td || '').trim() === 'Contrato').length, nSpoP = relP.filter(r => (r.td || '').trim() === 'Spot').length;
    const pctConP = relP.length ? nConP / relP.length * 100 : 0;

    // Mix Material x Serviço — concluídos no recorte
    const matN = doneP.filter(r => r.cl === 'Material').length, servN = doneP.filter(r => r.cl === 'Serviço').length;

    // KPIs
    const dIpd = team.avgIpd ? ((ipdVal - team.avgIpd) / team.avgIpd * 100) : 0;
    const dAge = team.avgAge && agingAvg != null ? ((agingAvg - team.avgAge) / team.avgAge * 100) : 0;
    const dSla = slaPct != null ? (slaPct - team.avgSla) : 0;
    const pCor = dIpd >= 0 ? 'good' : 'bad';
    const aCor = agingAvg == null ? 'good' : dAge <= 0 ? 'good' : dAge <= 30 ? 'warn' : 'bad';
    const sCor = slaPct == null ? 'warn' : slaPct >= 90 ? 'good' : slaPct >= 80 ? 'warn' : 'bad';
    const vCor = savTotal >= 0 ? 'good' : 'bad';
    kpi('kpi-individual', [
        { l: 'Itens concluídos', v: doneP.length.toLocaleString('pt-BR'), n: 'no recorte' },
        { l: 'Itens/dia', v: ipdVal.toFixed(2), c: pCor, n: (dIpd >= 0 ? '+' : '') + dIpd.toFixed(0) + '% vs média do time' },
        { l: 'RCs em aberto', v: openP.length, n: agingAvg != null ? 'aging médio ' + agingAvg + 'd' : 'sem RCs abertas' },
        { l: 'Aging vs time', v: agingAvg != null ? (dAge >= 0 ? '+' : '') + dAge.toFixed(0) + '%' : '—', c: aCor, n: 'quanto menor, melhor' },
        { l: '% dentro do SLA', v: slaPct != null ? slaPct.toFixed(1) + '%' : '—', c: sCor, n: slaPct != null ? (dSla >= 0 ? '+' : '') + dSla.toFixed(1) + 'pp vs média do time' : 'sem base avaliada' },
        { l: 'Saving capturado', v: Kf(savTotal), c: vCor, n: BRL(savTotal) },
        { l: 'Mix Contrato', v: pctConP.toFixed(0) + '%', n: nConP + ' Contrato · ' + nSpoP + ' Spot' },
        { l: 'RCs críticas de aging', v: critN, c: critN > 0 ? 'warn' : 'good', n: 'acima do SLA Alvo' }
    ]);
    mkChart('c_ind_prod', { data: { labels: cwk.map(wkLabel), datasets: [{ type: 'bar', label: cp, data: cwk.map(w => cw[w]), backgroundColor: C.steel, borderRadius: 18, order: 2 }, { type: 'line', label: 'Média do time', data: cwk.map(teamAvg), borderColor: '#003865', borderWidth: 2, pointRadius: 0, tension: .3, fill: false, order: 1 }] }, options: { maintainAspectRatio: false, plugins: { legend: { position: 'top', labels: { boxWidth: 10, usePointStyle: true, font: { size: 9 } } } }, scales: { x: { ...noG, ticks: { maxTicksLimit: 8, font: { size: 8 } } }, y: { ...soG, beginAtZero: true } } } });
    mkChart('c_ind_aging', { type: 'bar', data: { labels: FA.map(x => x[0]), datasets: [{ data: fCounts, backgroundColor: FCOL, borderRadius: 18 }] }, options: { maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: noG, y: { ...soG, beginAtZero: true } } } });
    mkChart('c_ind_sla', { type: 'line', plugins: [crosshair], data: { labels: wkS.map(wkLabel), datasets: [{ data: wkS.map(w => Math.round(bwS[w].i / bwS[w].t * 100)), borderColor: C.blue, backgroundColor: 'rgba(14,83,140,.08)', fill: true, tension: .3, borderWidth: 2, pointRadius: 0, pointHoverRadius: 5, pointHoverBackgroundColor: C.blue }] }, options: { maintainAspectRatio: false, interaction: { mode: 'index', intersect: false }, plugins: { legend: { display: false }, tooltip: { mode: 'index', intersect: false } }, scales: { x: { ...noG, ticks: { maxTicksLimit: 8, font: { size: 8 } } }, y: { ...soG, min: 0, max: 100, ticks: { callback: v => v + '%' } } } } });
    mkChart('c_ind_saving', { type: 'bar', data: { labels: wkV.map(wkLabel), datasets: [{ data: wkV.map(w => bwV[w]), backgroundColor: C.teal, borderRadius: 18 }] }, options: { maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => BRL(c.parsed.y) } } }, scales: { x: { ...noG, ticks: { maxTicksLimit: 8, font: { size: 8 } } }, y: { ...soG, beginAtZero: true, ticks: { callback: Kf } } } } });
    mkChart('c_ind_mix', { type: 'doughnut', data: { labels: ['Material', 'Serviço'], datasets: [{ data: [matN, servN], backgroundColor: [C.steel, C.blue], borderWidth: 2, borderColor: '#FFFFFF' }] }, options: { maintainAspectRatio: false, cutout: '62%', plugins: { legend: { position: 'bottom', labels: { boxWidth: 12, usePointStyle: true } }, centerText: { label: 'Itens' } } } });

    // RCs em aberto — acompanhamento individual (t_rcopen_ind)
    renderOpenRCPanel('t_rcopen_ind', 'sum_rcopen_ind', openRCsFor(cp), false);
    document.getElementById('ins-individual').innerHTML = `<b>Leitura:</b> ${cp} concluiu <b>${doneP.length} itens</b> (<b>${ipdVal.toFixed(2)} itens/dia</b>, ${dIpd >= 0 ? '+' : ''}${dIpd.toFixed(0)}% vs média do time), tem <b>${openP.length} RCs abertas</b>${agingAvg != null ? ` (aging médio ${agingAvg}d)` : ''} e está em <b>${slaPct != null ? slaPct.toFixed(1) + '%' : '—'}</b> dentro do SLA. Saving capturado: <b>${Kf(savTotal)}</b>. Mix de entrada: <b>${nConP} RCs Contrato</b> e <b>${nSpoP} RCs Spot</b>.${critN > 0 ? ` <b style="color:#8A6D00">⚠ ${critN} RC(s) acima do SLA Alvo.</b>` : ''}`;
}
function scoreRow(t, mod, ind, val, ref, status, label) {
    return `<tr class="jump" data-t="${t}"><td>${mod}</td><td>${ind}</td><td class="num">${val}</td><td class="num">${ref}</td><td><span class="pill p-${status}">${label}</span></td></tr>`;
}

function renderOverview() {
    const P = SUM.prod, A = SUM.aging, S = SUM.sla, V = SUM.saving;
    if (!P || !A || !S || !V) return;

    // Mix Contrato × Spot — direto da base principal (classificação própria "tp"), sem depender da segundaBase (exclusiva da aba Contratualização)
    const mixBase = ALLRC.filter(r => r.dl && r.dl >= DATA_INI_AGING && periodHit(r.dl) && compHit(r) && tpHit(r) && stHit(r));
    const mixCounts = {};
    mixBase.forEach(r => { mixCounts[r.tp] = (mixCounts[r.tp] || 0) + 1; });
    const mCon = mixCounts['Contrato'] || 0, mSpo = mixCounts['Spot'] || 0, mOut = mixBase.length - mCon - mSpo;
    const K = {
        nCon: mCon, nSpo: mSpo, nOut: mOut, total: mixBase.length,
        pctCon: mixBase.length ? mCon / mixBase.length * 100 : 0,
        pctSpo: mixBase.length ? mSpo / mixBase.length * 100 : 0
    };

    // KPIs consolidados
    const pCor = P.ating >= 100 ? 'good' : P.ating >= 80 ? 'warn' : 'bad';
    const aCor = A.avg <= A.meta ? 'good' : A.avg <= A.meta * 1.3 ? 'warn' : 'bad';
    const sCor = S.pct >= 90 ? 'good' : S.pct >= 80 ? 'warn' : 'bad';
    const vCor = V.total >= 0 ? 'good' : 'bad';
    kpi('kpi-overview', [
        { l: 'Entrada de itens', v: P.entradas.toLocaleString('pt-BR'), n: 'itens liberados no recorte' },
        { l: 'Itens em aberto', v: A.openTotal.toLocaleString('pt-BR'), c: aCor, n: 'total bruto · aging médio ' + A.avg + 'd (meta ≤' + A.meta + 'd)' },
        { l: '% dentro do SLA', v: S.pct.toFixed(1) + '%', c: sCor, n: S.tot ? S.fora + ' de ' + S.tot + ' fora do prazo' : 'sem base avaliada' },
        { l: 'Saving capturado', v: Kf(V.total), c: vCor, n: BRL(V.total) + ' · ' + V.taxa.toFixed(1) + '% de taxa' },
        { l: 'Itens concluídos', v: P.concluidos.toLocaleString('pt-BR'), c: pCor, n: 'atingimento ' + P.ating.toFixed(0) + '% da meta Veloc.' },
        { l: 'RCs críticas de aging', v: A.crit.toLocaleString('pt-BR'), c: A.crit > 0 ? 'warn' : 'good', n: 'ciclo aberto > 30 dias' },
        { l: 'RCs críticas em SLA', v: S.crit.toLocaleString('pt-BR'), c: S.crit > 0 ? 'bad' : 'good', n: 'fora do SLA > 15 dias' },
        { l: 'Compradores no recorte', v: STATE.comp === 'GERAL' ? 'Geral' : STATE.comp, n: STATE.tp === 'GERAL' ? 'Todos os tipos' : STATE.tp }
    ]);

    // Mini-gráficos por módulo
    mkChart('c_ov_prod', { type: 'bar', data: { labels: P.weeks, datasets: [{ label: 'Entrada', data: P.entries, backgroundColor: C.steel, borderRadius: 18 }, { label: 'Concluídos', data: P.weekly, backgroundColor: C.teal, borderRadius: 18 }] }, options: { maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { ...noG, ticks: { maxTicksLimit: 8, font: { size: 8 } } }, y: { ...soG, beginAtZero: true } } } });
    mkChart('c_ov_aging', { type: 'bar', data: { labels: A.faixaLabels, datasets: [{ data: A.faixaCounts, backgroundColor: A.faixaColors, borderRadius: 18 }] }, options: { maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: noG, y: { ...soG, beginAtZero: true } } } });
    mkChart('c_ov_sla', { type: 'line', plugins: [crosshair], data: { labels: S.weeks, datasets: [{ data: S.weekly, borderColor: C.blue, backgroundColor: 'rgba(14,83,140,.08)', fill: true, tension: .3, borderWidth: 2, pointRadius: 0, pointHoverRadius: 5, pointHoverBackgroundColor: C.blue }] }, options: { maintainAspectRatio: false, interaction: { mode: 'index', intersect: false }, plugins: { legend: { display: false }, tooltip: { mode: 'index', intersect: false } }, scales: { x: { ...noG, ticks: { maxTicksLimit: 8, font: { size: 8 } } }, y: { ...soG, min: 0, max: 100, ticks: { callback: v => v + '%' } } } } });
    mkChart('c_ov_saving', { type: 'bar', data: { labels: V.weeks, datasets: [{ data: V.weekly, backgroundColor: C.teal, borderRadius: 18 }] }, options: { maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => BRL(c.parsed.y) } } }, scales: { x: { ...noG, ticks: { maxTicksLimit: 8, font: { size: 8 } } }, y: { ...soG, beginAtZero: true, ticks: { callback: Kf } } } } });
    mkChart('c_ov_contr', { type: 'doughnut', data: { labels: ['Contrato', 'Spot', 'Outros'], datasets: [{ data: [K.nCon, K.nSpo, K.nOut], backgroundColor: ['#003865', C.steel, '#CAD6DD'], borderWidth: 2, borderColor: '#FFFFFF' }] }, options: { maintainAspectRatio: false, cutout: '62%', plugins: { legend: { position: 'bottom', labels: { boxWidth: 11, usePointStyle: true, font: { size: 10 } } }, centerText: { label: 'RCs' } } } });
    mkChart('c_ov_mat_qtd', { type: 'bar', data: { labels: P.matLabels, datasets: [{ data: P.matQ, backgroundColor: [C.steel, C.blue], borderRadius: 18 }] }, options: { maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => c.parsed.y.toLocaleString('pt-BR') + ' itens' } } }, scales: { x: noG, y: { ...soG, beginAtZero: true } } } });
    mkChart('c_ov_mat_pct', { type: 'doughnut', data: { labels: P.matLabels, datasets: [{ data: P.matQ, backgroundColor: [C.steel, C.blue], borderWidth: 2, borderColor: '#FFFFFF' }] }, options: { maintainAspectRatio: false, cutout: '62%', plugins: { legend: { position: 'bottom', labels: { boxWidth: 11, usePointStyle: true, font: { size: 10 } } }, centerText: { label: 'Itens' }, tooltip: { callbacks: { label: c => c.parsed.toLocaleString('pt-BR') + ' (' + (P.matTot ? Math.round(c.parsed / P.matTot * 100) : 0) + '%)' } } } } });
    mkChart('c_ov_sla_mat_qtd', { type: 'bar', data: { labels: S.matLabels, datasets: [{ data: S.matQ, backgroundColor: [C.steel, C.blue], borderRadius: 18 }] }, options: { indexAxis: 'y', maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => c.parsed.x.toLocaleString('pt-BR') + ' RCs' } } }, scales: { x: { ...soG, beginAtZero: true }, y: noG } } });
    mkChart('c_ov_sla_mat_pct', { type: 'bar', data: { labels: S.matLabels, datasets: [{ data: S.matPct, backgroundColor: S.matPct.map(p => p >= 90 ? C.teal : p >= 80 ? '#FBD300' : p >= 75 ? '#C79100' : C.red), borderRadius: 18 }] }, options: { indexAxis: 'y', maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => c.parsed.x + '%' } } }, scales: { x: { ...soG, min: 0, max: 100, ticks: { callback: v => v + '%' } }, y: noG } } });
    mkChart('c_ov_aging_mat_qtd', { type: 'bar', data: { labels: A.matLabels, datasets: [{ data: A.matQ, backgroundColor: [C.steel, C.blue], borderRadius: 18 }] }, options: { indexAxis: 'y', maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => c.parsed.x.toLocaleString('pt-BR') + ' RCs' } } }, scales: { x: { ...soG, beginAtZero: true }, y: noG } } });
    mkChart('c_ov_aging_mat_avg', { type: 'bar', data: { labels: A.matLabels, datasets: [{ data: A.matAvg, backgroundColor: A.matAvg.map(v => v <= A.meta ? C.teal : v <= A.meta * 1.15 ? '#FBD300' : v <= A.meta * 1.3 ? '#C79100' : C.red), borderRadius: 18 }] }, options: { indexAxis: 'y', maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => c.parsed.x + 'd' } } }, scales: { x: { ...soG, beginAtZero: true }, y: noG } } });

    // Tabela — resumo por módulo
    document.querySelector('#t_overview tbody').innerHTML = [
        scoreRow('prod', 'Produtividade', 'Atingimento da meta ponderada', P.ating.toFixed(0) + '%', '100% (mín. 80%)', pCor, pCor === 'good' ? 'Na meta' : pCor === 'warn' ? 'Atenção' : 'Abaixo'),
        scoreRow('aging', 'Aging', 'Aging médio (RCs abertas)', A.avg + 'd', '≤ ' + A.meta + 'd', aCor, aCor === 'good' ? 'Na meta' : aCor === 'warn' ? 'Atenção' : 'Crítico'),
        scoreRow('sla', 'SLA', '% dentro do prazo', S.pct.toFixed(1) + '%', '≥ 90%', sCor, sCor === 'good' ? 'Na meta' : sCor === 'warn' ? 'Atenção' : 'Crítico'),
        scoreRow('saving', 'Saving', 'Economia capturada', Kf(V.total), V.taxa.toFixed(1) + '% de taxa', vCor, vCor === 'good' ? 'Positivo' : 'Negativo'),
        scoreRow('contr', 'Contratualização', 'Mix Contrato × Spot', K.pctCon.toFixed(0) + '% / ' + K.pctSpo.toFixed(0) + '%', K.total + ' RCs no recorte', 'good', 'Informativo')
    ].join('');

    // Leitura consolidada
    document.getElementById('ins-overview').innerHTML = `<b>Leitura:</b> produtividade em <b>${P.ating.toFixed(0)}%</b> da meta, aging médio de <b>${A.avg} dias</b> (${A.openTotal} itens em aberto no total, ${A.crit} RCs críticas), SLA em <b>${S.pct.toFixed(1)}%</b> e saving de <b>${Kf(V.total)}</b> no recorte. Mix de entrada: <b>${K.pctCon.toFixed(0)}% Contrato</b> e <b>${K.pctSpo.toFixed(0)}% Spot</b>. ${[pCor, aCor, sCor].includes('bad') ? 'Há pelo menos um indicador abaixo da meta — abra a aba correspondente para detalhar.' : 'Indicadores-chave dentro ou próximos da meta no recorte atual.'}`;
}
