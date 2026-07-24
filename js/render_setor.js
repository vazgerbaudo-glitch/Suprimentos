// Versão "Setores" do motor de renderização — mesma leitura de CSV e os mesmos gráficos/tabelas
// do painel Compras Ágeis, mas sem metas estabelecidas: nada de metas configuráveis (Material/Serviço,
// Aging Geral/Contrato/Spot, linhas de meta de SLA/Saving) e sem os cartões/pills que comparam contra elas.
// Abas mantidas: Visão Geral, Compradores, Aging, SLA, Saving, Produtividade (Contratualização não entra aqui).

function kpiCardHTML(k) {
    return `<div class="kpi ${k.c || ''}"><div class="lbl">${k.l}</div><div class="val">${k.v}</div>${k.p ? `<span class="pill ${k.pc}">${k.p}</span>` : ''}${k.n ? `<div class="note">${k.n}</div>` : ''}</div>`;
}
function kpi(el, a) {
    document.getElementById(el).innerHTML = a.map(kpiCardHTML).join('');
}
function fmtDia(d) {
    return d ? String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0') + '/' + String(d.getFullYear()).slice(2) : '—';
}
// Semáforo de RC aberta vs. SLA Alvo da própria RC (dado da base, não é meta configurável)
function sevOpen(r) {
    const lim = r.sa > 0 ? r.sa : 15;
    if (r.age > lim) return ['s-rd', 'Crítico', 'f-rd'];
    if (lim - r.age <= 2) return ['s-or', 'Atenção', 'f-or'];
    return ['s-am', 'Dentro do prazo', 'f-am'];
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

function render() {
    ALLRC = rollupRC(ALL);
    renderProd();
    renderAging();
    renderSLA();
    renderSaving();
    renderCompradores();
    renderOverview();
}

function renderProd() {
    const base = ALL.filter(r => r.st === 'C' && r.dc >= DATA_INI && periodHit(r.dc) && compHit(r) && tpHit(r));
    const byW = {};
    base.forEach(r => {
        const w = isoWeek(r.dc);
        const o = (byW[w] = byW[w] || { ipd: 0, ipc: 0, bs: new Set() });
        o.ipd += r.ipd; o.ipc += r.ipc; o.bs.add(r.cp);
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
    kpi('kpi-prod', [
        { l: ger ? 'Itens/dia/comprador' : 'Itens/dia', v: val.toFixed(2), n: 'média do recorte' },
        { l: 'Itens concluídos', v: base.length.toLocaleString('pt-BR'), n: 'no recorte' },
        { l: 'Semanas no recorte', v: weeks.length, n: STATE.comp === 'GERAL' ? 'todos compradores' : STATE.comp }
    ]);

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
    const entC = {}, saiC = {};
    ALL.filter(r => r.dl && r.dl >= DATA_INI && periodHit(r.dl) && compHit(r) && tpHit(r)).forEach(r => { entC[r.cp] = (entC[r.cp] || 0) + 1; });
    ALL.filter(r => r.st === 'C' && r.dc >= DATA_INI && periodHit(r.dc) && compHit(r) && tpHit(r)).forEach(r => { saiC[r.cp] = (saiC[r.cp] || 0) + 1; });
    const compsES = [...new Set([...Object.keys(entC), ...Object.keys(saiC)])].sort((a, b) => (saiC[b] || 0) - (saiC[a] || 0)).slice(0, 12);
    mkChart('c_escomp', { type: 'bar', data: { labels: compsES, datasets: [{ label: 'Entrada', data: compsES.map(c => entC[c] || 0), backgroundColor: C.steel, borderRadius: 18 }, { label: 'Saída', data: compsES.map(c => saiC[c] || 0), backgroundColor: C.teal, borderRadius: 18 }] }, options: { maintainAspectRatio: false, plugins: { legend: { position: 'top', labels: { boxWidth: 11, usePointStyle: true, font: { size: 10 } } } }, scales: { x: { ...noG, ticks: { font: { size: 9 }, maxRotation: 45, minRotation: 35 } }, y: { ...soG, beginAtZero: true } } } });

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

    // Itens/dia por comprador — taxa individual (c_ipdcomp), sem linhas de meta
    const ipdBase = ALL.filter(r => r.st === 'C' && r.dc >= DATA_INI && periodHit(r.dc) && tpHit(r));
    const ipdMap = {};
    ipdBase.forEach(r => { const m = ipdMap[r.cp] = ipdMap[r.cp] || {}; const w = isoWeek(r.dc); m[w] = (m[w] || 0) + r.ipd; });
    const ipdAvg = {};
    Object.keys(ipdMap).forEach(cp => { const vs = Object.values(ipdMap[cp]); ipdAvg[cp] = vs.reduce((a, b) => a + b, 0) / vs.length; });
    const ipdArr = Object.entries(ipdAvg).sort((a, b) => b[1] - a[1]).slice(0, 12);
    const clByCompI = {};
    ipdBase.forEach(r => { const o = clByCompI[r.cp] = clByCompI[r.cp] || { Material: 0, Serviço: 0 }; if (r.cl === 'Material') o.Material++; else if (r.cl === 'Serviço') o.Serviço++; });
    const classColorI = cp => { const o = clByCompI[cp]; if (!o || (!o.Material && !o.Serviço)) return C.teal; return o.Material >= o.Serviço ? C.steel : C.blue; };
    mkChart('c_ipdcomp', { type: 'bar', data: { labels: ipdArr.map(x => x[0]), datasets: [{ data: ipdArr.map(x => +x[1].toFixed(2)), backgroundColor: ipdArr.map(x => x[0] === STATE.comp ? C.accent : classColorI(x[0])), borderRadius: 18, barPercentage: 1, categoryPercentage: .85 }] }, options: { legendChips: [['Material', C.steel], ['Serviço', C.blue], ['Selecionado', C.accent]], indexAxis: 'y', maintainAspectRatio: false, layout: { padding: { top: 14 } }, plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => c.parsed.x.toFixed(2) + ' itens/dia' } } }, scales: { x: { ...soG, beginAtZero: true }, y: { ...noG, ticks: { font: { size: 10 } } } } } });

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

    document.getElementById('ins-prod').innerHTML = `<b>Leitura:</b> ${ger ? 'a equipe concluiu em média' : STATE.comp + ' concluiu'} <b>${val.toFixed(2)} ${ger ? 'itens/dia/comprador' : 'itens/dia'}</b> no recorte.${_fb ? ' <b style="color:#8A6D00">⚠ Valor estimado:</b> a coluna <i>Item/dia/comprador</i> está vazia na base para a(s) semana(s) do recorte, então o itens/dia/comprador foi calculado como Item/dia ÷ compradores ativos.' : ''}`;
    SUM.prod = { val, ger, concluidos: base.length, entradas: entG, weeks: cwk.map(wkLabel), weekly: cwk.map(w => cw[w] || 0), entries: cwk.map(w => ew[w] || 0), matLabels: MSc, matQ: msQ, matTot: totMS };
}

function renderAging() {
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

    const MSag = ['Material', 'Serviço'];
    const msAgQ = MSag.map(c => ag.filter(r => r.cl === c).length);
    const msAgAvg = MSag.map(c => { const b = ag.filter(r => r.cl === c); return b.length ? Math.round(b.reduce((a, r) => a + r.age, 0) / b.length) : 0; });

    // RCs em aberto por tipo — Contrato x Spot (informativo, sem meta)
    const avgOf = arr => arr.length ? Math.round(arr.reduce((a, r) => a + r.age, 0) / arr.length) : 0;
    const agCon = ag.filter(r => r.td === 'Contrato');
    const agSpo = ag.filter(r => r.td === 'Spot');

    kpi('kpi-aging', [
        { l: 'RCs em aberto', v: ag.length.toLocaleString('pt-BR'), n: 'no recorte de Período/Tipo' },
        { l: 'RCs em aberto — Contrato', v: agCon.length.toLocaleString('pt-BR'), n: agCon.length ? 'aging médio ' + avgOf(agCon) + 'd' : 'sem RCs Contrato no recorte' },
        { l: 'RCs em aberto — Spot', v: agSpo.length.toLocaleString('pt-BR'), n: agSpo.length ? 'aging médio ' + avgOf(agSpo) + 'd' : 'sem RCs Spot no recorte' },
        { l: 'Aging médio', v: avg + 'd', n: 'RCs em aberto no recorte' },
        { l: 'Aging mediana', v: med + 'd', n: 'RCs em aberto no recorte' },
        { l: 'RCs críticas (>30d)', v: crit.toLocaleString('pt-BR'), n: 'itens parados há mais tempo' }
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

    const critSem = ag.filter(r => sevAg(r)[1] === 'Crítico').length;
    document.getElementById('ins-aging').innerHTML = `<b>Leitura:</b> mediana <b>${med}d</b> vs média <b>${avg}d</b> — a maioria flui, mas <b>${crit} RCs passam de 30 dias</b> e <b>${critSem}</b> estão em criticidade frente ao SLA alvo da própria RC. ${topAvg.length ? `Maior aging médio: <b>${topAvg[0].cp}</b> (${Math.round(topAvg[0].avg)}d). ` : ''}Use o funil e o backlog por mês para priorizar a limpeza da carteira.`;
    SUM.aging = { open: ag.length, openTotal: ALL.filter(r => r.st === 'A').length, avg, crit, faixaLabels: FA.map(x => x[0]), faixaCounts: f, faixaColors: FCOL, matLabels: MSag, matQ: msAgQ, matAvg: msAgAvg };
}

function renderSLA() {
    const base = ALLRC.filter(r => r.st === 'C' && r.dc && r.dc >= DATA_INI && inY(r.dc) && periodHit(r.dc) && compHit(r) && tpHit(r) && (r.ss === 'I' || r.ss === 'F') && !r.srNeg);
    const ins = base.filter(r => r.ss === 'I').length, foraR = base.filter(r => r.ss === 'F'), fora = foraR.length, tot = ins + fora, pct = tot ? ins / tot * 100 : 0;
    const atrasos = foraR.map(r => r.sr - r.sa).filter(d => d > 0);
    const atrMed = atrasos.length ? Math.round(atrasos.reduce((a, b) => a + b, 0) / atrasos.length) : 0;
    kpi('kpi-sla', [
        { l: '% dentro do SLA', v: pct.toFixed(1) + '%', n: 'aderência ao prazo no recorte' },
        { l: 'Base avaliada', v: tot.toLocaleString('pt-BR'), n: 'desde abr/2026' },
        { l: 'Fora do SLA', v: fora.toLocaleString('pt-BR'), n: tot ? (100 - pct).toFixed(1) + '%' : '' },
        { l: 'Atraso médio', v: atrMed + 'd', n: 'além do alvo (Fora)' }
    ]);

    // Evolução do % dentro do SLA (c_slatrend) — visão geral, não muda com Período
    const baseTrend = ALLRC.filter(r => r.st === 'C' && r.dc && r.dc >= DATA_INI && inY(r.dc) && compHit(r) && tpHit(r) && (r.ss === 'I' || r.ss === 'F') && !r.srNeg);
    const bw = {};
    baseTrend.forEach(r => { const w = isoWeek(r.dc); (bw[w] = bw[w] || { i: 0, t: 0 }); bw[w].t++; if (r.ss === 'I') bw[w].i++; });
    const wk = Object.keys(bw).sort();
    mkChart('c_slatrend', { type: 'line', data: { labels: wk.map(w => wkLabel(w)), datasets: [{ label: '% dentro', data: wk.map(w => Math.round(bw[w].i / bw[w].t * 100)), borderColor: C.blue, backgroundColor: 'rgba(14,83,140,.07)', fill: true, tension: .3, borderWidth: 2, pointRadius: 3, pointBackgroundColor: C.blue }] }, options: { maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { ...noG, ticks: { font: { size: 9 } } }, y: { ...soG, min: 0, max: 100, ticks: { callback: v => v + '%' } } } } });

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

    const pior = ca[0], melhor = ca[ca.length - 1], topcause = par[0];
    document.getElementById('ins-sla').innerHTML = tot ? `<b>Leitura:</b> aderência de <b>${pct.toFixed(1)}%</b>, atraso médio de <b>${atrMed} dias</b> quando fura. ${topcause ? `A maior causa de atraso é <b>${topcause[0]}</b> (${Math.round(topcause[1] / tt * 100)}% dos casos). ` : ''}${ca.length > 1 ? `Dispersão: ${melhor[0]} em ${melhor[1].toFixed(0)}% contra ${pior[0]} em ${pior[1].toFixed(0)}%. ` : ''}Use a tabela-farol para agir nas críticas.` : '<b>Sem RCs concluídas no recorte (desde abr/2026).</b>';
    SUM.sla = { pct, tot, fora, atrMed, crit: foraR.filter(r => r.sr - r.sa > 15).length, weeks: wk.map(wkLabel), weekly: wk.map(w => bw[w] ? Math.round(bw[w].i / bw[w].t * 100) : 0), matLabels: MS, matQ: msV, matPct: msP };
}

function renderSaving() {
    const base = ALL.filter(r => r.vp > 0 && r.vn > 0 && r.st !== 'X' && r.st !== 'D' && periodHit(r.dc) && compHit(r) && tpHit(r));
    const tot = base.reduce((a, r) => a + (r.vp - r.vn), 0), prop = base.reduce((a, r) => a + r.vp, 0), taxa = prop ? tot / prop * 100 : 0;
    kpi('kpi-saving', [
        { l: 'Saving total', v: Kf(tot), n: BRL(tot) },
        { l: 'Taxa de economia', v: taxa.toFixed(1) + '%', n: taxa >= 0 ? 'sobre 1ª proposta' : 'prejuízo sobre 1ª proposta' },
        { l: 'Itens com saving', v: base.length.toLocaleString('pt-BR'), n: '1ª prop. e negociado' },
        { l: 'Base negociada', v: Kf(prop), n: BRL(prop) }
    ]);

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

    // Pareto — categorias que geram 80% do saving (c_savpareto), sem linha de meta
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
                { type: 'line', label: '% acumulado', data: cumvS, borderColor: '#003865', borderWidth: 2, pointRadius: 3, pointBackgroundColor: '#003865', order: 1, yAxisID: 'y1', tension: .2 }
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

    const topParS = parS[0];
    document.getElementById('ins-saving').innerHTML = base.length ? `<b>Leitura:</b> economia de <b>${BRL(tot)}</b> (taxa <b>${taxa.toFixed(1)}%</b>) em ${base.length} itens no recorte. ${topParS ? `<b>${n80} de ${parS.length} categorias</b> concentram 80% do saving — a maior é <b>${topParS[0]}</b> (${BRL(topParS[1])}). ` : ''}Use a matriz Saving × Volume para achar categorias de alto gasto e baixo retorno.` : '<b>Sem itens com 1ª proposta e valor negociado no recorte.</b>';
    SUM.saving = { total: tot, taxa, itens: base.length, weeks: wk.map(wkLabel), weekly: wk.map(w => bw[w] || 0) };
}

function overviewRow(t, mod, ind, val) {
    return `<tr class="jump" data-t="${t}"><td>${mod}</td><td>${ind}</td><td class="num">${val}</td></tr>`;
}

function renderOverview() {
    const P = SUM.prod, A = SUM.aging, S = SUM.sla, V = SUM.saving;
    if (!P || !A || !S || !V) return;

    // Mix Contrato × Spot — direto da base principal (classificação própria "tp" de cada item), informativo
    const mixBase = ALLRC.filter(r => r.dl && r.dl >= DATA_INI_AGING && periodHit(r.dl) && compHit(r) && tpHit(r));
    const mixCounts = {};
    mixBase.forEach(r => { mixCounts[r.tp] = (mixCounts[r.tp] || 0) + 1; });
    const mCon = mixCounts['Contrato'] || 0, mSpo = mixCounts['Spot'] || 0, mOut = mixBase.length - mCon - mSpo;
    const K = {
        nCon: mCon, nSpo: mSpo, nOut: mOut, total: mixBase.length,
        pctCon: mixBase.length ? mCon / mixBase.length * 100 : 0,
        pctSpo: mixBase.length ? mSpo / mixBase.length * 100 : 0
    };

    kpi('kpi-overview', [
        { l: 'Entrada de itens', v: P.entradas.toLocaleString('pt-BR'), n: 'itens liberados no recorte' },
        { l: 'Itens em aberto', v: A.openTotal.toLocaleString('pt-BR'), n: 'total bruto · aging médio ' + A.avg + 'd' },
        { l: '% dentro do SLA', v: S.pct.toFixed(1) + '%', n: S.tot ? S.fora + ' de ' + S.tot + ' fora do prazo' : 'sem base avaliada' },
        { l: 'Saving capturado', v: Kf(V.total), n: BRL(V.total) + ' · ' + V.taxa.toFixed(1) + '% de taxa' },
        { l: 'Itens concluídos', v: P.concluidos.toLocaleString('pt-BR'), n: 'no recorte' },
        { l: 'RCs críticas de aging', v: A.crit.toLocaleString('pt-BR'), n: 'ciclo aberto > 30 dias' },
        { l: 'RCs críticas em SLA', v: S.crit.toLocaleString('pt-BR'), n: 'fora do SLA > 15 dias' },
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
    mkChart('c_ov_aging_mat_avg', { type: 'bar', data: { labels: A.matLabels, datasets: [{ data: A.matAvg, backgroundColor: C.blue, borderRadius: 18 }] }, options: { indexAxis: 'y', maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => c.parsed.x + 'd' } } }, scales: { x: { ...soG, beginAtZero: true }, y: noG } } });

    // Tabela — resumo por módulo (sem coluna de meta/status)
    document.querySelector('#t_overview tbody').innerHTML = [
        overviewRow('prod', 'Produtividade', 'Itens/dia' + (P.ger ? '/comprador' : ''), P.val.toFixed(2)),
        overviewRow('aging', 'Aging', 'Aging médio (RCs abertas)', A.avg + 'd'),
        overviewRow('sla', 'SLA', '% dentro do prazo', S.pct.toFixed(1) + '%'),
        overviewRow('saving', 'Saving', 'Economia capturada', Kf(V.total) + ' (' + V.taxa.toFixed(1) + '%)')
    ].join('');

    document.getElementById('ins-overview').innerHTML = `<b>Leitura:</b> produtividade de <b>${P.val.toFixed(2)} itens/dia${P.ger ? '/comprador' : ''}</b>, aging médio de <b>${A.avg} dias</b> (${A.openTotal} itens em aberto no total, ${A.crit} RCs críticas), SLA em <b>${S.pct.toFixed(1)}%</b> e saving de <b>${Kf(V.total)}</b> no recorte. Mix de entrada: <b>${K.pctCon.toFixed(0)}% Contrato</b> e <b>${K.pctSpo.toFixed(0)}% Spot</b>. Abra a aba correspondente para detalhar cada indicador.`;
}
