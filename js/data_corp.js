// Ajuste específico do painel Corporativo — não carregado por Ágeis/Terminais.
// Nesta base, RCs com Status "Cancelada" chegam do SAP com as colunas "RC" e "Item RC"
// preenchidas com o texto do status em vez do número. Sem correção, rollupRC (js/data.js)
// agrupa as ~423 canceladas numa única RC falsa, distorcendo qualquer métrica por RC.
// Reconstrói RC/Item a partir de "Chave (RC+Item)" (RC + Item RC concatenados, últimos
// 2 dígitos = item) — sobrescreve fromCSV só neste escopo, mantendo js/data.js intocado
// para as demais páginas.
(function () {
    const MAP_CORP = Object.assign({}, MAP, { 'chavercitem': 'chv', 'ws': 'ws' });

    fromCSV = function (txt) {
        const g = parseCSV(txt).filter(r => r.length > 1);
        if (!g.length) return [];
        const head = g[0].map(h => MAP_CORP[nrm(h)] || null);
        return g.slice(1).map(r => {
            const o = {};
            head.forEach((f, k) => { if (f) o[f] = r[k]; });
            let st = ST(o.st);
            const rm = ('' + (o.rm || '')).trim().toLowerCase() === 'sim';
            if (rm && st === 'A') st = 'X';
            const sa = parseNum(o.sa), sr = parseNum(o.sr);
            let ss = SS(o.ss);
            let ssDerived = false;
            if (ss === '?') {
                ssDerived = true;
                if (st === 'X') ss = 'X';
                else if (!(sa > 0)) ss = 'S';
                else ss = sr <= sa ? 'I' : 'F';
            }
            const catRaw = (o.cat || '').trim();
            const ci = catRaw.indexOf(' - ');
            const ccd = ci > -1 ? catRaw.slice(0, ci).trim().toUpperCase() : '';
            const catd = ci > -1 ? catRaw.slice(ci + 3).trim() : catRaw;
            let rc = ('' + (o.rc || '')).trim(), it = ('' + (o.it || '')).trim();
            if (!/^\d+$/.test(rc)) {
                const digits = ('' + (o.chv || '')).replace(/\D+/g, '');
                if (digits.length > 2) { rc = digits.slice(0, -2); it = digits.slice(-2); }
            }
            return {
                st: st, ss: ss, sa: sa, sr: sr,
                cp: (o.cp || 'N/D').trim() || 'N/D', pf: (o.pf || '').trim(), et: (o.et || '').trim(),
                dc: parseDate(o.dc), dl: parseDate(o.dl),
                rc: rc, it: it,
                vl: parseNum(o.vl), vp: parseNum(o.vp), vn: parseNum(o.vn),
                ipd: parseNum(o.ipd), ipc: parseNum(o.ipc),
                cat: catd, ccd: ccd, gcs: (o.gcs || '').trim().toUpperCase(), tp: classTipo(o.cen, o.tpc), cen: (o.cen || '').trim(),
                gar: computeGar(o), cl: (o.cl || '').trim(), td: (o.tpc || '').trim(),
                fa: parseNum(o.fa), du: parseNum(o.du), rm: rm,
                ac: (o.ac || '').trim(), di2: parseDate(o.di2), ped: (o.ped || '').trim(),
                dev: parseDate(o.dev), ret: parseDate(o.ret), ssDerived,
                ws: (o.ws || '').trim()
            };
        });
    };

    // bizDaysDiff (js/data.js) anda dia a dia comparando Date.getTime() até bater com o alvo.
    // Nesta base, "Data retorno Supri" às vezes chega ilegível e o parseDate genérico (fallback
    // "new Date(string)") produz datas absurdas (ex.: ano 46195) — um intervalo de dezenas de
    // milhões de dias. Mesmo um for limitado ao nº de dias trava por minutos nesse volume, e o
    // while original (que anda até bater getTime() exato) nem chega a terminar, travando a aba.
    // Como esse valor só serve para descontar dias parados com AT do SLA Real (nunca negativo),
    // qualquer intervalo acima de ~10 anos já é maior que qualquer SLA real — trunca ali.
    const MAX_BIZDAYS_SPAN = 3650;
    bizDaysDiff = function (from, to) {
        if (!from || !to) return null;
        const a = new Date(from.getFullYear(), from.getMonth(), from.getDate());
        const b = new Date(to.getFullYear(), to.getMonth(), to.getDate());
        const dir = b >= a ? 1 : -1;
        const totalDays = Math.min(MAX_BIZDAYS_SPAN, Math.round(Math.abs(b.getTime() - a.getTime()) / 86400000));
        let n = 0;
        const d = new Date(a);
        for (let i = 0; i < totalDays; i++) {
            d.setDate(d.getDate() + dir);
            const dow = d.getDay();
            if (dow !== 0 && dow !== 6) {
                const wIdx = (dow + 6) % 7;
                const du = DUCAL[isoWeek(d)];
                if (wIdx < (du != null ? du : 5)) n += dir;
            }
        }
        return n;
    };

    // Aba Produtividade → "Itens concluídos por semana" (c_psem): o gráfico original (js/render_setor.js,
    // renderProd) só traz Entrada × Concluídos. Aqui, só no Corporativo, entra uma 3ª série com as
    // Devolvidas por semana (contadas por Data Liberação, igual à série Entrada — Devolvida raramente
    // tem Data de Conclusão preenchida na base). Deixa o renderProd original rodar por completo e só
    // adiciona a série ao gráfico já criado, em vez de duplicar a função inteira.
    const _origRenderProd = renderProd;
    renderProd = function () {
        _origRenderProd();
        const chart = CH['c_psem'];
        if (!chart) return;
        const devByWeek = {};
        ALL.filter(r => r.st === 'D' && r.dl && r.dl >= DATA_INI && inY(r.dl) && compHit(r) && tpHit(r) && stHit(r))
            .forEach(r => { const w = isoWeek(r.dl); devByWeek[w] = (devByWeek[w] || 0) + 1; });
        const labelToCount = {};
        Object.keys(devByWeek).forEach(w => { labelToCount[wkLabel(w)] = (labelToCount[wkLabel(w)] || 0) + devByWeek[w]; });
        chart.data.datasets = chart.data.datasets.filter(ds => ds.label !== 'Devolvidas');
        chart.data.datasets.push({ label: 'Devolvidas', data: chart.data.labels.map(l => labelToCount[l] || 0), backgroundColor: C.red, borderRadius: 18 });
        chart.options.plugins.legend = { display: true, position: 'top', labels: { boxWidth: 11, usePointStyle: true, font: { size: 10 } } };
        chart.update();
    };
})();
