// Relatório executivo — retrato do recorte atual + cenários das próximas semanas.
//
// O relatório é montado uma vez como uma lista de blocos (o "doc") e depois renderizado em HTML,
// para a tela e para o PDF exportado.
//
// Fonte dos números: SUM (preenchido pelas abas, portanto já no recorte de Período/Tipo/Comprador) e
// SUM.proj (aba Projeções, que de propósito ignora Período e Status — ver js/proj.js). Compartilhado
// entre os 3 painéis (Ágeis, Rodantes, Terminais); só o Ágeis carrega proj.js, então o
// bloco de Projeções e o mix Contrato × Spot (SUM.contr) degradam para "sem dados" nos demais — ver
// as guardas em `PR &&` e `if (K)` abaixo.

// Nome do painel para o título do relatório e o nome do arquivo — extraído do <title> da página
// ("Painel — X") em vez de fixo, porque este módulo agora roda nos 4 painéis.
function painelLabel() {
    const partes = (document.title || '').split('—');
    return (partes[1] || partes[0] || 'Compras Ágeis').trim();
}

function periodoLabel() {
    if (STATE.modo === 'mes') return 'Mês de ' + mLabel(STATE.mes);
    if (STATE.modo === 'atual') return 'Semana atual (início ' + wkLabelFull(isoWeek(HOJE)) + ')';
    if (STATE.modo === 'semana') return 'Semana de ' + wkLabelFull(STATE.sem);
    return 'Geral (2026)';
}

function tipoLabel() {
    return STATE.tp === 'GERAL' ? 'Geral (todos os tipos)' : STATE.tp === 'CS' ? 'Visão COE' : STATE.tp;
}

function statusLabel() {
    return STATE.st === 'A' ? 'Em Aberto' : STATE.st === 'C' ? 'Concluída' : 'Geral';
}

function leitura(id) {
    const el = document.getElementById(id);
    return el ? el.textContent.replace(/^Leitura:\s*/, '').trim() : '';
}

// ── Formatação ───────────────────────────────────────────────────────────────
const repN = (v, d) => (+v || 0).toLocaleString('pt-BR', { minimumFractionDigits: d || 0, maximumFractionDigits: d || 0 });
const repPP = v => (v >= 0 ? '+' : '') + repN(v, 1) + ' pp';
// **negrito** vira <b> no HTML e continua **negrito** no Markdown
const repB = s => ('' + s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');

// Farol padrão do painel: 'good' na meta, 'warn' na zona de atenção, 'bad' abaixo do mínimo.
const repFarol = (v, metaOk, metaMin) => v >= metaOk ? 'good' : v >= metaMin ? 'warn' : 'bad';
const REP_SEV = { good: 'Na meta', warn: 'Atenção', bad: 'Crítico', '': '—' };

// Horizonte padrão de projeção quando proj.js não está carregado nesta página (só o painel Ágeis
// tem a aba Projeções) — mantém o título da §7 coerente mesmo sem PR.
const REP_HORIZ_FALLBACK = 8;

// ── Fila: uma métrica só, usada no sumário e nas recomendações ───────────────
// O relatório tinha duas leituras da mesma fila convivendo: o sumário publicava o aging implícito da
// ÚLTIMA semana do horizonte (o ponto mais frágil da série — é lá que a fila zera e o número desaba
// para 0,0d) e as recomendações calculavam "em quantas semanas a fila zera" pela taxa média. Podiam
// se contradizer, porque a fila projetada é cumulativa e a taxa média não. Agora é um cálculo só, e é
// o robusto: quantas semanas de ritmo atual separam a fila de hoje do zero.
function repFila(PR) {
    if (!PR || !PR.back || !PR.entr || !PR.entr.ok) return null;
    const gap = PR.vazaoReal - PR.entradaReal;            // itens/semana de vazão líquida
    const semZera = gap > 0 && PR.filaHoje > 0 ? PR.filaHoje / gap : null;
    const iZera = PR.back.real.indexOf(0);                // 1ª semana do horizonte em que a fila zera
    return {
        gap, semZera,
        zerouNoHoriz: iZera >= 0,
        semanaZera: iZera >= 0 ? iZera + 1 : null,
        // Sem tendência significativa em conclusões, tudo que deriva da vazão (fila, aging) é patamar
        // com ruído em volta, não trajetória — e não deve ser publicado como se apontasse para algum lado.
        trendFraco: !!(PR.concl && PR.concl.ok && !PR.concl.trendOK),
        // Arredondar para 0 casas engoliria o caso "zera antes de fechar a semana" e o publicaria como
        // "~0 semanas", que não é frase de relatório.
        semZeraTxt: semZera == null ? null : semZera < 1 ? 'menos de 1 semana' : '~' + repN(semZera, 0) + ' semanas',
        txt: gap > 0
            ? (semZera != null ? `zera em **${semZera < 1 ? 'menos de 1 semana' : '~' + repN(semZera, 0) + ' semanas'}** no ritmo projetado` : 'já vazia')
            : `**em crescimento** (~${repN(Math.abs(gap), 0)} itens/semana acima da vazão)`
    };
}

// Célula de aging implícito com guarda. O zero de um aging calculado por fila÷vazão significa "fila
// limpa", não "espera zero" — publicá-lo cru no sumário faz o número parecer melhor exatamente quando
// é menos confiável. Quando a fila zera dentro do horizonte, ou quando não há tendência para sustentar
// a projeção, a célula diz o que de fato aconteceu em vez de exibir o 0,0d.
function repAgingCell(PR, F, horiz) {
    if (!PR || !PR.aging || !F) return '—';
    if (F.zerouNoHoriz) return 'fila zera ~sem ' + F.semanaZera;
    if (F.trendFraco) return 'tendência fraca';
    const v = PR.aging.real[horiz - 1];
    return v == null ? '—' : repN(v, 1) + 'd';
}

// ── Doc → HTML ───────────────────────────────────────────────────────────────
function repHTML(doc) {
    return doc.map(b => {
        if (b.t === 'head') return `<div class="rep-head"><div class="rep-title">${b.title}</div><div class="rep-sub">${b.sub}</div></div>`;
        if (b.t === 'sec') return `<h4 class="rep-sec"><span class="rep-num">${b.n}</span>${b.title}${b.sub ? `<span class="rep-secsub">${b.sub}</span>` : ''}</h4>`;
        if (b.t === 'p') return `<p class="rep-p">${repB(b.txt)}</p>`;
        if (b.t === 'kpi') return `<div class="rep-kpis">${b.items.map(k => `<div class="rep-kpi ${k.s || ''}"><span class="rep-kl">${k.l}</span><span class="rep-kv">${k.v}</span><span class="rep-ks">${k.sub || ''}</span></div>`).join('')}</div>`;
        if (b.t === 'tab') return `<table class="rep-tab"><thead><tr>${b.head.map((h, i) => `<th${b.align && b.align[i] === 'r' ? ' class="num"' : ''}>${h}</th>`).join('')}</tr></thead><tbody>${b.rows.map(r => `<tr>${r.map((c, i) => `<td${b.align && b.align[i] === 'r' ? ' class="num"' : ''}>${repB(c)}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
        if (b.t === 'list') return `<ul class="rep-list">${b.items.map(i => `<li class="${i.s || ''}"><span class="farol ${i.s || ''}"></span><span>${repB(i.txt)}</span></li>`).join('')}</ul>`;
        if (b.t === 'note') return `<div class="rep-note">${repB(b.txt)}</div>`;
        return '';
    }).join('');
}

// ── Blocos do relatório ──────────────────────────────────────────────────────
// Comparativo individual semana anterior → semana atual. Roda sobre a equipe inteira de propósito
// (ignora o filtro de Comprador): o valor deste bloco é justamente comparar as pessoas entre si.
function repComparativoSemanal() {
    const wCur = isoWeek(HOJE), wPrev = isoWeek(new Date(HOJE.getTime() - 7 * 86400000));
    const by = {};
    ALL.forEach(r => {
        if (r.st !== 'C' || !r.dc || r.dc < DATA_INI_VOL || !tpHit(r)) return;
        const w = isoWeek(r.dc);
        if (w !== wCur && w !== wPrev) return;
        const o = by[r.cp] = by[r.cp] || { p: 0, c: 0 };
        if (w === wPrev) o.p++; else o.c++;
    });
    return {
        wCur, wPrev,
        rows: Object.entries(by).map(([cp, o]) => ({ cp, p: o.p, c: o.c, d: o.c - o.p })).sort((a, b) => (b.p + b.c) - (a.p + a.c))
    };
}

// Riscos: uma regra por linha, com o número que a comprova. Vermelho só quando o indicador está
// realmente estourado — atenção fica em amarelo, conforme a identidade do painel.
function repRiscos(P, A, S, V, K, PR) {
    const R = [];
    const add = (s, txt) => R.push({ s, txt });

    if (P) {
        if (P.ating < 80) add('bad', `Produtividade abaixo do mínimo aceitável: **${repN(P.ating, 0)}%** da meta ponderada (mínimo 80%, meta 100%).`);
        else if (P.ating < 100) add('warn', `Produtividade em atenção: **${repN(P.ating, 0)}%** da meta ponderada — faltam **${repN(100 - P.ating, 0)} pontos** para a meta.`);
    }
    if (S) {
        if (S.pct < 80) add('bad', `Aderência ao SLA crítica: **${repN(S.pct, 1)}%** dentro do prazo (meta 90%), **${repN(S.fora, 0)}** itens fora, atraso médio de **${S.atrMed}d**.`);
        else if (S.pct < 90) add('warn', `Aderência ao SLA abaixo da meta: **${repN(S.pct, 1)}%** (meta 90%) — **${repN(S.fora, 0)}** itens fora do prazo.`);
    }
    if (A) {
        if (A.crit > 0) {
            const share = A.open ? A.crit / A.open * 100 : 0;
            add(share > 10 ? 'bad' : 'warn', `**${repN(A.crit, 0)}** RCs em aberto há mais de 30 dias úteis (${repN(share, 0)}% da fila) — são as que mais pesam no aging médio.`);
        }
        [['Geral', A.gpct, A.avg, A.meta], ['Contrato', A.con.pct, A.con.avg, A.con.meta], ['Spot', A.spo.pct, A.spo.avg, A.spo.meta]].forEach(([nome, pct, avg, meta]) => {
            if (pct > 0) add('bad', `Aging ${nome} acima da própria meta: **${avg}d** contra **≤${meta}d** (${repN(pct, 0)}% acima).`);
        });
    }
    if (V && V.total < 0) add('bad', `Saving negativo no recorte: **${BRL(V.total)}** — o negociado ficou acima da 1ª proposta.`);
    if (K && K.pctSpo > 60) add('warn', `Dependência de Spot: **${repN(K.pctSpo, 0)}%** das RCs entram fora de contrato — cada uma exige cotação do zero.`);

    if (PR && PR.back) {
        const b = PR.back.real[PR.horiz - 1], d = PR.filaHoje ? (b - PR.filaHoje) / PR.filaHoje * 100 : 0;
        if (d > 25) add('bad', `Fila em rota de crescimento: **${repN(PR.filaHoje, 0)} → ${repN(b, 0)}** itens em ${PR.horiz} semanas (+${repN(d, 0)}%) no cenário realista — entra mais do que sai.`);
        else if (d > 10) add('warn', `Fila crescendo no cenário realista: **${repN(PR.filaHoje, 0)} → ${repN(b, 0)}** itens em ${PR.horiz} semanas (+${repN(d, 0)}%).`);
    }
    if (PR && PR.sla.ok && PR.sla.fim.otim < 90) add('bad', `A meta de 90% de SLA não é alcançada **em nenhum dos três cenários** — o teto projetado é ${repN(PR.sla.fim.otim, 1)}%. Sem mudança de processo, a meta não cai por tendência.`);
    if (PR && PR.sav.ok && PR.sav.slope < 0) add('warn', `Saving em tendência de queda: **${BRL(Math.abs(PR.sav.slope))}** a menos por semana na reta das últimas ${PR.hist} semanas.`);

    if (!R.length) add('good', 'Nenhum indicador estourado no recorte — todos dentro das respectivas metas.');
    return R;
}

// Recomendações: cada uma amarrada a um risco e a um número, para ninguém discutir prioridade no
// escuro. Ordem = ordem dos riscos (crítico antes de atenção).
function repRecomendacoes(P, A, S, K, PR, F) {
    const rec = [];
    if (P && P.ating < 100 && PR && PR.concl.ok) {
        // O atingimento é ~proporcional ao volume concluído (mesma capacidade consumida por item da
        // classe), então o esforço extra sai da regra de três sobre a vazão média realista.
        const extra = PR.vazaoReal * (100 / Math.max(P.ating, 1) - 1);
        rec.push(`Fechar o gap de produtividade exige cerca de **+${repN(extra, 0)} itens por semana** sobre a vazão projetada de ${repN(PR.vazaoReal, 0)}/semana. Definir de onde vem: redistribuição de carteira, redução de retrabalho ou headcount.`);
    }
    if (S && S.pct < 90) rec.push(`Atacar o SLA pela causa e não pelo total: os **${repN(S.fora, 0)}** itens fora do prazo têm atraso médio de **${S.atrMed}d** — revisar as etapas que mais consomem prazo antes de renegociar a meta.`);
    if (A && A.crit > 0) rec.push(`Criar força-tarefa para as **${repN(A.crit, 0)} RCs com mais de 30 dias úteis** em aberto: elas sustentam o aging médio e, quando fecharem, entram no SLA como atraso.`);
    // Mesmo `F` do sumário — ver repFila. Se este bloco recalculasse o gap, §1 e §9 voltariam a poder
    // discordar sobre quando a fila zera.
    if (F) {
        if (F.gap <= 0) rec.push(`A fila só para de crescer quando a vazão superar a entrada: no cenário realista entram ~**${repN(PR.entradaReal, 0)}** e saem ~**${repN(PR.vazaoReal, 0)}** itens por semana. São **${repN(Math.abs(F.gap) + 1, 0)} itens/semana** de vazão adicional só para estabilizar.`);
        else rec.push(`No ritmo projetado a fila cai ~**${repN(F.gap, 0)} itens por semana**; zerar o excedente atual levaria **${F.semZeraTxt || 'menos de 1 semana'}** sem nenhuma entrada nova acima do previsto.`);
        if (PR.back && PR.back.demStress[PR.horiz - 1] > PR.back.real[PR.horiz - 1])
            rec.push(`Dimensionar a folga contra a chegada, não só contra a vazão: com a demanda a +1σ a fila termina o horizonte em **${repN(PR.back.demStress[PR.horiz - 1], 0)} itens** em vez de ${repN(PR.back.real[PR.horiz - 1], 0)}. É o cenário que mais estoura prazo e o único que não depende do ritmo do time.`);
    }
    if (K && K.pctSpo > 60) rec.push(`Elevar a contratualização das carteiras de maior volume: cada ponto migrado de Spot para Contrato tira uma cotação completa do fluxo e encurta o SLA na origem.`);
    const semTend = PR ? [PR.ating, PR.sla, PR.concl, PR.entr, PR.sav].filter(s => s && s.ok && !s.trendOK).length : 0;
    if (PR && ([PR.ating, PR.sla, PR.concl].filter(s => s.ok && s.r2 < .2).length || semTend)) rec.push(`Tratar as projeções como faixa, não como número: parte das séries tem R² baixo (variação semanal maior que a tendência)${semTend ? ` e ${semTend === 1 ? 'uma delas não tem' : semTend + ' delas não têm'} inclinação estatisticamente distinguível de zero — para essas, o realista é o patamar médio e cobrar "a curva subindo" é cobrar ruído` : ''}. Revisar os cenários a cada fechamento semanal em vez de fixar a meta no realista.`);
    if (!rec.length) rec.push('Manter o ritmo atual e revisar os cenários no próximo fechamento semanal — nenhum indicador exige ação corretiva no recorte.');
    return rec;
}

function buildRelatorio() {
    const P = SUM.prod, A = SUM.aging, S = SUM.sla, V = SUM.saving, K = SUM.contr, PR = SUM.proj;
    if (!P || !A || !S || !V) return null;
    const doc = [];
    const baseInfo = (document.getElementById('srcdot').title || 'Base não identificada');
    const horiz = PR ? PR.horiz : REP_HORIZ_FALLBACK;
    const F = repFila(PR);                                 // fonte única da leitura de fila (§1, §7 e §9)
    const agingCell = repAgingCell(PR, F, horiz);
    const fimLbl = PR && PR.futuras ? wkLabelFull(PR.futuras[PR.futuras.length - 1]) : '—';

    doc.push({
        t: 'head', title: `Relatório Executivo — Gestão à Vista · ${painelLabel()}`,
        sub: `${periodoLabel()} · Tipo: ${tipoLabel()} · Status: ${statusLabel()} · Comprador: ${STATE.comp === 'GERAL' ? 'Geral' : STATE.comp} · Gerado em ${new Date().toLocaleString('pt-BR')} · ${baseInfo}`
    });

    // ── 1. Sumário executivo
    const fProd = repFarol(P.ating, 100, 80), fSla = repFarol(S.pct, 90, 80);
    doc.push({ t: 'sec', n: 1, title: 'Sumário executivo' });
    doc.push({
        t: 'kpi', items: [
            { l: 'Meta Produtividade', v: repN(P.ating, 0) + '%', sub: 'meta 100% · mínimo 80%', s: fProd },
            { l: '% dentro do SLA', v: repN(S.pct, 1) + '%', sub: 'meta ≥ 90% · ' + repN(S.tot, 0) + ' itens avaliados', s: fSla },
            { l: 'Aging médio — Geral', v: A.avg + 'd', sub: 'meta ≤ ' + A.meta + 'd (dias úteis)', s: A.gpct <= 0 ? 'good' : 'bad' },
            { l: 'RCs críticas (>30d)', v: repN(A.crit, 0), sub: 'de ' + repN(A.open, 0) + ' RCs em aberto', s: A.crit ? 'bad' : 'good' },
            { l: 'Saving capturado', v: BRL(V.total), sub: 'taxa de ' + repN(V.taxa, 1) + '% sobre a 1ª proposta', s: V.total >= 0 ? 'good' : 'bad' },
            { l: 'Mix Contrato × Spot', v: K ? repN(K.pctCon, 0) + '% / ' + repN(K.pctSpo, 0) + '%' : '—', sub: K ? repN(K.total, 0) + ' RCs no recorte' : 'base de carteiras não carregada', s: '' }
        ]
    });

    const linhaSum = (ind, valor, meta, farol, proj) => [ind, valor, meta, REP_SEV[farol], proj];
    const sumRows = [
        linhaSum('Atingimento da meta ponderada', repN(P.ating, 0) + '%', '100%', fProd, PR && PR.ating.ok ? repN(PR.ating.fim.real, 0) + '%' : '—'),
        linhaSum('Itens concluídos por semana', PR && PR.concl.ok ? repN(PR.concl.last, 0) : repN(P.concluidos, 0), '—', '', PR && PR.concl.ok ? repN(PR.concl.fim.real, 0) : '—'),
        linhaSum('% dentro do SLA', repN(S.pct, 1) + '%', '≥ 90%', fSla, PR && PR.sla.ok ? repN(PR.sla.fim.real, 1) + '%' : '—'),
        // O aging medido (idade real dos itens) e o aging implícito (fila ÷ vazão) são tipos diferentes
        // na mesma linha: o primeiro é medição, o segundo é artefato de modelo. Daí a coluna rotulada e
        // a guarda — sem elas um "0,0d" de fila zerada se lê como espera zero, ao lado de um aging real.
        linhaSum('Aging médio — Geral <span class="muted">(medido)</span>', A.avg + 'd', '≤ ' + A.meta + 'd', A.gpct <= 0 ? 'good' : 'bad', agingCell),
        linhaSum('Aging médio — Contrato <span class="muted">(medido)</span>', A.con.avg + 'd', '≤ ' + A.con.meta + 'd', A.con.pct <= 0 ? 'good' : 'bad', '—'),
        linhaSum('Aging médio — Spot <span class="muted">(medido)</span>', A.spo.avg + 'd', '≤ ' + A.spo.meta + 'd', A.spo.pct <= 0 ? 'good' : 'bad', '—'),
        linhaSum('Saving no recorte', BRL(V.total), '—', V.total >= 0 ? 'good' : 'bad', PR && PR.sav.ok ? BRL(PR.sav.acum.real) + ' em ' + horiz + ' sem' : '—')
    ];
    // A leitura de fila que decide ação é esta, não o aging do último ponto: quantas semanas de ritmo
    // atual separam a fila de hoje do zero. Mesmo número da §9, calculado uma vez só.
    if (F) sumRows.push(linhaSum('Fila de itens em aberto (base da projeção)', repN(PR.filaHoje, 0) + ' itens', '—', F.gap > 0 ? 'good' : 'bad', F.txt));
    doc.push({ t: 'tab', head: ['Indicador', 'Valor no recorte', 'Meta', 'Status', 'Projeção realista (' + horiz + ' sem)'], align: ['l', 'r', 'r', 'l', 'r'], rows: sumRows });
    doc.push({ t: 'note', txt: 'As metas de Aging são **distintas por tipo** — Contrato tem ciclo naturalmente mais longo que Spot, e avaliar um pela régua do outro produz conclusão errada. Já o SLA é indicador **único**: Contrato e Spot são medidos juntos contra 90%. Na coluna de projeção, o aging é **implícito** (estimado por fila ÷ vazão), não medido: as duas colunas da mesma linha não são o mesmo tipo de número.' });

    // ── 2. Produtividade
    doc.push({ t: 'sec', n: 2, title: 'Produtividade e velocidade' });
    // Mesma base do KPI da aba Prod & Velocidade (mesmo corte de data e mesmos filtros) — usar um
    // recorte diferente aqui fazia o mix não fechar com o total de concluídos no mesmo parágrafo.
    const baseProd = ALL.filter(r => r.st === 'C' && r.dc && r.dc >= DATA_INI_PROD && periodHit(r.dc) && compHit(r) && tpHit(r) && stHit(r));
    const nMat = baseProd.filter(r => r.cl === 'Material').length, nServ = baseProd.filter(r => r.cl === 'Serviço').length, totMS = nMat + nServ;
    const pMat = totMS ? Math.round(nMat / totMS * 100) : 0;
    const semClasse = baseProd.length - totMS;
    doc.push({
        t: 'p', txt: `A equipe concluiu **${repN(P.concluidos, 0)} itens** no recorte, a um ritmo de **${repN(P.val, 2)} ${P.ger ? 'itens/dia/comprador' : 'itens/dia'}**, o que representa **${repN(P.ating, 0)}%** da meta ponderada` +
            `${P.ating >= 100 ? ' — acima da meta' : P.ating >= 80 ? ' — na zona de atenção' : ' — abaixo do mínimo aceitável de 80%'}. ` +
            `O mix foi de **${repN(nMat, 0)} itens de Material (${pMat}%)** e **${repN(nServ, 0)} de Serviço (${100 - pMat}%)**` +
            `${semClasse > 0 ? `, além de ${repN(semClasse, 0)} sem classificação preenchida` : ''}; como as metas das duas classes são diferentes (${STATE.metaMat} e ${STATE.metaServ} itens/dia/comprador), o atingimento acima já pondera esse mix — comparar as duas classes contra um número único distorce a leitura.`
    });
    if (P.weeks && P.weeks.length) {
        doc.push({ t: 'tab', head: ['Semana', 'Entradas', 'Concluídos', 'Saldo'], align: ['l', 'r', 'r', 'r'], rows: P.weeks.map((w, i) => { const e = (P.entries || [])[i] || 0, c = P.weekly[i] || 0; return [w, repN(e, 0), repN(c, 0), (c - e >= 0 ? '+' : '') + repN(c - e, 0)]; }).slice(-10) });
    }
    const cmp = repComparativoSemanal();
    if (cmp.rows.length) {
        doc.push({ t: 'p', txt: `Comparativo individual — semana de **${wkLabelFull(cmp.wPrev)}** contra a semana corrente (**${wkLabelFull(cmp.wCur)}**, ainda parcial; a queda aparente é esperada em leituras feitas no meio da semana):` });
        doc.push({ t: 'tab', head: ['Comprador', 'Semana anterior', 'Semana atual (parcial)', 'Variação'], align: ['l', 'r', 'r', 'r'], rows: cmp.rows.map(r => [r.cp, repN(r.p, 0), repN(r.c, 0), (r.d >= 0 ? '+' : '') + repN(r.d, 0)]) });
    }
    if (leitura('ins-prod')) doc.push({ t: 'note', txt: leitura('ins-prod') });

    // ── 3. Aging e fila
    doc.push({ t: 'sec', n: 3, title: 'Aging e fila de RCs em aberto' });
    doc.push({
        t: 'p', txt: `São **${repN(A.open, 0)} RCs em aberto** no recorte, com aging médio de **${A.avg} dias úteis** contra a meta de ≤${A.meta}d ` +
            `(${A.gpct <= 0 ? `**${repN(Math.abs(A.gpct), 0)}% abaixo** da meta` : `**${repN(A.gpct, 0)}% acima** da meta`}). ` +
            `Contrato está em **${A.con.avg}d** (meta ≤${A.con.meta}d) e Spot em **${A.spo.avg}d** (meta ≤${A.spo.meta}d). ` +
            `**${repN(A.crit, 0)} RCs** já passaram de 30 dias úteis em aberto.`
    });
    doc.push({ t: 'tab', head: ['Faixa de idade (dias úteis)', 'RCs em aberto', '% da fila'], align: ['l', 'r', 'r'], rows: A.faixaLabels.map((l, i) => { const n = A.faixaCounts[i], tot = A.faixaCounts.reduce((a, b) => a + b, 0); return [l + ' dias', repN(n, 0), tot ? repN(n / tot * 100, 0) + '%' : '—']; }) });
    if (leitura('ins-aging')) doc.push({ t: 'note', txt: leitura('ins-aging') });

    // ── 4. SLA
    doc.push({ t: 'sec', n: 4, title: 'Aderência ao SLA', sub: 'indicador único — Contrato e Spot avaliados em conjunto' });
    doc.push({
        t: 'p', txt: `**${repN(S.pct, 1)}%** dos ${repN(S.tot, 0)} itens avaliados fecharam dentro do prazo, contra a meta de 90% ` +
            `(${S.pct >= 90 ? 'na meta' : `**${repN(90 - S.pct, 1)} pontos** abaixo`}). Ficaram fora **${repN(S.fora, 0)}** itens, com atraso médio de **${S.atrMed} dias** quando o prazo estoura` +
            `${S.crit ? `, dos quais **${repN(S.crit, 0)}** estouraram por mais de 15 dias` : ''}.`
    });
    if (S.weeks && S.weeks.length) doc.push({ t: 'tab', head: ['Semana', '% dentro do SLA', 'vs. meta 90%'], align: ['l', 'r', 'r'], rows: S.weeks.map((w, i) => [w, repN(S.weekly[i], 0) + '%', repPP(S.weekly[i] - 90)]).slice(-10) });
    if (leitura('ins-sla')) doc.push({ t: 'note', txt: leitura('ins-sla') });

    // ── 5. Saving
    doc.push({ t: 'sec', n: 5, title: 'Saving' });
    doc.push({ t: 'p', txt: `O recorte capturou **${BRL(V.total)}** de economia sobre a 1ª proposta, uma taxa de **${repN(V.taxa, 1)}%**, apurada em **${repN(V.itens, 0)} itens** com 1ª proposta e valor negociado preenchidos.` });
    if (leitura('ins-saving')) doc.push({ t: 'note', txt: leitura('ins-saving') });

    // ── 6. Contratualização
    doc.push({ t: 'sec', n: 6, title: 'Contratualização — mix de entrada' });
    if (K) {
        doc.push({ t: 'p', txt: `Das **${repN(K.total, 0)} RCs** que entraram no recorte, **${repN(K.nCon, 0)} (${repN(K.pctCon, 0)}%)** são Contrato e **${repN(K.nSpo, 0)} (${repN(K.pctSpo, 0)}%)** são Spot${K.nOut ? `, além de ${repN(K.nOut, 0)} de outros tipos` : ''}. Quanto maior a fatia Spot, maior o esforço por RC: cada uma exige cotação do zero.` });
        if (K.top && K.top.length) doc.push({ t: 'tab', head: ['Carteira', 'RCs no recorte'], align: ['l', 'r'], rows: K.top.slice(0, 8).map(x => [x.c, repN(x.tot, 0)]) });
    } else {
        doc.push({ t: 'p', txt: 'Base de carteiras (Spend) não carregada — o mix Contrato × Spot não pôde ser apurado neste relatório.' });
    }
    if (leitura('ins-contr')) doc.push({ t: 'note', txt: leitura('ins-contr') });

    // ── 7. Projeções
    doc.push({ t: 'sec', n: 7, title: `Projeções — ${horiz} semanas (até ${fimLbl})`, sub: 'cenários pessimista · realista · otimista' });
    if (!PR || !PR.concl.ok) {
        doc.push({ t: 'p', txt: 'Histórico insuficiente para projetar cenários neste recorte.' });
    } else {
        doc.push({
            t: 'p', txt: `O cenário **realista** é a reta de tendência das últimas ${PR.hist} semanas fechadas — mas só quando a inclinação passa no teste de significância a 5%; quando não passa, a série é projetada como **patamar médio**, porque extrapolar ruído por ${horiz} semanas produz número, não informação. ` +
                `A projeção não é uma reta lisa: ela é corrigida pelos **dias úteis reais de cada semana futura** (semana com feriado produz menos porque tem menos dias, não porque o time piorou), pelo **efeito de fechamento de mês** quando ele supera o próprio ruído no histórico, e pela **inércia da série** — parte de onde o indicador está hoje e converge para a tendência, em vez de saltar direto para a reta. O que sobra é variação não previsível e aparece só como faixa, nunca como previsão de qual semana sobe. ` +
                `**Otimista** e **pessimista** são o realista ±1 desvio-padrão dos resíduos, com a banda **alargando ao longo do horizonte** (prever a ${horiz}ª semana é mais incerto que prever a 1ª). O melhor e o pior desempenho já observados não travam mais a banda: são referência, não limite. ` +
                `A fila não é extrapolada: ela é recalculada semana a semana como fila anterior + entradas − conclusões, sempre com a entrada realista, porque a demanda da área cliente não é escolha do time — e por isso vai junto a linha de **estresse de demanda**, que é a mesma vazão com a chegada a +1σ. ` +
                `Estas séries ignoram os filtros de Período e de Status — projeção exige o histórico inteiro —, mas seguem Tipo de compra e Comprador. A semana corrente fica de fora por estar parcial.`
        });
        const projRows = [];
        // A marca "n.s." é a informação que decide como ler a linha inteira: sem ela, um realista que é
        // patamar médio se lê como reta projetada.
        const pr = (nome, sc, dec, fmt) => { if (sc && sc.ok) { const f = fmt || (v => repN(v, dec || 0)); projRows.push([nome + (sc.trendOK ? '' : ' <span class="muted">(sem tendência — patamar)</span>'), f(sc.last), f(sc.fim.pess), '**' + f(sc.fim.real) + '**', f(sc.fim.otim), repN(sc.r2 * 100, 0) + '%']); } };
        pr('Atingimento da meta (%)', PR.ating, 0);
        pr('Itens concluídos por semana', PR.concl, 0);
        pr('Entradas por semana', PR.entr, 0);
        pr('% dentro do SLA', PR.sla, 1);
        pr('Saving por semana', PR.sav, 0, v => BRL(v));
        if (PR.back) {
            projRows.push(['Itens em aberto (fila)', repN(PR.filaHoje, 0), repN(PR.back.pess[horiz - 1], 0), '**' + repN(PR.back.real[horiz - 1], 0) + '**', repN(PR.back.otim[horiz - 1], 0), '—']);
            projRows.push(['Fila com demanda a +1σ <span class="muted">(estresse de chegada)</span>', repN(PR.filaHoje, 0), '—', '**' + repN(PR.back.demStress[horiz - 1], 0) + '**', '—', '—']);
        }
        // Aqui a banda dos três cenários fica — é a seção em que o leitor já está com olhar analítico —,
        // mas o realista passa pela mesma guarda do sumário, para os dois nunca se contradizerem.
        if (PR.aging) { const a = k => PR.aging[k][horiz - 1]; projRows.push(['Aging médio **implícito** (dias úteis para zerar a fila)', '—', a('pess') == null ? '—' : repN(a('pess'), 1), '**' + agingCell + '**', a('otim') == null ? '—' : repN(a('otim'), 1), '—']); }
        if (PR.sav.ok) projRows.push(['Saving acumulado no horizonte', '—', BRL(PR.sav.acum.pess), '**' + BRL(PR.sav.acum.real) + '**', BRL(PR.sav.acum.otim), '—']);
        doc.push({ t: 'tab', head: ['Indicador', 'Última semana fechada', 'Pessimista', 'Realista', 'Otimista', 'R²'], align: ['l', 'r', 'r', 'r', 'r', 'r'], rows: projRows });

        const bt = PR.bt ? ['concl', 'sla', 'ating', 'entr', 'sav'].map(k => PR.bt[k]).filter(b => b && b.cobertura != null) : [];
        const cobMed = bt.length ? bt.reduce((a, b) => a + b.cobertura, 0) / bt.length : null;
        doc.push({
            t: 'note', txt: `R² é o quanto da variação semanal a tendência explica: **abaixo de 20% a série é errática** e os três números valem como faixa de possibilidades, não como previsão. ` +
                (cobMed != null ? `No backtest de uma semana à frente, a banda cobriu **${repN(cobMed * 100, 0)}%** dos pontos observados — o esperado para ±1σ é ~68%${cobMed < .55 ? ', então a banda ainda subestima a variação semana a semana' : ''}. ` : '') +
                `O aging desta seção é **implícito**: sai de fila ÷ vazão, não da idade medida dos itens (que está na §3). Quando a fila zera dentro do horizonte, o aging vai a zero por "fila limpa", não por "espera zero" — por isso a célula mostra a semana em que a fila zera. ` +
                (PR.ageOldestDays != null && PR.aging && PR.aging.real[0] != null
                    ? `Âncora de regime: a RC em aberto mais antiga tem **${repN(PR.ageOldestDays, 0)} dias corridos**, contra ${repN(PR.aging.real[0], 1)}d de aging implícito na 1ª semana projetada${PR.ageOldestDays > PR.aging.real[0] * 3 ? ' — a diferença indica fila **fora de regime estável**, com itens antigos parados que a média por fluxo dilui; leia o implícito como piso, não como retrato' : ''}. ` : '') +
                `Base: ${PR.concl.n} semanas fechadas até ${wkLabelFull(PR.ultima)}.`
        });
    }

    // ── 8. Riscos
    const riscos = repRiscos(P, A, S, V, K, PR);
    doc.push({ t: 'sec', n: 8, title: 'Riscos priorizados', sub: 'crítico primeiro, cada item com o número que o comprova' });
    doc.push({ t: 'list', items: riscos.slice().sort((a, b) => ({ bad: 0, warn: 1, good: 2 })[a.s] - ({ bad: 0, warn: 1, good: 2 })[b.s]) });

    // ── 9. Recomendações
    doc.push({ t: 'sec', n: 9, title: 'Recomendações' });
    doc.push({ t: 'list', items: repRecomendacoes(P, A, S, K, PR, F).map(txt => ({ s: '', txt })) });

    // ── 10. Qualidade da base
    if (typeof PEND_RULES !== 'undefined' && typeof computePend === 'function') {
        const pend = PEND_RULES.map(r => ({ label: r.label, d: computePend(r) })).filter(x => x.d.total > 0);
        doc.push({ t: 'sec', n: 10, title: 'Qualidade da base', sub: 'toda a base carregada, fora dos filtros do painel' });
        if (!pend.length) doc.push({ t: 'p', txt: 'Nenhuma pendência de preenchimento na base — todos os indicadores acima estão apoiados em campos completos.' });
        else {
            doc.push({ t: 'p', txt: `Existem pendências de preenchimento que afetam a apuração: campos em branco saem da conta dos indicadores em vez de aparecerem como erro, então cada linha abaixo é um pedaço do painel medido sobre menos dados do que parece.` });
            doc.push({ t: 'tab', head: ['Pendência', 'Itens', 'Maior responsável'], align: ['l', 'r', 'l'], rows: pend.map(x => [x.label, repN(x.d.total, 0), x.d.top.length ? `${x.d.top[0].cp} (${repN(x.d.top[0].n, 0)})` : '—']) });
        }
    }

    return doc;
}

// ── Modal ────────────────────────────────────────────────────────────────────
function openRelModal() {
    const doc = buildRelatorio();
    if (!doc) { alert('Os dados ainda estão carregando — tente novamente em instantes.'); return; }
    document.getElementById('rep-body').innerHTML = `<div class="rep-shot" id="rep-shot">${repHTML(doc)}</div>`;
    document.getElementById('rep-ov').classList.add('open');
}

let _jsPDFPromise = null;
function loadJsPDF() {
    if (window.jspdf && window.jspdf.jsPDF) return Promise.resolve();
    if (_jsPDFPromise) return _jsPDFPromise;
    _jsPDFPromise = new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = 'https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js';
        s.onload = resolve;
        s.onerror = reject;
        document.head.appendChild(s);
    });
    return _jsPDFPromise;
}

// Exporta o relatório como PDF: html2canvas tira o retrato da tela (mesma captura da antiga
// exportação em imagem) e o jsPDF fatia esse canvas em páginas A4, porque o relatório é mais
// alto que uma página única — uma imagem só estourava a página e cortava o conteúdo de baixo.
function exportRelPDF() {
    const btn = document.getElementById('rep-export'), target = document.getElementById('rep-shot');
    if (!target || typeof loadHtml2Canvas !== 'function') return;
    const label = btn.textContent;
    btn.textContent = 'Gerando...';
    btn.disabled = true;
    Promise.all([loadHtml2Canvas(), loadJsPDF()])
        .then(() => window.html2canvas(target, { backgroundColor: '#FFFFFF', scale: 2 }))
        .then(canvas => {
            const { jsPDF } = window.jspdf;
            const pdf = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
            const pageW = pdf.internal.pageSize.getWidth(), pageH = pdf.internal.pageSize.getHeight();
            const pageCanvasH = Math.floor(canvas.width * pageH / pageW);
            let renderedH = 0, first = true;
            while (renderedH < canvas.height) {
                const sliceH = Math.min(pageCanvasH, canvas.height - renderedH);
                const pageCanvas = document.createElement('canvas');
                pageCanvas.width = canvas.width;
                pageCanvas.height = sliceH;
                pageCanvas.getContext('2d').drawImage(canvas, 0, renderedH, canvas.width, sliceH, 0, 0, canvas.width, sliceH);
                if (!first) pdf.addPage();
                pdf.addImage(pageCanvas.toDataURL('image/png'), 'PNG', 0, 0, pageW, sliceH * pageW / canvas.width);
                renderedH += sliceH;
                first = false;
            }
            const d = new Date();
            const stamp = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
            const ACC = { 'á': 'a', 'à': 'a', 'ã': 'a', 'â': 'a', 'é': 'e', 'ê': 'e', 'í': 'i', 'ó': 'o', 'õ': 'o', 'ô': 'o', 'ú': 'u', 'ü': 'u', 'ç': 'c' };
            const slug = painelLabel().toLowerCase().split('').map(c => ACC[c] || c).join('').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
            pdf.save(`relatorio-${slug}-${stamp}.pdf`);
        })
        .catch(() => alert('Não foi possível gerar o PDF. Tente novamente.'))
        .finally(() => { btn.textContent = label; btn.disabled = false; });
}

(function () {
    const ov = document.createElement('div');
    ov.className = 'modal-ov';
    ov.id = 'rep-ov';
    ov.innerHTML = `<div class="modal wide">
    <h3>Relatório executivo</h3>
    <div class="ph">Retrato do recorte atual (filtros de Período, Tipo, Status e Comprador) com leituras de todas as abas, cenários das próximas semanas e riscos priorizados. A seção de projeções usa o histórico completo, independente do filtro de Período.</div>
    <div id="rep-body" style="overflow-y:auto;flex:1;margin:10px 0"></div>
    <div class="modal-actions"><button class="btn" id="rep-export">Baixar PDF</button><button class="btn ghost" id="rep-close">Fechar</button></div>
 </div>`;
    document.body.appendChild(ov);
    document.getElementById('rep-export').onclick = exportRelPDF;
    document.getElementById('rep-close').onclick = () => ov.classList.remove('open');
    ov.addEventListener('click', e => { if (e.target === ov) ov.classList.remove('open'); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape') ov.classList.remove('open'); });
    const btn = document.getElementById('btn_rel');
    if (btn) btn.onclick = openRelModal;
})();
