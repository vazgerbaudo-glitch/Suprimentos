function kpiCardHTML(k) {
    return `<div class="kpi ${k.c || ''}"><div class="lbl">${k.l}</div><div class="val">${k.v}</div>${k.p ? `<span class="pill ${k.pc}">${k.p}</span>` : ''}${k.n ? `<div class="note">${k.n}</div>` : ''}</div>`;
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
function gaugeCardHTML(label, val, unit, pct, cor, note) {
    return `<div class="kpi ${cor}">
        <div class="lbl">${label}</div>
        ${gaugeSVG(pct)}
        <div style="text-align:center;margin-top:-4px"><span style="font-size:20px;font-weight:700;letter-spacing:-.5px;font-variant-numeric:tabular-nums">${val}</span><span style="font-size:11px;color:var(--muted)"> ${unit}</span></div>
        ${note ? `<div class="note" style="text-align:center">${note}</div>` : ''}
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
// Semáforo de RC aberta vs. SLA Alvo — mesma régua da tabela da aba Aging
function sevOpen(r) {
    const lim = r.sa > 0 ? r.sa : 15;
    if (r.age > lim) return ['s-rd', 'Crítico', 'f-rd'];
    if (lim - r.age <= 2) return ['s-or', 'Atenção', 'f-or'];
    return ['s-am', 'Dentro do prazo', 'f-am'];
}
// RCs abertas para acompanhamento (aba Compradores) — mesma base da aba Aging (2025+2026, sem corte de data); cp=null traz todo o time
function openRCsFor(cp) {
    return ALLRC.filter(r => r.st === 'A' && r.dl && periodHitAging(r.dl) && tpHit(r) && (!cp || r.cp === cp))
        .map(r => ({ ...r, age: Math.round((HOJE - r.dl) / 86400000) }))
        .filter(r => r.age >= 0)
        .sort((a, b) => b.age - a.age);
}
function renderOpenRCPanel(tblId, sumId, rcs, showComp, showExtra = true) {
    const cnt = { 'Dentro do prazo': 0, 'Atenção': 0, 'Crítico': 0 };
    rcs.forEach(r => cnt[sevOpen(r)[1]]++);
    const avg = rcs.length ? Math.round(rcs.reduce((a, r) => a + r.age, 0) / rcs.length) : 0;
    document.getElementById(sumId).innerHTML = rcs.length ? `<b>${rcs.length}</b> RC${rcs.length > 1 ? 's' : ''} em aberto no recorte · aging médio <b>${avg}d</b> · <span class="tag-sev s-am">Dentro do prazo: ${cnt['Dentro do prazo']}</span> <span class="tag-sev s-or">Atenção: ${cnt['Atenção']}</span> <span class="tag-sev s-rd">Crítico: ${cnt['Crítico']}</span>` : 'Nenhuma RC em aberto no recorte.';
    document.querySelector('#' + tblId + ' tbody').innerHTML = rcs.map(r => {
        const s = sevOpen(r);
        const saldo = r.sa > 0 ? r.sa - r.age : null;
        const saldoTxt = saldo == null ? '—' : (saldo >= 0 ? '+' : '') + saldo + 'd';
        const saldoCol = saldo == null ? 'color:var(--muted)' : saldo >= 0 ? 'color:#14705A' : 'color:#C0272D';
        return `<tr${showComp ? ` class="jump" data-cp="${r.cp}" style="cursor:pointer"` : ''}>${showComp ? `<td>${r.cp}</td>` : ''}<td>${r.rc || '-'}</td><td class="num">${r.it}</td>${showExtra ? `<td>${(r.td || '').trim() || '-'}</td><td>${(r.et || '').replace(/^\d+\.?\s*/, '') || '-'}</td><td class="num">${fmtDia(r.dl)}</td>` : ''}<td class="num">${r.sa || '—'}</td><td class="num">${r.age}</td><td class="num" style="${saldoCol}">${saldoTxt}</td><td><span class="farol ${s[2]}"></span><span class="tag-sev ${s[0]}">${s[1]}</span></td></tr>`;
    }).join('') || `<tr><td colspan="${(showComp ? 1 : 0) + (showExtra ? 3 : 0) + 6}" style="color:#46606F">Nenhuma RC em aberto no recorte.</td></tr>`;
    if (showComp) document.querySelectorAll('#' + tblId + ' tbody tr.jump').forEach(tr => tr.onclick = () => { STATE.comp = tr.dataset.cp; render(); });
}
function render() {
    ALLRC = rollupRC(ALL);
    renderProd();
    renderAging();
    renderSLA();
    renderSaving();
    renderContr();
    renderCompradores();
    renderOverview();
}
function renderProd() {
    // KPI + velocímetro — atingimento da meta ponderada (Material/Serviço)
    const base = ALL.filter(r => r.st === 'C' && r.dc >= DATA_INI && periodHit(r.dc) && compHit(r) && tpHit(r));
    const CAP = { 'Material': STATE.metaMat, 'Serviço': STATE.metaServ };
    const byW = {};
    base.forEach(r => {
        const w = isoWeek(r.dc);
        const o = (byW[w] = byW[w] || { ipd: 0, ipc: 0, bs: new Set(), cap: 0, duM: new Map() });
        o.ipd += r.ipd; o.ipc += r.ipc; o.bs.add(r.cp);
        const capMeta = CAP[r.cl];
        if (capMeta > 0) o.cap += 1 / capMeta;
        if (r.du > 0) o.duM.set(r.du, (o.duM.get(r.du) || 0) + 1);
    });
    const weeks = Object.keys(byW).sort(), ger = STATE.comp === 'GERAL';
    let _fb = false;
    const wv = weeks.map(w => {
        const o = byW[w];
        if (!ger) return o.ipd;
        if (o.ipc > 0) return o.ipc;
        if (o.ipd > 0 && o.bs.size) { _fb = true; return o.ipd / o.bs.size; }
        return 0;
    });
    const val = weeks.length ? wv.reduce((a, b) => a + b, 0) / weeks.length : 0;
    const modeM3 = (m, def) => { let b = def, bc = -1; m.forEach((c, v) => { if (c > bc) { bc = c; b = v; } }); return b; };
    const totCap = weeks.reduce((a, w) => a + byW[w].cap, 0);
    const totDenom = weeks.reduce((a, w) => { const o = byW[w]; const du = modeM3(o.duM, 5); const buyers = ger ? (o.bs.size || 1) : 1; return a + du * buyers; }, 0);
    const ating = totDenom > 0 ? totCap / totDenom * 100 : 0;
    const cor = ating >= 100 ? 'good' : ating >= 80 ? 'warn' : 'bad';
    document.getElementById('kpi-prod').innerHTML = gaugeCardHTML(ger ? 'Itens/dia/comprador' : 'Itens/dia', val.toFixed(2), ger ? 'itens/dia/comp' : 'itens/dia', ating, cor, ating.toFixed(0) + '% da meta ponderada') + [
        { l: 'Atingimento da meta', v: ating.toFixed(0) + '%', c: cor, p: ating >= 100 ? 'meta' : ating >= 80 ? '80%' : '<80%', pc: ating >= 100 ? 'p-good' : ating >= 80 ? 'p-warn' : 'p-bad', n: 'meta ponderada: Material ' + STATE.metaMat + ' · Serviço ' + STATE.metaServ + ' (itens/dia)' },
        { l: 'Itens concluídos', v: base.length.toLocaleString('pt-BR'), n: 'no recorte' },
        { l: 'Semanas no recorte', v: weeks.length, n: STATE.comp === 'GERAL' ? 'todos compradores' : STATE.comp }].map(kpiCardHTML).join('');
    mkChart('c_gauge', { type: 'bar', data: { labels: ['Atingimento'], datasets: [{ data: [Math.min(ating, 200)], backgroundColor: ating >= 100 ? C.teal : ating >= 80 ? C.amber : C.red, borderRadius: 18, barThickness: 34 }] }, options: { indexAxis: 'y', maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { callbacks: { label: () => ating.toFixed(0) + '%' } } }, scales: { x: { min: 0, max: 200, grid: { color: '#E5EBEE' }, border: { display: false }, ticks: { callback: v => v + '%' }, afterBuildTicks: a => { a.ticks = [{ value: 80 }, { value: 100 }, { value: 150 }]; } }, y: noG } } });

    // Itens concluídos por semana (c_psem) — Entrada x Concluídos
    const ctx = ALL.filter(r => r.st === 'C' && r.dc >= DATA_INI && inY(r.dc) && compHit(r) && tpHit(r));
    const cw = {};
    ctx.forEach(r => { const w = isoWeek(r.dc); cw[w] = (cw[w] || 0) + 1; });
    const ew = {};
    ALL.filter(r => r.dl && r.dl >= DATA_INI && inY(r.dl) && compHit(r) && tpHit(r)).forEach(r => { const w = isoWeek(r.dl); ew[w] = (ew[w] || 0) + 1; });
    const cwk = [...new Set([...Object.keys(cw), ...Object.keys(ew)])].sort();
    mkChart('c_psem', { type: 'bar', data: { labels: cwk.map(w => wkLabel(w)), datasets: [{ label: 'Entrada', data: cwk.map(w => ew[w] || 0), backgroundColor: C.steel, borderRadius: 18 }, { label: 'Concluídos', data: cwk.map(w => cw[w] || 0), backgroundColor: C.teal, borderRadius: 18 }] }, options: { maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { ...noG, ticks: { maxTicksLimit: 13, font: { size: 8 } } }, y: { ...soG, beginAtZero: true } } } });

    // Evolução de itens/dia/comprador por semana (c_ipdsem) — visão do ano
    const byWY = {};
    ctx.forEach(r => { const w = isoWeek(r.dc); const o = (byWY[w] = byWY[w] || { ipd: 0, ipc: 0, bs: new Set() }); o.ipd += r.ipd; o.ipc += r.ipc; o.bs.add(r.cp); });
    const wkY = Object.keys(byWY).sort();
    const ipdW = wkY.map(w => { const o = byWY[w]; let v; if (!ger) v = o.ipd; else if (o.ipc > 0) v = o.ipc; else v = o.bs.size ? o.ipd / o.bs.size : 0; return +v.toFixed(2); });
    const avgY = ipdW.length ? ipdW.reduce((a, b) => a + b, 0) / ipdW.length : 0;
    mkChart('c_ipdsem', { type: 'line', plugins: [crosshair], data: { labels: wkY.map(wkLabel), datasets: [{ label: ger ? 'Itens/dia/comprador' : 'Itens/dia', data: ipdW, borderColor: C.blue, backgroundColor: 'rgba(14,83,140,.08)', fill: true, tension: .3, borderWidth: 2, pointRadius: 0, pointHoverRadius: 5, pointHoverBackgroundColor: C.blue }, { label: 'Média do período', data: wkY.map(() => +avgY.toFixed(2)), borderColor: C.mist, borderDash: [6, 4], borderWidth: 1.4, pointRadius: 0, pointHoverRadius: 4, pointHoverBackgroundColor: C.mist, fill: false }] }, options: { maintainAspectRatio: false, interaction: { mode: 'index', intersect: false }, plugins: { tooltip: { mode: 'index', intersect: false, callbacks: { title: c => 'Semana de ' + c[0].label, label: c => c.dataset.label + ': ' + c.parsed.y.toFixed(2) + ' itens/dia' } } }, scales: { x: { ...noG, ticks: { maxTicksLimit: 13, font: { size: 8 } } }, y: { ...soG, beginAtZero: true } } } });

    // Concluídos por comprador (c_pcomp)
    const pcb = ALL.filter(r => r.st === 'C' && r.dc >= DATA_INI && periodHit(r.dc) && tpHit(r));
    const pc = {};
    pcb.forEach(r => { pc[r.cp] = (pc[r.cp] || 0) + 1; });
    const pca = Object.entries(pc).sort((a, b) => b[1] - a[1]).slice(0, 12);
    const clByCompP = {};
    pcb.forEach(r => { const o = clByCompP[r.cp] = clByCompP[r.cp] || { Material: 0, Serviço: 0 }; if (r.cl === 'Material') o.Material++; else if (r.cl === 'Serviço') o.Serviço++; });
    const classColorP = cp => { const o = clByCompP[cp]; if (!o || (!o.Material && !o.Serviço)) return C.steel; return o.Material >= o.Serviço ? C.steel : C.blue; };
    mkChart('c_pcomp', { type: 'bar', data: { labels: pca.map(x => x[0]), datasets: [{ data: pca.map(x => x[1]), backgroundColor: pca.map(x => x[0] === STATE.comp ? C.accent : classColorP(x[0])), borderRadius: 18, barPercentage: 1, categoryPercentage: .85 }] }, options: { legendChips: [['Material', C.steel], ['Serviço', C.blue], ['Selecionado', C.accent]], indexAxis: 'y', maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => c.parsed.x.toLocaleString('pt-BR') + ' itens' } } }, scales: { x: { ...soG, beginAtZero: true }, y: { ...noG, ticks: { font: { size: 10 } } } } } });

    // ===== visuais adicionais: tipo de demanda, entrada x saída, meta, heatmap dia =====
    // Produtividade por tipo de demanda (c_tipo)
    const ctxL = ALL.filter(r => r.dl && r.dl >= DATA_INI && inY(r.dl) && compHit(r) && tpHit(r));
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
    const entC = {}, saiC = {};
    ALL.filter(r => r.dl && r.dl >= DATA_INI && periodHit(r.dl) && compHit(r) && tpHit(r)).forEach(r => { entC[r.cp] = (entC[r.cp] || 0) + 1; });
    ALL.filter(r => r.st === 'C' && r.dc >= DATA_INI && periodHit(r.dc) && compHit(r) && tpHit(r)).forEach(r => { saiC[r.cp] = (saiC[r.cp] || 0) + 1; });
    const compsES = [...new Set([...Object.keys(entC), ...Object.keys(saiC)])].sort((a, b) => (saiC[b] || 0) - (saiC[a] || 0)).slice(0, 12);
    mkChart('c_escomp', { type: 'bar', data: { labels: compsES, datasets: [{ label: 'Entrada', data: compsES.map(c => entC[c] || 0), backgroundColor: C.steel, borderRadius: 18 }, { label: 'Saída', data: compsES.map(c => saiC[c] || 0), backgroundColor: C.teal, borderRadius: 18 }] }, options: { maintainAspectRatio: false, plugins: { legend: { position: 'top', labels: { boxWidth: 11, usePointStyle: true, font: { size: 10 } } } }, scales: { x: { ...noG, ticks: { font: { size: 9 }, maxRotation: 45, minRotation: 35 } }, y: { ...soG, beginAtZero: true } } } });

    // Entrada × saída vs meta de capacidade (c_esmeta)
    const wkInfo = {};
    ctx.forEach(r => { const w = isoWeek(r.dc); const o = (wkInfo[w] = wkInfo[w] || { fa: new Map(), du: new Map(), bs: new Set() }); if (r.fa > 0) o.fa.set(r.fa, (o.fa.get(r.fa) || 0) + 1); if (r.du > 0) o.du.set(r.du, (o.du.get(r.du) || 0) + 1); o.bs.add(r.cp); });
    const modeM = (m, def) => { let b = def, bc = -1; m.forEach((c, v) => { if (c > bc) { bc = c; b = v; } }); return b; };
    const metaV = wksES.map(w => { const o = wkInfo[w]; if (!o) return null; const du = modeM(o.du, 5); const buyers = STATE.comp === 'GERAL' ? (o.fa.size ? modeM(o.fa, o.bs.size) : o.bs.size) : 1; return 7 * buyers * du; });
    mkChart('c_esmeta', { type: 'line', plugins: [crosshair], data: { labels: wksES.map(wkLabelFull), datasets: [{ label: 'Entrada', data: eV, borderColor: C.steel, backgroundColor: 'rgba(90,140,174,.16)', fill: true, tension: .3, borderWidth: 2, pointRadius: 0, pointHoverRadius: 5, pointHoverBackgroundColor: C.steel }, { label: 'Saída', data: sV, borderColor: C.teal, backgroundColor: 'rgba(30,159,127,.14)', fill: true, tension: .3, borderWidth: 2, pointRadius: 0, pointHoverRadius: 5, pointHoverBackgroundColor: C.teal }, { label: 'Meta', data: metaV, borderColor: '#003865', borderDash: [6, 4], borderWidth: 1.6, pointRadius: 0, pointHoverRadius: 5, pointHoverBackgroundColor: '#003865', tension: .2, fill: false }] }, options: { maintainAspectRatio: false, interaction: { mode: 'index', intersect: false }, plugins: { legend: { position: 'top', labels: { boxWidth: 11, usePointStyle: true, font: { size: 9 } } }, tooltip: { mode: 'index', intersect: false, callbacks: { title: c => 'Semana de ' + c[0].label } } }, scales: { x: { ...soG, ticks: { maxTicksLimit: 13, font: { size: 8 }, callback: function (v) { return labES[v]; } } }, y: { ...soG, beginAtZero: true } } } });

    // Itens por faixa de valor de entrada (c_valfaixa)
    const valB = ALL.filter(r => r.dl && r.dl >= DATA_INI && periodHit(r.dl) && compHit(r) && tpHit(r));
    const VF = [['≤ 200k', C.steel], ['200k – 300k', C.blue], ['> 300k', '#003865']];
    const vfIdx = v => v <= 200000 ? 0 : v <= 300000 ? 1 : 2;
    const vfCnt = [0, 0, 0];
    valB.forEach(r => { vfCnt[vfIdx(r.vl)]++; });
    mkChart('c_valfaixa', { type: 'bar', data: { labels: VF.map(x => x[0]), datasets: [{ data: vfCnt, backgroundColor: VF.map(x => x[1]), borderRadius: 18 }] }, options: { maintainAspectRatio: false, layout: { padding: { top: 14 } }, plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => c.parsed.y.toLocaleString('pt-BR') + ' itens' } } }, scales: { x: noG, y: { ...soG, beginAtZero: true } } } });

    // Mapa de calor — produtividade por dia da semana (heat_prod)
    const ctxH = ALL.filter(r => r.st === 'C' && r.dc >= DATA_INI && periodHit(r.dc) && compHit(r) && tpHit(r));
    const DOW = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex'];
    const hp = {};
    ctxH.forEach(r => { const wd = r.dc.getDay(); if (wd < 1 || wd > 5) return; (hp[r.cp] = hp[r.cp] || [0, 0, 0, 0, 0])[wd - 1]++; });
    const rowsP = Object.entries(hp).map(([c, a]) => [c, a, a.reduce((x, y) => x + y, 0)]).sort((a, b) => b[2] - a[2]).slice(0, 12);
    const mxP = Math.max(1, ...rowsP.flatMap(r => r[1]));
    const cellP = v => { if (!v) return '<td class="cell" style="background:#F2F5F6;color:#9AACB5">·</td>'; const a = .10 + .75 * v / mxP; return `<td class="cell" style="background:rgba(14,83,140,${a.toFixed(2)});color:${a > .5 ? '#FFFFFF' : '#13303F'}">${v}</td>`; };
    document.getElementById('heat_prod').innerHTML = `<table><thead><tr><th class="rl"></th>${DOW.map(d => `<th>${d}</th>`).join('')}<th>Total</th></tr></thead><tbody>${rowsP.map(r => `<tr><td class="rl">${r[0]}</td>${r[1].map(cellP).join('')}<td class="cell" style="background:#FBD300;color:#1F2933">${r[2]}</td></tr>`).join('') || '<tr><td class="rl" colspan=7 style="color:#46606F">Sem conclusões no recorte.</td></tr>'}</tbody></table>`;

    // Itens/dia por comprador — taxa individual (c_ipdcomp)
    const ipdBase = ALL.filter(r => r.st === 'C' && r.dc >= DATA_INI && periodHit(r.dc) && tpHit(r));
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
    const msB = ALL.filter(r => r.st === 'C' && r.dc >= DATA_INI && periodHit(r.dc) && compHit(r) && tpHit(r));
    const MSc = ['Material', 'Serviço'];
    const msQ = MSc.map(c => msB.filter(r => r.cl === c).length);
    const totMS = msQ[0] + msQ[1];
    mkChart('c_mat_qtd', { type: 'bar', data: { labels: MSc, datasets: [{ data: msQ, backgroundColor: [C.steel, C.blue], borderRadius: 18 }] }, options: { maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => c.parsed.y.toLocaleString('pt-BR') + ' itens' } } }, scales: { x: noG, y: { ...soG, beginAtZero: true } } } });
    mkChart('c_mat_pct', { type: 'doughnut', data: { labels: MSc, datasets: [{ data: msQ, backgroundColor: [C.steel, C.blue], borderWidth: 2, borderColor: '#FFFFFF' }] }, options: { maintainAspectRatio: false, cutout: '62%', plugins: { legend: { position: 'bottom', labels: { boxWidth: 12, usePointStyle: true } }, tooltip: { callbacks: { label: c => c.parsed.toLocaleString('pt-BR') + ' (' + (totMS ? Math.round(c.parsed / totMS * 100) : 0) + '%)' } } } } });

    // Entrada x Saída total no recorte (c_esgeral)
    const entG = ALL.filter(r => r.dl && r.dl >= DATA_INI && periodHit(r.dl) && compHit(r) && tpHit(r)).length;
    mkChart('c_esgeral', { type: 'bar', data: { labels: ['Entrada', 'Saída'], datasets: [{ data: [entG, msB.length], backgroundColor: [C.steel, C.teal], borderRadius: 18 }] }, options: { maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => c.parsed.y.toLocaleString('pt-BR') + ' RCs' } } }, scales: { x: noG, y: { ...soG, beginAtZero: true } } } });

    // Leitura (texto de insight)
    const t = ating >= 100 ? `acima da meta (${ating.toFixed(0)}%)` : ating >= 80 ? `em atenção (${ating.toFixed(0)}% da meta)` : `abaixo do mínimo (${ating.toFixed(0)}%)`;
    document.getElementById('ins-prod').innerHTML = `<b>Leitura:</b> ${ger ? 'a equipe concluiu em média' : STATE.comp + ' concluiu'} <b>${val.toFixed(2)} ${ger ? 'itens/dia/comprador' : 'itens/dia'}</b> no recorte, ${t}. 100% considera o mix real de Material e Serviço concluídos, contra as metas por classe (Material ${STATE.metaMat}/dia · Serviço ${STATE.metaServ}/dia) — ajuste-as acima se os alvos mudarem.${_fb ? ' <b style="color:#8A6D00">⚠ Valor estimado:</b> a coluna <i>Item/dia/comprador</i> está vazia na base para a(s) semana(s) do recorte, então o itens/dia/comprador foi calculado como Item/dia ÷ compradores ativos. Para o número oficial, preencha o headcount da semana na planilha.' : ''}`;
    SUM.prod = { ating, val, ger, concluidos: base.length, entradas: entG, weeks: cwk.map(wkLabel), weekly: cwk.map(w => cw[w] || 0), entries: cwk.map(w => ew[w] || 0), matLabels: MSc, matQ: msQ, matTot: totMS };
}
function renderAging() {
    // Aging das RCs em aberto — distribuição e KPIs base
    const base = ALLRC.filter(r => r.st === 'A' && r.dl && periodHitAging(r.dl) && compHit(r) && tpHit(r));
    const ag = base.map(r => ({ ...r, age: Math.round((HOJE - r.dl) / 86400000) })).filter(r => r.age >= 0);
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
    // datas válidas e não negativo (zero é válido); consolida por RC (Geral) e por RC+Tipo
    // (Contrato/Spot) usando o MAIOR aging quando os itens da mesma RC divergem — assim uma RC
    // com vários itens não pesa mais que uma com um item só. Filtros de Comprador/Período/Tipo
    // entram só depois de consolidar, sobre os atributos já consolidados da RC.
    const consolidateAging = splitByTipo => {
        const groups = {};
        ALL.forEach(it => {
            const rc = ('' + (it.rc || '')).trim();
            if (!rc || it.st === 'X' || it.rm) return;
            if (splitByTipo && it.td !== 'Contrato' && it.td !== 'Spot') return;
            let age;
            if (it.st === 'A') age = Math.round((HOJE - it.dl) / 86400000);
            else if (it.st === 'C' && it.dl && it.dc) age = Math.round((it.dc - it.dl) / 86400000);
            else return;
            if (!Number.isFinite(age) || age < 0) return;
            const key = splitByTipo ? rc + '|' + it.td : rc;
            const o = groups[key] = groups[key] || { td: it.td, ages: [], cps: [], dl: null, open: false };
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
    const filtRow = r => r.dl && periodHitAging(r.dl) && compHit(r) && tpHit(r);
    const geralAg = consolidateAging(false), tipoAg = consolidateAging(true);
    const gRows = geralAg.rows.filter(filtRow);
    const cRows = tipoAg.rows.filter(r => r.td === 'Contrato').filter(filtRow);
    const sRows = tipoAg.rows.filter(r => r.td === 'Spot').filter(filtRow);
    const statsOf = rows => ({ open: rows.filter(r => r.st === 'A').length, avg: rows.length ? Math.round(rows.reduce((a, r) => a + r.age, 0) / rows.length) : 0 });
    const gSt = statsOf(gRows), cSt = statsOf(cRows), sSt = statsOf(sRows);
    const openItemsTotal = ALL.filter(r => r.st === 'A').length;
    const agDivergentes = geralAg.divergent + tipoAg.divergent;
    const gPct = STATE.metaAgG > 0 ? (gSt.avg - STATE.metaAgG) / STATE.metaAgG * 100 : 0;
    const cPct = STATE.metaAgC > 0 ? (cSt.avg - STATE.metaAgC) / STATE.metaAgC * 100 : 0;
    const sPct = STATE.metaAgS > 0 ? (sSt.avg - STATE.metaAgS) / STATE.metaAgS * 100 : 0;
    const pf = p => (p > 0 ? '+' : '') + p.toFixed(1) + '%';
    kpi('kpi-aging', [
        { l: 'Itens em aberto — Geral', v: openItemsTotal, n: 'total bruto · Status RC = Em Aberto, sem filtro' },
        { l: 'Aging médio — Geral', v: gSt.avg + 'd', c: gPct <= 0 ? 'good' : 'bad', n: 'meta ≤ ' + STATE.metaAgG + 'd' },
        { l: '% vs meta — Geral', v: pf(gPct), c: gPct <= 0 ? 'good' : 'bad', n: gPct <= 0 ? 'dentro da meta' : 'acima da meta' },
        { l: 'RC em aberto — Contrato', v: cSt.open, n: STATE.comp === 'GERAL' ? 'todos compradores' : STATE.comp },
        { l: 'Aging médio — Contrato', v: cSt.avg + 'd', c: cPct <= 0 ? 'good' : 'bad', n: 'meta ≤ ' + STATE.metaAgC + 'd' },
        { l: '% vs meta — Contrato', v: pf(cPct), c: cPct <= 0 ? 'good' : 'bad', n: cPct <= 0 ? 'dentro da meta' : 'acima da meta' },
        { l: 'RC em aberto — Spot', v: sSt.open, n: STATE.comp === 'GERAL' ? 'todos compradores' : STATE.comp },
        { l: 'Aging médio — Spot', v: sSt.avg + 'd', c: sPct <= 0 ? 'good' : 'bad', n: 'meta ≤ ' + STATE.metaAgS + 'd' },
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

    // Evolução do tempo de ciclo (c_agevol) — visão geral, ano completo
    const concl = ALLRC.filter(r => r.st === 'C' && r.dc && r.dl && inYAging(r.dc) && compHit(r) && tpHit(r)).map(r => ({ w: isoWeek(r.dc), cyc: Math.round((r.dc - r.dl) / 86400000) })).filter(r => r.cyc >= 0);
    const byW = {};
    concl.forEach(r => { (byW[r.w] = byW[r.w] || []).push(r.cyc); });
    const wk = Object.keys(byW).sort();
    mkChart('c_agevol', { type: 'line', data: { labels: wk.map(wkLabel), datasets: [{ label: 'Ciclo médio', data: wk.map(w => Math.round(byW[w].reduce((a, b) => a + b, 0) / byW[w].length)), borderColor: C.blue, backgroundColor: 'rgba(14,83,140,.07)', fill: true, tension: .3, borderWidth: 2, pointRadius: 2 }] }, options: { maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => c.parsed.y + 'd' } } }, scales: { x: { ...noG, ticks: { maxTicksLimit: 10, font: { size: 8 } } }, y: { ...soG, beginAtZero: true } } } });

    // Evolução dos itens críticos >30d (c_agcrit)
    const critW = {};
    concl.forEach(r => { if (r.cyc > 30) critW[r.w] = (critW[r.w] || 0) + 1; });
    mkChart('c_agcrit', { type: 'line', data: { labels: wk.map(wkLabel), datasets: [{ label: 'Ciclo >30d', data: wk.map(w => critW[w] || 0), borderColor: C.red, backgroundColor: 'rgba(210,55,60,.10)', fill: true, tension: .3, borderWidth: 2, pointRadius: 2 }] }, options: { maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { ...noG, ticks: { maxTicksLimit: 10, font: { size: 8 } } }, y: { ...soG, beginAtZero: true } } } });

    // Funil — aging por etapa do processo (funnel_aging)
    const et = {};
    ag.forEach(r => { const e = r.et.replace(/^\d+\.?\s*/, '').slice(0, 28) || 'N/D'; et[e] = (et[e] || 0) + 1; });
    const eta = Object.entries(et).sort((a, b) => b[1] - a[1]).slice(0, 8);
    const mxE = Math.max(1, ...eta.map(x => x[1]));
    document.getElementById('funnel_aging').innerHTML = eta.map((x, i) => { const w = Math.max(16, Math.round(x[1] / mxE * 100)); return `<div style="display:flex;align-items:center;gap:10px;margin:5px 0"><div title="${x[0]}" style="width:180px;flex:0 0 180px;font-size:11px;text-align:right;color:#46606F;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${x[0]}</div><div style="height:26px;width:${w}%;background:hsl(205,${48 - i * 2}%,${28 + i * 3}%);border-radius:4px;display:flex;align-items:center;justify-content:center;color:#FFFFFF;font-size:11px;font-weight:700;min-width:32px">${x[1]}</div></div>`; }).join('') || '<div style="color:#46606F;font-size:12px">Sem RCs abertas no recorte.</div>';

    // Tabela detalhada — semáforo de aging (t_aging)
    const sevAg = r => sevOpen(r);
    const tabAll = ALLRC.filter(r => (r.st === 'A' || r.st === 'C') && r.dl && periodHitAging(r.dl) && compHit(r) && tpHit(r)).map(r => { const isOpen = r.st === 'A'; const age = isOpen ? Math.round((HOJE - r.dl) / 86400000) : (r.dc ? Math.round((r.dc - r.dl) / 86400000) : null); return { ...r, age, isOpen }; }).filter(r => r.age != null && r.age >= 0);
    const tab = tabAll.slice().sort((a, b) => b.age - a.age).slice(0, 40);
    document.querySelector('#t_aging tbody').innerHTML = tab.map(r => { const s = sevAg(r); const stBadge = `<span class="tag-sev" style="background:${r.isOpen ? '#E1EDF5' : '#DFF2EA'};color:${r.isOpen ? '#0E538C' : '#14705A'}">${r.isOpen ? 'Em Aberto' : 'Concluída'}</span>`; return `<tr><td>${r.rc || '-'}</td><td>${r.it || '-'}</td><td>${r.cp}</td><td>${stBadge}</td><td>${r.et.replace(/^\d+\.?\s*/, '') || '-'}</td><td class="num">${r.sa || '-'}</td><td class="num">${r.age}</td><td><span class="farol ${s[2]}"></span><span class="tag-sev ${s[0]}">${s[1]}</span></td></tr>`; }).join('') || '<tr><td colspan=8 style="color:#46606F">Nenhuma RC no recorte.</td></tr>';

    // Leitura (texto de insight)
    const critSem = ag.filter(r => sevAg(r)[1] === 'Crítico').length;
    document.getElementById('ins-aging').innerHTML = `<b>Leitura:</b> mediana <b>${med}d</b> vs média <b>${avg}d</b> — a maioria flui, mas <b>${crit} RCs passam de 30 dias</b> e <b>${critSem}</b> estão em criticidade frente ao SLA alvo. ${topAvg.length ? `Maior aging médio: <b>${topAvg[0].cp}</b> (${Math.round(topAvg[0].avg)}d). ` : ''}Use o funil e o backlog por mês para priorizar a limpeza da carteira.${agDivergentes ? ` <b style="color:#8A6D00">⚠ ${agDivergentes} RC(s) com aging divergente entre itens</b> no cálculo de meta Geral/Contrato/Spot — usado o maior aging de cada uma, para controle de qualidade.` : ''}`;
    SUM.aging = { open: gSt.open, openTotal: openItemsTotal, avg: gSt.avg, meta: STATE.metaAgG, crit, faixaLabels: FA.map(x => x[0]), faixaCounts: f, faixaColors: FCOL, con: { open: cSt.open, avg: cSt.avg, meta: STATE.metaAgC, pct: cPct }, spo: { open: sSt.open, avg: sSt.avg, meta: STATE.metaAgS, pct: sPct }, gpct: gPct, matLabels: MSag, matQ: msAgQ, matAvg: msAgAvg };
}
function renderSLA() {
    // KPIs — aderência ao SLA (kpi-sla)
    const base = ALLRC.filter(r => r.st === 'C' && r.dc && r.dc >= DATA_INI && inY(r.dc) && periodHit(r.dc) && compHit(r) && tpHit(r) && (r.ss === 'I' || r.ss === 'F') && !r.srNeg);
    const ins = base.filter(r => r.ss === 'I').length, foraR = base.filter(r => r.ss === 'F'), fora = foraR.length, tot = ins + fora, pct = tot ? ins / tot * 100 : 0;
    const cor = pct >= 90 ? 'good' : pct >= 80 ? 'warn' : 'bad';
    const atrasos = foraR.map(r => r.sr - r.sa).filter(d => d > 0);
    const atrMed = atrasos.length ? Math.round(atrasos.reduce((a, b) => a + b, 0) / atrasos.length) : 0;
    kpi('kpi-sla', [{ l: '% dentro do SLA', v: pct.toFixed(1) + '%', c: cor, p: pct >= 90 ? 'meta 90%' : pct >= 80 ? '80%' : '<80%', pc: pct >= 90 ? 'p-good' : pct >= 80 ? 'p-warn' : 'p-bad' }, { l: 'Base avaliada', v: tot.toLocaleString('pt-BR'), n: 'desde abr/2026' }, { l: 'Fora do SLA', v: fora.toLocaleString('pt-BR'), c: 'bad', n: tot ? (100 - pct).toFixed(1) + '%' : '' }, { l: 'Atraso médio', v: atrMed + 'd', c: 'warn', n: 'além do alvo (Fora)' }]);

    // Evolução do % dentro do SLA (c_slatrend) — visão geral, não muda com Período
    const baseTrend = ALLRC.filter(r => r.st === 'C' && r.dc && r.dc >= DATA_INI && inY(r.dc) && compHit(r) && tpHit(r) && (r.ss === 'I' || r.ss === 'F') && !r.srNeg);
    const bw = {};
    baseTrend.forEach(r => { const w = isoWeek(r.dc); (bw[w] = bw[w] || { i: 0, t: 0 }); bw[w].t++; if (r.ss === 'I') bw[w].i++; });
    const wk = Object.keys(bw).sort();
    mkChart('c_slatrend', { type: 'line', data: { labels: wk.map(w => wkLabel(w)), datasets: [{ label: '% dentro', data: wk.map(w => Math.round(bw[w].i / bw[w].t * 100)), borderColor: C.blue, backgroundColor: 'rgba(14,83,140,.07)', fill: true, tension: .3, borderWidth: 2, pointRadius: 3, pointBackgroundColor: C.blue }, { label: 'Meta 150% (90%)', data: wk.map(() => 90), borderColor: C.teal, borderDash: [6, 4], borderWidth: 1.4, pointRadius: 0, fill: false }, { label: 'Meta 100% (80%)', data: wk.map(() => 80), borderColor: C.amber, borderDash: [6, 4], borderWidth: 1.3, pointRadius: 0, fill: false }, { label: 'Meta 90% (75%)', data: wk.map(() => 75), borderColor: C.red, borderDash: [6, 4], borderWidth: 1.2, pointRadius: 0, fill: false }] }, options: { maintainAspectRatio: false, plugins: { legend: { position: 'top', labels: { boxWidth: 12, usePointStyle: true, font: { size: 10 } } } }, scales: { x: { ...noG, ticks: { font: { size: 9 } } }, y: { ...soG, min: 0, max: 100, ticks: { callback: v => v + '%' } } } } });

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

    // Tabela detalhada — RCs críticas por farol (t_crit)
    const sev = d => d > 15 ? ['f-rd', 's-rd', 'Crítico'] : d > 7 ? ['f-or', 's-or', 'Além do normal'] : ['f-am', 's-am', 'Fora do prazo'];
    const crit = foraR.map(r => ({ ...r, atr: r.sr - r.sa })).filter(r => r.atr > 0).sort((a, b) => b.atr - a.atr).slice(0, 40);
    document.querySelector('#t_crit tbody').innerHTML = crit.map(r => { const s = sev(r.atr); return `<tr><td>${r.rc || '-'}</td><td>${r.cp}</td><td>Concluída</td><td class="num">${r.atr}</td><td><span class="farol ${s[0]}"></span><span class="tag-sev ${s[1]}">${s[2]}</span></td></tr>`; }).join('') || '<tr><td colspan=5 style="color:#46606F">Sem RCs fora do SLA no recorte.</td></tr>';

    // Leitura (texto de insight)
    const pior = ca[0], melhor = ca[ca.length - 1], topcause = par[0];
    document.getElementById('ins-sla').innerHTML = tot ? `<b>Leitura:</b> aderência de <b>${pct.toFixed(1)}%</b> (meta 90%), atraso médio de <b>${atrMed} dias</b> quando fura. ${topcause ? `A maior causa de atraso é <b>${topcause[0]}</b> (${Math.round(topcause[1] / tt * 100)}% dos casos). ` : ''}${ca.length > 1 ? `Dispersão: ${melhor[0]} em ${melhor[1].toFixed(0)}% contra ${pior[0]} em ${pior[1].toFixed(0)}%. ` : ''}Use a tabela-farol para agir nas críticas.` : '<b>Sem RCs concluídas no recorte (desde abr/2026).</b>';
    SUM.sla = { pct, tot, fora, atrMed, crit: foraR.filter(r => r.sr - r.sa > 15).length, weeks: wk.map(wkLabel), weekly: wk.map(w => bw[w] ? Math.round(bw[w].i / bw[w].t * 100) : 0), matLabels: MS, matQ: msV, matPct: msP };
}
function renderSaving() {
    // KPIs — saving e taxa de economia (kpi-saving)
    const base = ALL.filter(r => r.vp > 0 && r.vn > 0 && r.st !== 'X' && r.st !== 'D' && periodHit(r.dc) && compHit(r) && tpHit(r));
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
    mkChart('c_savwaterfall', { type: 'bar', data: { labels: ['1ª Proposta', 'Saving', 'Negociado'], datasets: [{ data: [[0, totP], [totN, totP], [0, totN]], backgroundColor: [C.steel, totS >= 0 ? C.teal : C.red, C.blue], borderRadius: 18, barPercentage: .55 }] }, options: { maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => BRL(c.raw[1] - c.raw[0]) } } }, scales: { x: noG, y: { ...soG, beginAtZero: true, ticks: { callback: Kf } } } } });
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

    // Rollup por RC direto da segundaBase (única fonte desta aba) — carteira e tipo predominantes
    // entre os itens da RC; data = menor DT Pedido entre os itens
    const byRC = {};
    CARTEIRAS.forEach(r => { (byRC[r.rc] = byRC[r.rc] || []).push(r); });
    const rcRows = Object.keys(byRC).map(rc => {
        const items = byRC[rc];
        const carCount = {}, tdCount = {};
        let dt = null, matN = 0, servN = 0;
        items.forEach(it => {
            if (it.car) carCount[it.car] = (carCount[it.car] || 0) + 1;
            tdCount[it.td] = (tdCount[it.td] || 0) + 1;
            if (it.ms === 'Material') matN++;
            else if (it.ms === 'Serviço') servN++;
            if (it.dt && (!dt || it.dt < dt)) dt = it.dt;
        });
        let car = '', bcCar = -1;
        Object.entries(carCount).forEach(([c, n]) => { if (n > bcCar) { bcCar = n; car = c; } });
        let td = 'N/D', bcTd = -1;
        Object.entries(tdCount).forEach(([t, n]) => { if (n > bcTd) { bcTd = n; td = t; } });
        return { rc, it: items.length, car, td, dt, matN, servN };
    });

    // Recorte: respeita Período e Tipo de compra do painel lateral; a segundaBase não tem
    // Comprador Responsável nem Status RC, então o filtro de comprador não se aplica aqui
    const base = rcRows.filter(r => r.dt && r.dt >= DATA_INI_AGING && periodHit(r.dt) && tpHit(r));
    const carOf = r => r.car || '';
    const typeOf = r => r.td || 'N/D';

    const typeCounts = {};
    base.forEach(r => { const t = typeOf(r); typeCounts[t] = (typeCounts[t] || 0) + 1; });
    const nCon = typeCounts['Contrato'] || 0, nSpo = typeCounts['Spot'] || 0, nOut = base.length - nCon - nSpo;
    const pctCon = base.length ? nCon / base.length * 100 : 0, pctSpo = base.length ? nSpo / base.length * 100 : 0;
    const kpiContr = [
        { l: 'RCs Contrato', v: nCon.toLocaleString('pt-BR'), n: pctCon.toFixed(0) + '% do recorte' },
        { l: 'RCs Spot', v: nSpo.toLocaleString('pt-BR'), n: pctSpo.toFixed(0) + '% do recorte' }
    ];

    // Qualidade do dado: quantas RCs do recorte têm Material/Serviço e Carteira preenchidos na própria segundaBase
    if (cartLoaded) {
        const matSum = base.reduce((a, r) => a + r.matN, 0), servSum = base.reduce((a, r) => a + r.servN, 0);
        const totMS = matSum + servSum;
        const identificadas = base.filter(r => r.matN + r.servN > 0).length;
        const semCar = base.filter(r => !r.car).length;
        kpiContr.push({ l: 'Identificado (Material/Serviço)', v: identificadas.toLocaleString('pt-BR') + ' RCs', n: totMS ? Math.round(matSum / totMS * 100) + '% Material · ' + Math.round(servSum / totMS * 100) + '% Serviço' : '—' });
        kpiContr.push({ l: 'Sem Carteira preenchida', v: semCar.toLocaleString('pt-BR') + ' RCs', c: semCar > 0 ? 'warn' : 'good', n: base.length ? Math.round(semCar / base.length * 100) + '% do recorte' : '—' });
    }
    document.getElementById('kpi-contr').classList.toggle('k3', !cartLoaded);
    kpi('kpi-contr', kpiContr);

    // Contrato × Spot — Geral: soma de todas as carteiras, uma coluna 100% empilhada (c_contrmix)
    const conSpoTot = nCon + nSpo;
    const mixConPct = conSpoTot ? Math.round(nCon / conSpoTot * 100) : 0;
    const mixSpoPct = conSpoTot ? 100 - mixConPct : 0;
    mkChart('c_contrmix', { type: 'bar', plugins: [stackPctLabels], data: { labels: ['Geral'], datasets: [{ label: 'Contrato', data: [mixConPct], backgroundColor: CCON, stack: 's' }, { label: 'Spot', data: [mixSpoPct], backgroundColor: C.steel, stack: 's' }] }, options: { maintainAspectRatio: false, plugins: { legend: { position: 'top', labels: { boxWidth: 11, usePointStyle: true, font: { size: 10 } } }, tooltip: { callbacks: { label: c => c.dataset.label + ': ' + c.parsed.y + '%' } } }, scales: { x: { stacked: true, ...noG }, y: { stacked: true, ...soG, min: 0, max: 100, ticks: { callback: v => v + '%' } } } } });

    // Contrato × Spot — Material e Serviço: mesma coluna 100% empilhada, cada uma só com os itens da classe (c_contrmix_mat/serv)
    const baseRCSet = new Set(base.map(r => r.rc));
    const msMix = { Material: { Contrato: 0, Spot: 0 }, Serviço: { Contrato: 0, Spot: 0 } };
    CARTEIRAS.forEach(it => {
        if (!baseRCSet.has(it.rc) || (it.ms !== 'Material' && it.ms !== 'Serviço')) return;
        if (it.td === 'Contrato') msMix[it.ms].Contrato++;
        else if (it.td === 'Spot') msMix[it.ms].Spot++;
    });
    const mkMixChart = (id, counts, tot) => {
        const conPct = tot ? Math.round(counts.Contrato / tot * 100) : 0, spoPct = tot ? 100 - conPct : 0;
        mkChart(id, { type: 'bar', plugins: [stackPctLabels], data: { labels: ['Geral'], datasets: [{ label: 'Contrato', data: [conPct], backgroundColor: CCON, stack: 's' }, { label: 'Spot', data: [spoPct], backgroundColor: C.steel, stack: 's' }] }, options: { maintainAspectRatio: false, plugins: { legend: { position: 'top', labels: { boxWidth: 11, usePointStyle: true, font: { size: 10 } } }, tooltip: { callbacks: { label: c => c.dataset.label + ': ' + c.parsed.y + '%' } } }, scales: { x: { stacked: true, ...noG }, y: { stacked: true, ...soG, min: 0, max: 100, ticks: { callback: v => v + '%' } } } } });
    };
    mkMixChart('c_contrmix_mat', msMix.Material, msMix.Material.Contrato + msMix.Material.Spot);
    mkMixChart('c_contrmix_serv', msMix.Serviço, msMix.Serviço.Contrato + msMix.Serviço.Spot);

    // Contrato e Spot como tipos principais + demais tipos individualmente (não agrupados em "Outros")
    const typesOther = Object.keys(typeCounts).filter(t => t !== 'Contrato' && t !== 'Spot').sort((a, b) => a === 'N/D' ? 1 : b === 'N/D' ? -1 : typeCounts[b] - typeCounts[a]);
    const typeList = ['Contrato', 'Spot', ...typesOther];
    const OTH_PAL = [C.teal, C.amber, C.blue, '#7FE06C', '#E9C400', '#35505E', '#B7D3E8', '#7A8C97', '#8FCDBA', '#CAD6DD'];
    const colorMap = {};
    typeList.forEach((t, i) => { colorMap[t] = t === 'Contrato' ? CCON : t === 'Spot' ? C.steel : t === 'N/D' ? '#CAD6DD' : OTH_PAL[(i - 2) % OTH_PAL.length]; });

    // RCs por Código de Carteira — G/S/R e demais (c_ccd) — raiz da carteira, direto da segundaBase
    const rootLetter = code => { const m = /^[A-Za-z]/.exec((code || '').trim()); return m ? m[0].toUpperCase() : ''; };
    const cdOrder = ['G', 'S', 'R', 'A'];
    const ALLOWED_CD = ['G', 'S', 'R', 'A', 'N/D'];
    const cdOf = r => { const c = rootLetter(carOf(r)) || 'N/D'; return ALLOWED_CD.includes(c) ? c : 'A'; };
    const byCd = {};
    base.forEach(r => { const c = cdOf(r); byCd[c] = (byCd[c] || 0) + 1; });
    const cdKeys = Object.keys(byCd).sort((a, b) => { const ia = cdOrder.indexOf(a), ib = cdOrder.indexOf(b); if (ia > -1 && ib > -1) return ia - ib; if (ia > -1) return -1; if (ib > -1) return 1; if (a === 'N/D') return 1; if (b === 'N/D') return -1; return a.localeCompare(b); });
    const cdCOL = k => k === 'G' ? '#1E9F7F' : k === 'S' ? '#0E538C' : k === 'R' ? '#D9A400' : k === 'N/D' ? '#9AACB5' : C.red;
    mkChart('c_ccd', { type: 'bar', data: { labels: cdKeys, datasets: [{ data: cdKeys.map(k => byCd[k]), backgroundColor: cdKeys.map(cdCOL), borderRadius: 18 }] }, options: { maintainAspectRatio: false, layout: { padding: { top: 16 } }, plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => c.parsed.y.toLocaleString('pt-BR') + ' RCs' } } }, scales: { x: noG, y: { ...soG, beginAtZero: true } } } });

    // % Contrato × Spot por carteira G — 100% empilhado, uma coluna por carteira G específica (c_ccd_tipo)
    const byGCar = {};
    base.forEach(r => {
        const code = carOf(r);
        if (rootLetter(code) !== 'G') return;
        const t = typeOf(r);
        const o = byGCar[code] = byGCar[code] || {};
        o[t] = (o[t] || 0) + 1;
    });
    const gCarArr = Object.entries(byGCar).map(([c, o]) => ({ c, o, tot: Object.values(o).reduce((a, v) => a + v, 0) })).sort((a, b) => b.tot - a.tot);
    const gCarKeys = gCarArr.map(x => x.c);
    mkChart('c_ccd_tipo', { type: 'bar', plugins: [stackPctLabels], data: { labels: gCarKeys, datasets: typeList.map(t => ({ label: t, data: gCarArr.map(x => x.tot ? Math.round((x.o[t] || 0) / x.tot * 100) : 0), backgroundColor: colorMap[t], stack: 's' })) }, options: { maintainAspectRatio: false, plugins: { legend: { position: 'top', labels: { boxWidth: 11, usePointStyle: true, font: { size: 10 } } }, tooltip: { callbacks: { label: c => c.dataset.label + ': ' + c.parsed.y + '%' } } }, scales: { x: { stacked: true, ...noG, ticks: { font: { size: 9 }, maxRotation: 45, minRotation: 35 } }, y: { stacked: true, ...soG, min: 0, max: 100, ticks: { callback: v => v + '%' } } } } });

    // Carteira/Categoria por RC — só o código (G35, S12...); sem carteira preenchida na segundaBase, cai em N/D
    // (mantido só para a tabela detalhada e o resumo usado na apresentação — os gráficos foram removidos)
    const catOf = r => carOf(r) || 'N/D';
    const byCat = {};
    base.forEach(r => { const c = catOf(r); const t = typeOf(r); const o = byCat[c] = byCat[c] || {}; o[t] = (o[t] || 0) + 1; });
    const cats = Object.entries(byCat).map(([c, o]) => ({ c, o, tot: typeList.reduce((a, t) => a + (o[t] || 0), 0) })).sort((a, b) => b.tot - a.tot).slice(0, 15);
    const top8 = cats.slice(0, 8);

    // Evolução semanal — Contrato x Spot, demais tipos agregados (c_contrevol) — por semana da Data do Pedido
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

    // Leitura (texto de insight)
    const topCat = cats[0], nd = byCat['N/D'], ndTot = nd ? Object.values(nd).reduce((a, v) => a + v, 0) : 0;
    const topOther = typesOther.find(t => t !== 'N/D');
    document.getElementById('ins-contr').innerHTML = base.length ? `<b>Leitura:</b> no recorte (segundaBase) entraram <b>${nCon} RCs de Contrato</b> e <b>${nSpo} RCs de Spot</b> (${pctCon.toFixed(0)}% / ${pctSpo.toFixed(0)}% do mix)${topOther ? `, além de <b>${nOut} RCs em outros tipos</b> — o mais comum é <b>${topOther}</b> (${typeCounts[topOther]}). ` : '. '}${topCat ? `Carteira com maior volume: <b>${topCat.c}</b> (${topCat.tot} RCs). ` : ''}${ndTot ? `<b style="color:#8A6D00">⚠ ${ndTot} RCs (${Math.round(ndTot / base.length * 100)}%) estão sem Carteira/Categoria preenchida</b> — priorize o preenchimento para uma leitura confiável por carteira.` : ''}` : (cartLoaded ? '<b>Sem RCs no recorte.</b>' : '<b>Carregue a base de carteiras (2º arquivo) para ver esta aba.</b>');
    SUM.contr = { nCon, nSpo, nOut, pctCon, pctSpo, total: base.length, top: top8.map(x => ({ c: x.c, tot: x.tot })) };
}
function renderCompradores() {
    // Base independente do filtro Comprador (compHit) — para permitir comparação entre todos
    const doneBase = ALL.filter(r => r.st === 'C' && r.dc >= DATA_INI && periodHit(r.dc) && tpHit(r));
    const openBase = ALLRC.filter(r => r.st === 'A' && r.dl && r.dl >= DATA_INI && periodHit(r.dl) && tpHit(r));
    const slaBase = ALLRC.filter(r => r.st === 'C' && r.dc && r.dc >= DATA_INI && periodHit(r.dc) && tpHit(r) && (r.ss === 'I' || r.ss === 'F') && !r.srNeg);
    const savBase = ALL.filter(r => r.vp > 0 && r.vn > 0 && r.st !== 'X' && r.st !== 'D' && periodHit(r.dc) && tpHit(r));
    const comps = [...new Set([...doneBase, ...openBase, ...slaBase, ...savBase].map(r => r.cp))].filter(c => c && c !== 'N/D').sort();
    const rows = comps.map(cp => {
        const done = doneBase.filter(r => r.cp === cp);
        const byW = {};
        done.forEach(r => { const w = isoWeek(r.dc); byW[w] = (byW[w] || 0) + r.ipd; });
        const wks = Object.keys(byW);
        const ipd = wks.length ? wks.reduce((a, w) => a + byW[w], 0) / wks.length : 0;
        const open = openBase.filter(r => r.cp === cp);
        const ages = open.map(r => Math.round((HOJE - r.dl) / 86400000)).filter(a => a >= 0);
        const agingAvg = ages.length ? Math.round(ages.reduce((a, b) => a + b, 0) / ages.length) : null;
        const sla = slaBase.filter(r => r.cp === cp);
        const slaPct = sla.length ? sla.filter(r => r.ss === 'I').length / sla.length * 100 : null;
        const sav = savBase.filter(r => r.cp === cp);
        const saving = sav.reduce((a, r) => a + (r.vp - r.vn), 0);
        return { cp, concl: done.length, ipd, openN: open.length, agingAvg, slaPct, slaN: sla.length, saving, matN: done.filter(r => r.cl === 'Material').length, servN: done.filter(r => r.cl === 'Serviço').length };
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
    const ageColor = r => r.agingAvg == null ? '#7A8C97' : r.agingAvg <= 15 ? C.teal : r.agingAvg <= 30 ? C.amber : C.red;
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
        const ageTxt = r.agingAvg != null ? r.agingAvg + 'd' : '—', ageCol = r.agingAvg == null ? '' : r.agingAvg <= 15 ? '#14705A' : r.agingAvg <= 30 ? '#8A6D00' : '#C0272D';
        const bg = r.cp === STATE.comp ? 'background:rgba(0,56,101,.07)' : '';
        return `<tr class="jump" data-cp="${r.cp}" style="${bg}"><td>${r.cp}</td><td class="num">${r.concl.toLocaleString('pt-BR')}</td><td class="num">${r.ipd.toFixed(2)}</td><td class="num">${r.openN}</td><td class="num" style="color:${ageCol}">${ageTxt}</td><td class="num" style="color:${slaCol}">${slaTxt}</td><td class="num" style="${r.saving < 0 ? 'color:#C0272D' : ''}">${BRL(r.saving)}</td></tr>`;
    }).join('') || '<tr><td colspan="7" style="color:#46606F">Nenhum comprador com dados no recorte.</td></tr>';
    document.querySelectorAll('#t_comp thead th[data-key]').forEach(th => th.onclick = () => { const k = th.dataset.key; if (compSort.key === k) compSort.dir *= -1; else { compSort.key = k; compSort.dir = k === 'cp' ? 1 : -1; } renderCompradores(); });
    document.querySelectorAll('#t_comp tbody tr.jump').forEach(tr => tr.onclick = () => { const cp = tr.dataset.cp; STATE.comp = STATE.comp === cp ? 'GERAL' : cp; render(); });

    // RCs em aberto — acompanhamento do time (t_rcopen_all)
    renderOpenRCPanel('t_rcopen_all', 'sum_rcopen_all', openRCsFor(null), true, false);

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
    const doneP = ALL.filter(r => r.st === 'C' && r.dc >= DATA_INI && periodHit(r.dc) && tpHit(r) && r.cp === cp);
    const doneY = ALL.filter(r => r.st === 'C' && r.dc >= DATA_INI && inY(r.dc) && tpHit(r) && r.cp === cp);
    const cw = {};
    doneY.forEach(r => { const w = isoWeek(r.dc); cw[w] = (cw[w] || 0) + 1; });
    const cwk = Object.keys(cw).sort();

    // Média do time por semana (ano completo) — mesma base, todos os compradores
    const doneYAll = ALL.filter(r => r.st === 'C' && r.dc >= DATA_INI && inY(r.dc) && tpHit(r));
    const cwAll = {}, cwBuyers = {};
    doneYAll.forEach(r => { const w = isoWeek(r.dc); cwAll[w] = (cwAll[w] || 0) + 1; (cwBuyers[w] = cwBuyers[w] || new Set()).add(r.cp); });
    const teamAvg = w => cwBuyers[w] && cwBuyers[w].size ? +(cwAll[w] / cwBuyers[w].size).toFixed(2) : 0;

    // Itens/dia — média das semanas no recorte
    const byWI = {};
    doneP.forEach(r => { const w = isoWeek(r.dc); byWI[w] = (byWI[w] || 0) + r.ipd; });
    const wksI = Object.keys(byWI);
    const ipdVal = wksI.length ? wksI.reduce((a, w) => a + byWI[w], 0) / wksI.length : 0;

    // Aging — RCs abertas no recorte
    const openP = ALLRC.filter(r => r.st === 'A' && r.dl && r.dl >= DATA_INI && periodHit(r.dl) && tpHit(r) && r.cp === cp);
    const agesP = openP.map(r => Math.round((HOJE - r.dl) / 86400000)).filter(a => a >= 0);
    const agingAvg = agesP.length ? Math.round(agesP.reduce((a, b) => a + b, 0) / agesP.length) : null;
    const critN = agesP.filter(a => a > 30).length;
    const fCounts = FA.map(() => 0);
    agesP.forEach(a => fCounts[faIdx(a)]++);

    // SLA — recorte (KPI) e ano completo (tendência semanal)
    const slaP = ALLRC.filter(r => r.st === 'C' && r.dc && r.dc >= DATA_INI && periodHit(r.dc) && tpHit(r) && r.cp === cp && (r.ss === 'I' || r.ss === 'F') && !r.srNeg);
    const slaPct = slaP.length ? slaP.filter(r => r.ss === 'I').length / slaP.length * 100 : null;
    const slaY = ALLRC.filter(r => r.st === 'C' && r.dc && r.dc >= DATA_INI && inY(r.dc) && tpHit(r) && r.cp === cp && (r.ss === 'I' || r.ss === 'F') && !r.srNeg);
    const bwS = {};
    slaY.forEach(r => { const w = isoWeek(r.dc); (bwS[w] = bwS[w] || { i: 0, t: 0 }); bwS[w].t++; if (r.ss === 'I') bwS[w].i++; });
    const wkS = Object.keys(bwS).sort();

    // Saving — recorte
    const savP = ALL.filter(r => r.vp > 0 && r.vn > 0 && r.st !== 'X' && r.st !== 'D' && periodHit(r.dc) && tpHit(r) && r.cp === cp);
    const savTotal = savP.reduce((a, r) => a + (r.vp - r.vn), 0);
    const bwV = {};
    savP.forEach(r => { if (!r.dc) return; const w = isoWeek(r.dc); bwV[w] = (bwV[w] || 0) + (r.vp - r.vn); });
    const wkV = Object.keys(bwV).sort();

    // Mix Contrato x Spot — RCs liberadas no recorte
    const relP = ALLRC.filter(r => r.dl && r.dl >= DATA_INI && periodHit(r.dl) && tpHit(r) && r.cp === cp);
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
        { l: 'RCs críticas de aging', v: critN, c: critN > 0 ? 'warn' : 'good', n: 'ciclo aberto > 30 dias' }
    ]);
    mkChart('c_ind_prod', { data: { labels: cwk.map(wkLabel), datasets: [{ type: 'bar', label: cp, data: cwk.map(w => cw[w]), backgroundColor: C.steel, borderRadius: 18, order: 2 }, { type: 'line', label: 'Média do time', data: cwk.map(teamAvg), borderColor: '#003865', borderWidth: 2, pointRadius: 0, tension: .3, fill: false, order: 1 }] }, options: { maintainAspectRatio: false, plugins: { legend: { position: 'top', labels: { boxWidth: 10, usePointStyle: true, font: { size: 9 } } } }, scales: { x: { ...noG, ticks: { maxTicksLimit: 8, font: { size: 8 } } }, y: { ...soG, beginAtZero: true } } } });
    mkChart('c_ind_aging', { type: 'bar', data: { labels: FA.map(x => x[0]), datasets: [{ data: fCounts, backgroundColor: FCOL, borderRadius: 18 }] }, options: { maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: noG, y: { ...soG, beginAtZero: true } } } });
    mkChart('c_ind_sla', { type: 'line', data: { labels: wkS.map(wkLabel), datasets: [{ data: wkS.map(w => Math.round(bwS[w].i / bwS[w].t * 100)), borderColor: C.blue, backgroundColor: 'rgba(14,83,140,.08)', fill: true, tension: .3, borderWidth: 2, pointRadius: 0 }] }, options: { maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { ...noG, ticks: { maxTicksLimit: 8, font: { size: 8 } } }, y: { ...soG, min: 0, max: 100, ticks: { callback: v => v + '%' } } } } });
    mkChart('c_ind_saving', { type: 'bar', data: { labels: wkV.map(wkLabel), datasets: [{ data: wkV.map(w => bwV[w]), backgroundColor: C.teal, borderRadius: 18 }] }, options: { maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => BRL(c.parsed.y) } } }, scales: { x: { ...noG, ticks: { maxTicksLimit: 8, font: { size: 8 } } }, y: { ...soG, beginAtZero: true, ticks: { callback: Kf } } } } });
    mkChart('c_ind_mix', { type: 'doughnut', data: { labels: ['Material', 'Serviço'], datasets: [{ data: [matN, servN], backgroundColor: [C.steel, C.blue], borderWidth: 2, borderColor: '#FFFFFF' }] }, options: { maintainAspectRatio: false, cutout: '62%', plugins: { legend: { position: 'bottom', labels: { boxWidth: 12, usePointStyle: true } } } } });

    // RCs em aberto — acompanhamento individual (t_rcopen_ind)
    renderOpenRCPanel('t_rcopen_ind', 'sum_rcopen_ind', openRCsFor(cp), false);
    document.getElementById('ins-individual').innerHTML = `<b>Leitura:</b> ${cp} concluiu <b>${doneP.length} itens</b> (<b>${ipdVal.toFixed(2)} itens/dia</b>, ${dIpd >= 0 ? '+' : ''}${dIpd.toFixed(0)}% vs média do time), tem <b>${openP.length} RCs abertas</b>${agingAvg != null ? ` (aging médio ${agingAvg}d)` : ''} e está em <b>${slaPct != null ? slaPct.toFixed(1) + '%' : '—'}</b> dentro do SLA. Saving capturado: <b>${Kf(savTotal)}</b>. Mix de entrada: <b>${nConP} RCs Contrato</b> e <b>${nSpoP} RCs Spot</b>.${critN > 0 ? ` <b style="color:#8A6D00">⚠ ${critN} RC(s) com aging acima de 30 dias.</b>` : ''}`;
}
function scoreRow(t, mod, ind, val, ref, status, label) {
    return `<tr class="jump" data-t="${t}"><td>${mod}</td><td>${ind}</td><td class="num">${val}</td><td class="num">${ref}</td><td><span class="pill p-${status}">${label}</span></td></tr>`;
}

function renderOverview() {
    const P = SUM.prod, A = SUM.aging, S = SUM.sla, V = SUM.saving;
    if (!P || !A || !S || !V) return;

    // Mix Contrato × Spot — direto da base principal (classificação própria "tp"), sem depender da segundaBase (exclusiva da aba Contratualização)
    const mixBase = ALLRC.filter(r => r.dl && r.dl >= DATA_INI_AGING && periodHit(r.dl) && compHit(r) && tpHit(r));
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
    mkChart('c_ov_sla', { type: 'line', data: { labels: S.weeks, datasets: [{ data: S.weekly, borderColor: C.blue, backgroundColor: 'rgba(14,83,140,.08)', fill: true, tension: .3, borderWidth: 2, pointRadius: 0 }] }, options: { maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { ...noG, ticks: { maxTicksLimit: 8, font: { size: 8 } } }, y: { ...soG, min: 0, max: 100, ticks: { callback: v => v + '%' } } } } });
    mkChart('c_ov_saving', { type: 'bar', data: { labels: V.weeks, datasets: [{ data: V.weekly, backgroundColor: C.teal, borderRadius: 18 }] }, options: { maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => BRL(c.parsed.y) } } }, scales: { x: { ...noG, ticks: { maxTicksLimit: 8, font: { size: 8 } } }, y: { ...soG, beginAtZero: true, ticks: { callback: Kf } } } } });
    mkChart('c_ov_contr', { type: 'doughnut', data: { labels: ['Contrato', 'Spot', 'Outros'], datasets: [{ data: [K.nCon, K.nSpo, K.nOut], backgroundColor: ['#003865', C.steel, '#CAD6DD'], borderWidth: 2, borderColor: '#FFFFFF' }] }, options: { maintainAspectRatio: false, cutout: '62%', plugins: { legend: { position: 'bottom', labels: { boxWidth: 11, usePointStyle: true, font: { size: 10 } } } } } });
    mkChart('c_ov_mat_qtd', { type: 'bar', data: { labels: P.matLabels, datasets: [{ data: P.matQ, backgroundColor: [C.steel, C.blue], borderRadius: 18 }] }, options: { maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => c.parsed.y.toLocaleString('pt-BR') + ' itens' } } }, scales: { x: noG, y: { ...soG, beginAtZero: true } } } });
    mkChart('c_ov_mat_pct', { type: 'doughnut', data: { labels: P.matLabels, datasets: [{ data: P.matQ, backgroundColor: [C.steel, C.blue], borderWidth: 2, borderColor: '#FFFFFF' }] }, options: { maintainAspectRatio: false, cutout: '62%', plugins: { legend: { position: 'bottom', labels: { boxWidth: 11, usePointStyle: true, font: { size: 10 } } }, tooltip: { callbacks: { label: c => c.parsed.toLocaleString('pt-BR') + ' (' + (P.matTot ? Math.round(c.parsed / P.matTot * 100) : 0) + '%)' } } } } });
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
