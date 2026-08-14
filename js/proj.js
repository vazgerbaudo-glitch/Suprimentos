// Projeções — cenários otimista / realista / pessimista para as próximas semanas.
//
// Método (o mesmo para todos os indicadores, para os cenários serem comparáveis entre si):
//   realista   = reta de tendência (regressão linear / OLS) das últimas PROJ_HIST semanas fechadas,
//                MAS só quando a inclinação passa no teste t; se não passa, a série é projetada como
//                patamar plano (média da janela) — ver projScenarios
//   otimista   = realista + 1σ dos resíduos, no sentido "bom" do indicador
//   pessimista = realista − 1σ, no sentido "ruim"
// A banda de ±1σ é presa a UM limite só: o limite de domínio do indicador (SLA nunca passa de 100%,
// contagem nunca fica negativa). O melhor/pior desempenho já observado NÃO trava mais a banda — são
// duas coisas diferentes, fronteira de domínio e incerteza estatística, e misturá-las produzia tanto
// o colapso da banda sobre o realista quanto um degrau quando a tendência cruzava o recorde. `best` e
// `worst` continuam no retorno, como linhas de referência para o leitor.
// A largura da banda cresce com o horizonte (fator de alavancagem do intervalo de predição de OLS):
// prever a 8ª semana é mais incerto que prever a 1ª, e σ constante escondia isso.
//
// Três escolhas que valem registro:
// 1. As séries IGNORAM os filtros de Período e de Status — projeção precisa do histórico inteiro
//    (desde abr/2026; saving desde jan/2026). Tipo de compra e Comprador continuam valendo, porque
//    filtram "de quem é a série", não "que pedaço do tempo".
// 2. A semana corrente fica de fora de tudo: ela está parcial e puxaria a tendência para baixo.
// 3. Backlog não tem tendência própria — é consequência de entrada menos saída, então é projetado
//    por fluxo (ver projBacklog) e não por regressão.

const PROJ_HIST = 12;       // semanas de histórico usadas na regressão
const PROJ_HORIZ = 8;       // semanas projetadas à frente
const PROJ_MIN_PTS = 4;     // abaixo disso não há tendência para estimar
const DU_SEM = 5;           // dias úteis por semana, usado no aging implícito (Little)

// Cores dos cenários. Vermelho fica reservado para criticidade real (farol/meta estourada), então o
// cenário pessimista usa o cinza de apoio — ele é uma hipótese, não um alerta. A linha de estresse de
// demanda e a de aging são diagnósticas, não alertas: ficam no azul-aço e no grafite institucionais.
const PROJ_C = { hist: '#003865', real: '#0E538C', otim: '#1E9F7F', pess: '#7A8C97', meta: '#1E9F7F', dem: '#5A8CAE', aging: '#13303F' };

// t crítico bilateral a 5%, por graus de liberdade (n−2). A janela é de PROJ_HIST semanas, mas semanas
// nulas saem do ajuste, então o df varia de série para série — daí a tabela em vez de uma constante
// única. Acima de 15 o crítico já anda perto de 2, que é a aproximação conservadora aceitável.
const PROJ_TCRIT = { 2: 4.303, 3: 3.182, 4: 2.776, 5: 2.571, 6: 2.447, 7: 2.365, 8: 2.306, 9: 2.262, 10: 2.228, 11: 2.201, 12: 2.179, 13: 2.160, 14: 2.145, 15: 2.131 };
const projTCrit = df => PROJ_TCRIT[df] || (df > 15 ? 2.0 : Infinity);

// ── Eixo de semanas ──────────────────────────────────────────────────────────
// Última semana FECHADA (a corrente está parcial).
const projLastWeek = () => isoWeek(new Date(HOJE.getTime() - 7 * 86400000));

// Eixo contínuo entre duas datas — semanas sem movimento precisam existir como zero: uma semana sem
// conclusão é informação, não ausência de dado.
function weekAxis(ini, fim) {
    const last = isoWeek(fim), out = [];
    const d = new Date(ini.getFullYear(), ini.getMonth(), ini.getDate());
    if (isoWeek(d) > last) return [];
    for (let i = 0; i < 400; i++) {
        const w = isoWeek(d);
        out.push(w);
        if (w >= last) break;
        d.setDate(d.getDate() + 7);
    }
    return out;
}

function weeksAfter(w, n) {
    const out = [], d = isoWeekStart(w);
    for (let k = 1; k <= n; k++) { d.setDate(d.getDate() + 7); out.push(isoWeek(d)); }
    return out;
}

// ── Calendário: dias úteis das semanas FUTURAS ───────────────────────────────
// Para o passado o painel usa DUCAL, que sai da própria base (coluna "Dias Úteis na Semana") e por
// isso já embute emendas e feriados locais da empresa. Para o futuro não há base, e o calendário
// nacional é a melhor informação verificável que existe: uma semana com feriado produz menos, e isso
// é sabido com antecedência. É daqui que vem boa parte da ondulação honesta da projeção — não é
// suposição sobre o desempenho do time, é o número de dias em que o time trabalha.
//
// Só entram os feriados NACIONAIS (Lei 662/49, 6.802/80 e 14.759/23) mais Carnaval e Corpus Christi,
// que não são feriado legal federal mas param o corporativo brasileiro inteiro. Feriado municipal ou
// estadual fica de fora de propósito: erraria para a maior parte da equipe.
function projEaster(y) {
    const a = y % 19, b = Math.floor(y / 100), c = y % 100;
    const d = Math.floor(b / 4), e = b % 4;
    const f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3);
    const h = (19 * a + b - d - g + 15) % 30;
    const i = Math.floor(c / 4), k = c % 4;
    const l = (32 + 2 * e + 2 * i - h - k) % 7;
    const m = Math.floor((a + 11 * h + 22 * l) / 451);
    const mes = Math.floor((h + l - 7 * m + 114) / 31);
    const dia = ((h + l - 7 * m + 114) % 31) + 1;
    return new Date(y, mes - 1, dia);
}

const PROJ_HOL = {};        // cache por ano: { 'M-D': true }
function projHolidays(y) {
    if (PROJ_HOL[y]) return PROJ_HOL[y];
    const set = {};
    const put = d => { set[d.getMonth() + '-' + d.getDate()] = true; };
    const off = n => { const d = projEaster(y); d.setDate(d.getDate() + n); return d; };
    [[0, 1], [3, 21], [4, 1], [8, 7], [9, 12], [10, 2], [10, 15], [10, 20], [11, 25]]
        .forEach(([m, d]) => put(new Date(y, m, d)));
    put(off(-48)); put(off(-47));   // Carnaval (segunda e terça)
    put(off(-2));                   // Sexta-feira Santa
    put(off(60));                   // Corpus Christi
    PROJ_HOL[y] = set;
    return set;
}

// Dias úteis (seg–sex menos feriado nacional) de uma semana ISO.
function projDuWeek(w) {
    const d = isoWeekStart(w);
    let n = 0;
    for (let i = 0; i < 5; i++) {
        const hol = projHolidays(d.getFullYear());
        if (!hol[d.getMonth() + '-' + d.getDate()]) n++;
        d.setDate(d.getDate() + 1);
    }
    return n;
}

// Dias úteis de uma semana do histórico: o real da base quando existe, o do calendário como reserva.
const projDuHist = w => (typeof DUCAL !== 'undefined' && DUCAL[w] > 0) ? DUCAL[w] : projDuWeek(w);

// Última semana ISO que começa dentro do mês — é nela que cai o esforço de fechamento.
function projLastOfMonth(w) {
    const d = isoWeekStart(w), n = new Date(d.getTime());
    n.setDate(n.getDate() + 7);
    return n.getMonth() !== d.getMonth();
}

// ── Aleatório reproduzível ───────────────────────────────────────────────────
// As trajetórias simuladas precisam ser as MESMAS a cada render do mesmo recorte: um gráfico que
// muda de desenho a cada clique de filtro não é leitura, é ruído visual. Daí um gerador com semente
// derivada da própria série, em vez de Math.random.
function projRng(seed) {
    let s = (seed >>> 0) || 1;
    return () => {
        s = (s + 0x6D2B79F5) >>> 0;
        let t = Math.imul(s ^ (s >>> 15), 1 | s);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}
// Normal padrão por Box-Muller.
function projNorm(rng) {
    const u = Math.max(1e-12, rng()), v = rng();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

// ── Motor ────────────────────────────────────────────────────────────────────
// Regressão linear simples sobre pontos {x,y}. Devolve o desvio-padrão dos resíduos (σ), que é a
// largura da banda dos cenários, e o R², usado só para dizer ao leitor o quanto a tendência explica
// a série (R² baixo = série errática, cenários mais para "faixa de possibilidades" que para previsão).
//
// Devolve também o teste da própria inclinação (seB, tB). São perguntas diferentes: R² mede o ajuste
// DENTRO da amostra; tB mede se existe tendência para projetar FORA dela. É a segunda que decide se a
// projeção tem direito de existir — uma série com R² de 24% e t abaixo do crítico está lendo ruído.
// xbar e sxx saem junto porque a banda de predição precisa deles (alavancagem, em projScenarios).
function projOLS(pts) {
    const n = pts.length;
    let sx = 0, sy = 0, sxx = 0, sxy = 0;
    pts.forEach(p => { sx += p.x; sy += p.y; sxx += p.x * p.x; sxy += p.x * p.y; });
    const den = n * sxx - sx * sx;
    const b = den ? (n * sxy - sx * sy) / den : 0;
    const a = (sy - b * sx) / n;
    const my = sy / n;
    let ssRes = 0, ssTot = 0;
    pts.forEach(p => { const e = p.y - (a + b * p.x); ssRes += e * e; ssTot += (p.y - my) * (p.y - my); });
    // n−2 graus de liberdade: com 12 pontos a diferença é pequena, mas evita subestimar σ em séries curtas
    const sigma = n > 2 ? Math.sqrt(ssRes / (n - 2)) : 0;
    const sxxc = sxx - sx * sx / n;                          // Σ(x−x̄)²
    const seB = (sxxc > 0 && n > 2) ? sigma / Math.sqrt(sxxc) : Infinity;
    return {
        a, b, sigma, n, my,
        r2: ssTot ? 1 - ssRes / ssTot : 0,
        xbar: sx / n, sxx: sxxc, seB,
        tB: isFinite(seB) && seB > 0 ? b / seB : 0
    };
}

const projRnd = (v, d) => +(+v).toFixed(d || 0);

// vals: array alinhado ao eixo de semanas (null = semana sem base para o indicador, ex.: nenhuma RC
// avaliável de SLA). opt.better diz qual direção é "boa" — é o que inverte otimista e pessimista.
//
// A projeção não é uma reta. Uma reta pressupõe que a única coisa que acontece no futuro é a
// tendência, e é isso que produz o desenho engessado. Aqui ela é decomposta em quatro pedaços, três
// deles com estrutura REAL e verificável — ondulação inventada seria pior que reta, porque fingiria
// saber quando vêm as altas e baixas:
//
//   1. CALENDÁRIO (opt.du / opt.duFut). Séries de volume são ajustadas por dia útil: a regressão roda
//      sobre a taxa (itens por dia útil) e a projeção multiplica de volta pelos dias úteis REAIS da
//      semana futura. Semana com feriado projeta menos porque tem menos dias, não porque o time piorou.
//   2. FECHAMENTO DE MÊS (opt.weeks / opt.weeksFut). A última semana do mês costuma concentrar
//      esforço. O efeito é medido no histórico, encolhido para o tamanho da amostra e só entra se
//      superar o próprio ruído — com 12 semanas há ~3 fechamentos, então é sinal fraco por construção.
//   3. INÉRCIA (AR(1) nos resíduos). A série tem memória: uma semana acima da tendência tende a ser
//      seguida por outra acima. Sem isso a projeção SALTA do último valor observado direto para a
//      reta, que é a maior causa do aspecto artificial. Com isso ela parte de onde a série está e
//      converge para a tendência — e a banda começa estreita e abre, em vez de já nascer larga.
//   4. RUÍDO. O que sobra, e que só aparece como faixa e como trajetórias simuladas, nunca como
//      previsão de qual semana sobe.
function projScenarios(vals, opt) {
    const o = Object.assign({
        horiz: PROJ_HORIZ, min: 0, max: Infinity, better: 'up', dec: 0,
        du: null, duFut: null, weeks: null, weeksFut: null, paths: 8
    }, opt);
    const off = Math.max(0, vals.length - PROJ_HIST);
    const win = vals.slice(-PROJ_HIST);
    const duW = o.du ? o.du.slice(off) : null;          // dias úteis do histórico, alinhados à janela
    const wkW = o.weeks ? o.weeks.slice(off) : null;    // chaves de semana, alinhadas à janela
    const useDu = !!(duW && o.duFut);                   // só séries de volume normalizam por dia útil
    const du = i => (duW && duW[i] > 0) ? duW[i] : DU_SEM;

    // Espaço de trabalho: taxa por dia útil quando a série é de volume, valor bruto quando é taxa
    // (SLA e atingimento já são percentuais — dividir de novo por dias úteis seria contar duas vezes).
    const pts = [];
    win.forEach((y, i) => { if (y != null && isFinite(y)) pts.push({ x: i, y: useDu ? y / du(i) : y }); });
    if (pts.length < PROJ_MIN_PTS) return { ok: false, n: pts.length };

    const fit = projOLS(pts);
    const ys = pts.map(p => p.y);
    const up = o.better === 'up';
    const s = up ? 1 : -1;                       // sinal da direção "boa" do indicador
    const cl = v => Math.min(Math.max(v, o.min), o.max);   // limite de DOMÍNIO (0..100 etc.), não da banda
    const x0 = win.length - 1;
    const soma = a => a.reduce((x, y) => x + y, 0);
    const media = soma(ys) / ys.length;

    // A inclinação só vira projeção se for distinguível de zero. Quando não é, o honesto é dizer
    // "estável no patamar de X", não extrapolar o ruído das últimas semanas para 8 semanas à frente.
    const tCrit = projTCrit(fit.n - 2);
    const trendOK = isFinite(fit.tB) && Math.abs(fit.tB) >= tCrit;
    const base = xk => trendOK ? (fit.a + fit.b * xk) : media;

    // σ em torno do que de fato é projetado: da reta quando há tendência, da média quando é patamar.
    // Usar sempre o resíduo da reta subestimaria a dispersão do patamar, porque a reta absorve parte
    // da variação que, sem tendência significativa, é justamente incerteza.
    const res0 = pts.map(p => p.y - base(p.x));
    const dfR = Math.max(1, trendOK ? fit.n - 2 : fit.n - 1);
    const sigma0 = Math.sqrt(soma(res0.map(e => e * e)) / dfR);

    // ── Efeito de fechamento de mês ──────────────────────────────────────────
    // Medido como diferença de resíduo médio entre as semanas de fechamento e as demais, encolhido
    // por m/(m+4) e só aceito se passar do erro-padrão da própria diferença. Centrado, para não
    // deslocar o nível médio da projeção.
    let mDelta = 0, mIn = 0, mPct = 0;
    if (wkW) {
        const gi = [], go = [];
        pts.forEach((p, i) => (projLastOfMonth(wkW[p.x]) ? gi : go).push(res0[i]));
        if (gi.length >= 3 && go.length >= 3) {
            const mi = soma(gi) / gi.length, mo = soma(go) / go.length;
            const dRaw = mi - mo;
            const seD = sigma0 * Math.sqrt(1 / gi.length + 1 / go.length);
            if (Math.abs(dRaw) > seD) {
                mDelta = dRaw * (gi.length / (gi.length + 4));
                mIn = gi.length;
                mPct = media ? mDelta / media * 100 : 0;
            }
        }
    }
    const pIn = wkW ? pts.filter(p => projLastOfMonth(wkW[p.x])).length / pts.length : 0;
    const mAdj = w => !mDelta || !w ? 0 : (projLastOfMonth(w) ? mDelta * (1 - pIn) : -mDelta * pIn);

    // ── Inércia (AR(1)) ──────────────────────────────────────────────────────
    // Só com pontos contíguos: com semana nula no meio, "lag 1" nos pontos não é lag 1 no tempo, e o
    // coeficiente mediria outra coisa.
    //
    // Aqui NÃO cabe teste de significância com corte seco. Em 12 semanas o r₁ amostral é enviesado
    // para baixo em ~(1+3ρ)/n, e o limite de Bartlett (2/√12 ≈ 0,58) só deixaria passar inércia
    // altíssima: uma série genuinamente com memória de 0,7 mede ~0,45 e seria rejeitada, e a projeção
    // voltaria a saltar do último ponto para a reta. A pergunta certa também não é "existe memória?",
    // é "qual o melhor palpite de memória para projetar" — então corrige-se o viés e encolhe-se a
    // estimativa por n/(n+6), que é gradual em vez de tudo-ou-nada. A zona morta de 0,10 evita tratar
    // resíduo de arredondamento como inércia.
    const res = res0.map((e, i) => e - mAdj(wkW ? wkW[pts[i].x] : null));
    const contig = pts.every((p, i) => p.x === pts[0].x + i);
    let phi = 0;
    if (contig && res.length >= 6) {
        let num = 0;
        for (let i = 1; i < res.length; i++) num += res[i] * res[i - 1];
        const den = soma(res.map(e => e * e));
        const r1 = den ? num / den : 0;
        const r1c = r1 + (1 + 3 * r1) / res.length;                  // viés de amostra curta
        const cand = r1c * (res.length / (res.length + 6));          // encolhimento
        if (Math.abs(cand) >= .10) phi = Math.max(-0.5, Math.min(0.85, cand));
    }
    const eLast = res[res.length - 1];

    // Uma série com memória "parece" mais calma do que é dentro de uma janela curta: semanas vizinhas
    // se assemelham, então a variância amostral subestima a dispersão do processo. Sem desfazer esse
    // viés a banda nasce estreita justamente nas séries mais inerciais — foi o que o backtest acusou.
    const vBias = Math.min(1, Math.max(.4, 1 - (1 / fit.n) * (1 + phi) / Math.max(.15, 1 - phi)));
    const sigma = sigma0 / Math.sqrt(vBias);

    // ── Projeção ─────────────────────────────────────────────────────────────
    // Variância k passos à frente = inovação acumulada do AR(1) + incerteza dos parâmetros da reta.
    // Com phi = 0 o primeiro termo vira 1 e a fórmula recai exatamente na banda de predição de OLS.
    const duF = k => (o.duFut && o.duFut[k - 1] > 0) ? o.duFut[k - 1] : DU_SEM;
    const wkF = k => o.weeksFut ? o.weeksFut[k - 1] : null;
    const lev = xk => (trendOK && fit.sxx > 0) ? Math.pow(xk - fit.xbar, 2) / fit.sxx : 0;
    const passo = k => {
        const xk = x0 + k, esc = useDu ? duF(k) : 1;
        const taxa = base(xk) + mAdj(wkF(k)) + Math.pow(phi, k) * eLast;
        const vr = (1 - Math.pow(phi, 2 * k)) + 1 / fit.n + lev(xk);
        return { t: taxa * esc, sig: sigma * Math.sqrt(Math.max(vr, 1e-9)) * esc };
    };

    const real = [], otim = [], pess = [], lo = [], hi = [], lo2 = [], hi2 = [];
    for (let k = 1; k <= o.horiz; k++) {
        const { t, sig } = passo(k);
        const c = cl(t);
        real.push(projRnd(c, o.dec));
        otim.push(projRnd(cl(t + s * sig), o.dec));
        pess.push(projRnd(cl(t - s * sig), o.dec));
        lo.push(projRnd(cl(t - sig), o.dec));           // lo/hi são a MESMA banda de otim/pess, só que
        hi.push(projRnd(cl(t + sig), o.dec));           // em ordem de valor — é o que o gráfico precisa
        lo2.push(projRnd(cl(t - 2 * sig), o.dec));
        hi2.push(projRnd(cl(t + 2 * sig), o.dec));
    }

    // ── Trajetórias simuladas ────────────────────────────────────────────────
    // Não são previsões: são exemplos de como uma realização do MESMO modelo se pareceria, com o ruído
    // semanal e a inclinação sorteada dentro do próprio erro-padrão. Servem para o leitor ver que o
    // futuro plausível é acidentado, não liso — a faixa sozinha esconde isso.
    const sigE = sigma * Math.sqrt(Math.max(0, 1 - phi * phi));
    const rng = projRng(Math.round(Math.abs(soma(ys)) * 997 + fit.n * 31 + o.horiz));
    const paths = [];
    for (let p = 0; p < o.paths; p++) {
        const bP = isFinite(fit.seB) ? fit.b + fit.seB * projNorm(rng) : fit.b;
        const linha = [];
        let e = eLast;
        for (let k = 1; k <= o.horiz; k++) {
            const xk = x0 + k, esc = useDu ? duF(k) : 1;
            e = phi * e + sigE * projNorm(rng);
            const nivel = trendOK ? (fit.a + bP * xk) : media;
            linha.push(projRnd(cl((nivel + mAdj(wkF(k)) + e) * esc), o.dec));
        }
        paths.push(linha);
    }

    // Melhor e pior semana já observada, de volta ao espaço de VALOR (referência para o leitor).
    const vals0 = pts.map((p, i) => useDu ? p.y * du(p.x) : p.y);
    const best = up ? Math.max.apply(null, vals0) : Math.min.apply(null, vals0);
    const worst = up ? Math.min.apply(null, vals0) : Math.max.apply(null, vals0);

    return {
        ok: true, n: pts.length, real, otim, pess, lo, hi, lo2, hi2, paths,
        slope: useDu ? fit.b * DU_SEM : fit.b,      // inclinação por semana, na unidade que o leitor lê
        r2: fit.r2, sigma, tB: fit.tB, tCrit, trendOK,
        phi, mDelta, mPct, mIn, duFut: o.duFut, useDu,
        // best/worst são referência para o leitor (melhor e pior semana já observada), não trava da banda
        last: vals0[vals0.length - 1], avg: soma(vals0) / vals0.length, best, worst, better: o.better,
        fim: { real: real[real.length - 1], otim: otim[otim.length - 1], pess: pess[pess.length - 1] },
        acum: { real: projRnd(soma(real), o.dec), otim: projRnd(soma(otim), o.dec), pess: projRnd(soma(pess), o.dec) }
    };
}

// Backtest walk-forward de um passo à frente: reajusta a reta só com o que era conhecido até i−1 e
// confere se a semana i caiu dentro da banda. Para ±1σ a cobertura deveria ficar perto de 0,68 — bem
// abaixo disso significa que a banda continua estreita (sinal típico de autocorrelação semanal), e
// isso vira número no relatório em vez de ressalva no comentário. É o único juiz fora da amostra.
// O backtest precisa julgar o MESMO modelo que a projeção usa, senão mede outra coisa: reproduz o
// teste de tendência (patamar quando não passa) e a inércia AR(1) do passo à frente. O que ele não
// reproduz é calendário e fechamento de mês — esses dependem de qual semana é, e aqui só interessa a
// calibragem da banda. Fica um juiz levemente conservador, o que é o lado seguro de errar.
function projBacktest(vals, opt) {
    const o = Object.assign({ minTrain: PROJ_MIN_PTS }, opt);
    const win = vals.slice(-PROJ_HIST).filter(y => y != null && isFinite(y));
    let dentro = 0, total = 0;
    const erros = [];
    for (let i = o.minTrain; i < win.length; i++) {
        const ys = win.slice(0, i);
        const train = ys.map((y, x) => ({ x, y }));
        const fit = projOLS(train);
        const trendOK = isFinite(fit.tB) && Math.abs(fit.tB) >= projTCrit(fit.n - 2);
        const media = ys.reduce((a, y) => a + y, 0) / ys.length;
        const bs = x => trendOK ? (fit.a + fit.b * x) : media;
        const res = ys.map((y, x) => y - bs(x));
        const sigma0 = Math.sqrt(res.reduce((a, e) => a + e * e, 0) / Math.max(1, trendOK ? fit.n - 2 : fit.n - 1));

        let num = 0;
        for (let j = 1; j < res.length; j++) num += res[j] * res[j - 1];
        const den = res.reduce((a, e) => a + e * e, 0);
        const r1 = den ? num / den : 0;
        const cand = (r1 + (1 + 3 * r1) / res.length) * (res.length / (res.length + 6));
        const phi = Math.abs(cand) >= .10 ? Math.max(-0.5, Math.min(0.85, cand)) : 0;
        const vBias = Math.min(1, Math.max(.4, 1 - (1 / fit.n) * (1 + phi) / Math.max(.15, 1 - phi)));
        const sigma = sigma0 / Math.sqrt(vBias);

        const xk = i;                                        // próxima semana (1 passo à frente)
        const pred = bs(xk) + phi * res[res.length - 1];
        const lev = (trendOK && fit.sxx > 0) ? Math.pow(xk - fit.xbar, 2) / fit.sxx : 0;
        const sig = sigma * Math.sqrt(Math.max((1 - phi * phi) + 1 / fit.n + lev, 1e-9));
        const real = win[i];
        erros.push(real - pred);
        if (real >= pred - sig && real <= pred + sig) dentro++;
        total++;
    }
    return {
        cobertura: total ? dentro / total : null,
        n: total,
        mae: erros.length ? erros.reduce((a, e) => a + Math.abs(e), 0) / erros.length : null
    };
}

// Backlog por fluxo: fila(k) = fila(k−1) + entrada(k) − conclusão(k).
// Nos TRÊS cenários principais a entrada é a realista — demanda da área cliente não é escolha do time
// de compras; o que separa otimista de pessimista é a vazão (conclusões). Isso isola o mérito do time,
// mas deixa um ponto cego: a banda de fila ignora a incerteza de CHEGADA, e numa fila de suprimentos o
// que mais estoura o aging é a demanda surtar, não o time desacelerar. Daí a quarta linha, demStress:
// vazão na tendência com demanda a +1σ (o cenário `entr.pess`, que já era calculado e descartado).
//
// `folga` recupera o que o Math.max(0, …) jogava fora: quanta capacidade sobrou na semana depois de a
// fila zerar. Sem ela, uma fila que zera raspando e uma que zera com folga larga são o mesmo número.
function projBacklog(inicial, entrada, saida) {
    const passo = (vs, ent) => {
        const fila = [], folga = [];
        let b = inicial;
        for (let k = 0; k < vs.length; k++) {
            const raw = b + ent[k] - vs[k];
            b = Math.max(0, raw);
            fila.push(Math.round(b));
            folga.push(raw < 0 ? Math.round(-raw) : 0);
        }
        return { fila, folga };
    };
    const pr = passo(saida.real, entrada.real);
    const po = passo(saida.otim, entrada.real);
    const pp = passo(saida.pess, entrada.real);
    const pd = passo(saida.real, entrada.pess);              // vazão na tendência, demanda +1σ
    return {
        real: pr.fila, otim: po.fila, pess: pp.fila, demStress: pd.fila,
        folga: { real: pr.folga, otim: po.folga, pess: pp.folga }
    };
}

// Aging médio implícito pela Lei de Little: fila ÷ vazão = tempo médio de espera. Em semanas × dias
// úteis vira dias — a mesma régua de dias úteis que a aba Aging usa.
//
// Atenção ao que o zero significa aqui: quando a fila zera, isto vira 0 e lê-se "fila limpa", NÃO
// "espera zero". Por isso o indicador é rotulado como "dias para zerar a fila no ritmo da semana" e o
// relatório não publica o ponto final cru — ver as guardas de zerouNoHoriz/trendFraco em relatorio.js.
function projAging(backlog, saida) {
    const conv = (bs, vs) => bs.map((b, k) => vs[k] > 0 ? projRnd(b / vs[k] * DU_SEM, 1) : null);
    return { real: conv(backlog.real, saida.real), otim: conv(backlog.otim, saida.otim), pess: conv(backlog.pess, saida.pess) };
}

// ── Séries históricas ────────────────────────────────────────────────────────
const projMode = (m, def) => { let b = def, bc = -1; m.forEach((c, v) => { if (c > bc) { bc = c; b = v; } }); return b; };

function projBuild() {
    const fimW = projLastWeek(), fimD = isoWeekStart(fimW);
    const axP = weekAxis(DATA_INI_PROD, fimD);    // produtividade / SLA / fila — desde abr/2026
    const axV = weekAxis(DATA_INI_VOL, fimD);     // saving — desde jan/2026
    if (!axP.length) return null;

    // Universo do fluxo: Canceladas, Devolvidas e itens marcados "Remover de Compras Ágeis" ficam de
    // fora dos DOIS lados (entrada e saída) — senão a fila projetada nunca esvazia.
    const uni = ALL.filter(r => !r.rm && r.st !== 'X' && r.st !== 'D' && compHit(r) && tpHit(r));
    const ger = STATE.comp === 'GERAL';
    const CAP = { 'Material': STATE.metaMat, 'Serviço': STATE.metaServ };
    const cw = {}, ew = {}, aw = {};

    uni.forEach(r => {
        if (r.dl && r.dl >= DATA_INI_PROD && inY(r.dl)) { const w = isoWeek(r.dl); ew[w] = (ew[w] || 0) + 1; }
        if (r.st !== 'C' || !r.dc || r.dc < DATA_INI_PROD || !inY(r.dc)) return;
        const w = isoWeek(r.dc);
        cw[w] = (cw[w] || 0) + 1;
        // Atingimento semanal — mesma conta da aba Prod & Velocidade: capacidade consumida (1/meta da
        // classe, por item) sobre dias úteis × headcount da semana.
        const o = aw[w] = aw[w] || { cap: 0, duM: new Map(), faM: new Map(), bs: new Set() };
        const meta = CAP[r.cl];
        if (meta > 0) o.cap += 1 / meta;
        if (r.du > 0) o.duM.set(r.du, (o.duM.get(r.du) || 0) + 1);
        if (r.fa > 0) o.faM.set(r.fa, (o.faM.get(r.fa) || 0) + 1);
        o.bs.add(r.cp);
    });

    // SLA — mesma base da aba SLA (item de RC concluído, com status dentro/fora e SLA Real válido)
    const sw = {};
    ALL.forEach(r => {
        if (r.st !== 'C' || !r.dc || r.dc < DATA_INI_SLA || !inY(r.dc)) return;
        if (!compHit(r) || !tpHit(r) || !slaHit(r) || r.sr < 0) return;
        if (r.ss !== 'I' && r.ss !== 'F') return;
        const w = isoWeek(r.dc), o = sw[w] = sw[w] || { i: 0, t: 0 };
        o.t++;
        if (r.ss === 'I') o.i++;
    });

    // Saving — 1ª proposta vs. negociado, mesma base da aba Saving
    const vw = {};
    ALL.forEach(r => {
        if (!(r.vp > 0 && r.vn > 0) || r.st === 'X' || r.st === 'D') return;
        if (!r.dc || !inY(r.dc) || !compHit(r) || !tpHit(r)) return;
        const w = isoWeek(r.dc);
        vw[w] = (vw[w] || 0) + (r.vp - r.vn);
    });

    const sConcl = axP.map(w => cw[w] || 0);
    const sEntr = axP.map(w => ew[w] || 0);
    const sSla = axP.map(w => sw[w] ? sw[w].i / sw[w].t * 100 : null);
    const sSav = axV.map(w => vw[w] || 0);
    // Semana sem conclusão é "sem sinal" (null), não "0% de atingimento": SLA e atingimento são as duas
    // taxas da mesma natureza e precisam do mesmo tratamento. Um zero aqui é um ponto finito que entra
    // na regressão como desempenho catastrófico, puxa a inclinação para baixo e infla o σ da banda.
    const sAting = axP.map(w => {
        const o = aw[w];
        if (!o) return null;
        const du = projMode(o.duM, DU_SEM);
        const buyers = ger ? (o.faM.size ? projMode(o.faM, o.bs.size) : (o.bs.size || 1)) : 1;
        const den = du * buyers;
        return den > 0 ? o.cap / den * 100 : null;
    });

    // Calendário: dias úteis reais de cada semana do histórico e de cada semana projetada. É o que
    // permite a projeção cair numa semana de feriado sem inventar nada — ver projDuWeek.
    const futuras = weeksAfter(fimW, PROJ_HORIZ);
    const duP = axP.map(projDuHist), duV = axV.map(projDuHist);
    const duFut = futuras.map(projDuWeek);
    // Volume (itens, dinheiro) escala com dias úteis; taxa (SLA %, atingimento %) não — o atingimento
    // já divide por dias úteis na própria fórmula, então normalizar de novo contaria duas vezes.
    const calP = { du: duP, duFut, weeks: axP, weeksFut: futuras };
    const calV = { du: duV, duFut, weeks: axV, weeksFut: futuras };
    const calTaxa = { weeks: axP, weeksFut: futuras };

    const concl = projScenarios(sConcl, Object.assign({ better: 'up' }, calP));
    // Entrada é a única série em que "menos é melhor" — menos demanda entrando, fila menor. Isso só
    // troca o rótulo dos cenários na tabela: a projeção de fila usa exclusivamente a entrada realista.
    const entr = projScenarios(sEntr, Object.assign({ better: 'down' }, calP));
    const ating = projScenarios(sAting, Object.assign({ better: 'up', dec: 1 }, calTaxa));
    const sla = projScenarios(sSla, Object.assign({ better: 'up', max: 100, dec: 1 }, calTaxa));
    // Saving pode ser negativo (semana que fechou pior que a 1ª proposta), então o piso 0 do default
    // censuraria justamente o risco que o cenário pessimista existe para mostrar.
    const sav = projScenarios(sSav, Object.assign({ better: 'up', dec: 0, min: -Infinity }, calV));

    const filaHoje = uni.filter(r => r.st === 'A' && r.dl).length;
    const back = concl.ok && entr.ok ? projBacklog(filaHoje, entr, concl) : null;
    const aging = back ? projAging(back, concl) : null;

    // Âncora de regime para o aging: a Lei de Little supõe fila em regime quase-estável. Se o implícito
    // diz ~20 dias e a RC mais velha em aberto tem 60, a fila não está em regime e o aging é otimista
    // por construção (itens novos e rápidos diluem a média enquanto os velhos ficam parados). Isto é o
    // selo de "confie / não confie" tirado do dado, não da teoria.
    const oldest = uni.filter(r => r.st === 'A' && r.dl).reduce((m, r) => Math.min(m, +r.dl), Infinity);
    const ageOldestDays = isFinite(oldest) ? Math.round((fimD - oldest) / 864e5) : null;

    // Cobertura fora da amostra de cada série — ver projBacktest.
    const bt = {
        concl: projBacktest(sConcl), entr: projBacktest(sEntr), sla: projBacktest(sSla),
        ating: projBacktest(sAting), sav: projBacktest(sSav)
    };

    return {
        horiz: PROJ_HORIZ, hist: PROJ_HIST, ultima: fimW,
        futuras, duFut, duP,
        axP, axV,
        serie: { concl: sConcl, entr: sEntr, sla: sSla, sav: sSav, ating: sAting },
        concl, entr, ating, sla, sav, back, aging, filaHoje, ageOldestDays, bt,
        // Médias realistas do horizonte — leituras e recomendações comparam vazão contra entrada, e
        // as duas precisam vir da mesma régua (média do período, não o valor da última semana).
        vazaoReal: concl.ok ? concl.acum.real / PROJ_HORIZ : 0,
        entradaReal: entr.ok ? entr.acum.real / PROJ_HORIZ : 0
    };
}

// ── Render da aba ────────────────────────────────────────────────────────────
// Um cenário desenhado como linha: histórico sólido + três tracejados que começam no último ponto
// real (por isso o `emenda`), para o olho ver de onde cada hipótese parte.
function projLine(id, labels, hist, sc, opt) {
    const o = opt || {};
    const nH = hist.length;
    const lastReal = (() => { for (let i = nH - 1; i >= 0; i--) if (hist[i] != null) return hist[i]; return null; })();
    const emenda = vs => hist.map((_, i) => i === nH - 1 ? lastReal : null).concat(vs);
    const ds = (label, vs, color) => ({
        label, data: emenda(vs), borderColor: color, borderDash: [6, 4], borderWidth: 2,
        pointRadius: 0, pointHoverRadius: 5, pointHoverBackgroundColor: color, fill: false, tension: .25, spanGaps: false
    });
    const sets = [{
        label: 'Histórico', data: hist.concat(new Array(sc.real.length).fill(null)),
        borderColor: PROJ_C.hist, backgroundColor: 'rgba(0,56,101,.08)', fill: true, tension: .25,
        borderWidth: 2, pointRadius: 0, pointHoverRadius: 5, pointHoverBackgroundColor: PROJ_C.hist, spanGaps: false
    }];

    // ── Leque de incerteza ───────────────────────────────────────────────────
    // Três camadas, da mais fraca para a mais forte, para o olho ler profundidade em vez de três
    // linhas soltas: faixa ampla (±2σ), faixa dos cenários (±1σ, exatamente os números que as tabelas
    // e o relatório publicam — o gráfico não pode mostrar uma banda e a tabela outra) e a central.
    // As bordas das faixas entram sem rótulo e são filtradas da legenda; `fill: '-1'` pinta até o
    // dataset anterior, por isso cada faixa vai como par piso→teto, nessa ordem.
    const banda = (loVs, hiVs, label, alpha) => {
        sets.push({
            label: '', data: emenda(loVs), borderColor: 'transparent', borderWidth: 0,
            pointRadius: 0, pointHoverRadius: 0, fill: false, tension: .25, spanGaps: false, _hide: true
        });
        sets.push({
            // borderWidth 0 não desenha linha no gráfico, mas a legenda ainda pinta o símbolo com
            // backgroundColor — daí o quadrado na cor da própria faixa, que é o que o leitor procura.
            label, data: emenda(hiVs), borderColor: 'transparent', borderWidth: 0,
            backgroundColor: colA(PROJ_C.real, alpha), fill: '-1', pointStyle: 'rect',
            pointRadius: 0, pointHoverRadius: 0, tension: .25, spanGaps: false, _band: true
        });
    };
    if (sc.lo2 && sc.hi2) banda(sc.lo2, sc.hi2, 'Faixa ampla (±2σ)', .07);
    if (sc.lo && sc.hi) banda(sc.lo, sc.hi, 'Faixa pessimista–otimista (±1σ)', .14);

    // Trajetórias simuladas: exemplos de futuro possível, não previsão de qual semana sobe. Ficam
    // discretas de propósito — precisam sobreviver à exportação em PNG sem competir com a leitura.
    (sc.paths || []).forEach((p, i) => sets.push({
        label: i === 0 ? 'Trajetórias simuladas' : '', data: emenda(p),
        borderColor: colA(PROJ_C.pess, .30), borderWidth: 1, pointRadius: 0, pointHoverRadius: 0,
        fill: false, tension: .3, spanGaps: false, _hide: i > 0, _sim: true
    }));

    sets.push(ds('Otimista', sc.otim, PROJ_C.otim));
    sets.push(ds('Realista', sc.real, PROJ_C.real));
    sets.push(ds('Pessimista', sc.pess, PROJ_C.pess));

    if (o.meta != null) sets.push({
        label: 'Meta ' + (o.metaTxt || o.meta), data: labels.map(() => o.meta),
        borderColor: PROJ_C.meta, borderDash: [3, 3], borderWidth: 1.4, pointRadius: 0, pointHoverRadius: 4, fill: false
    });

    // Linhas extras da faixa projetada (estresse de demanda, aging). Não emendam no último ponto real:
    // ou não têm histórico plotável, ou vivem em outro eixo — emendar misturaria unidades.
    (o.extra || []).forEach(x => sets.push({
        label: x.label, data: hist.map(() => null).concat(x.vs),
        borderColor: x.color, borderDash: x.dash || [2, 3], borderWidth: 1.6,
        pointRadius: 0, pointHoverRadius: 4, pointHoverBackgroundColor: x.color,
        fill: false, tension: .25, spanGaps: false, yAxisID: x.axis || 'y', _fmt: x.fmt
    }));

    const fmt = o.fmt || (v => v.toLocaleString('pt-BR'));
    mkChart(id, {
        type: 'line', plugins: [crosshair],
        data: { labels, datasets: sets },
        options: {
            maintainAspectRatio: false, interaction: { mode: 'index', intersect: false },
            plugins: {
                // As bordas das faixas e as trajetórias 2..n existem só para desenhar; entrariam na
                // legenda como entradas vazias e no tooltip como uma dúzia de linhas ilegíveis.
                legend: {
                    position: 'top',
                    labels: {
                        boxWidth: 12, usePointStyle: true, font: { size: 10 },
                        filter: it => { const d = sets[it.datasetIndex]; return !!it.text && !(d && d._hide); }
                    }
                },
                tooltip: {
                    mode: 'index', intersect: false,
                    filter: c => !c.dataset._sim && !c.dataset._band && !c.dataset._hide,
                    callbacks: { title: c => 'Semana de ' + c[0].label, label: c => c.parsed.y == null ? null : c.dataset.label + ': ' + (c.dataset._fmt || fmt)(c.parsed.y) }
                }
            },
            scales: {
                x: { ...noG, ticks: { maxTicksLimit: 16, font: { size: 8 } } },
                y: { ...soG, beginAtZero: true, max: o.max, ticks: { callback: v => fmt(v) } },
                ...(o.y1 ? { y1: { ...noG, position: 'right', beginAtZero: true, title: { display: true, text: o.y1.title, font: { size: 9 } }, ticks: { font: { size: 9 }, callback: o.y1.fmt } } } : {})
            }
        }
    });
}

function renderProj() {
    const P = projBuild();
    SUM.proj = P;
    const semDados = msg => {
        document.getElementById('kpi-proj').innerHTML = '';
        document.getElementById('t_proj').querySelector('tbody').innerHTML = '';
        document.getElementById('ins-proj').innerHTML = '<b>' + msg + '</b>';
    };
    if (!P || !P.concl.ok) { semDados('Histórico insuficiente para projetar — são necessárias pelo menos ' + PROJ_MIN_PTS + ' semanas fechadas com movimento.'); return; }

    const labels = P.axP.map(wkLabel).concat(P.futuras.map(wkLabel));
    const labelsV = P.axV.map(wkLabel).concat(P.futuras.map(wkLabel));
    const nf = (v, d) => (+v).toLocaleString('pt-BR', { minimumFractionDigits: d || 0, maximumFractionDigits: d || 0 });
    const fimLbl = wkLabelFull(P.futuras[P.futuras.length - 1]);

    // ── KPIs — sempre o cenário realista no número grande, a faixa pessimista–otimista na pílula
    const cards = [];
    if (P.ating.ok) {
        const a = P.ating.fim.real;
        cards.push({ l: 'Atingimento em ' + P.horiz + ' semanas', v: nf(a, 0) + '%', c: a >= 100 ? 'good' : a >= 80 ? 'warn' : 'bad', p: nf(P.ating.fim.pess, 0) + '–' + nf(P.ating.fim.otim, 0) + '%', pc: a >= 100 ? 'p-good' : a >= 80 ? 'p-warn' : 'p-bad' });
    }
    if (P.sla.ok) {
        const s = P.sla.fim.real;
        cards.push({ l: '% SLA em ' + P.horiz + ' semanas', v: nf(s, 1) + '%', c: s >= 90 ? 'good' : s >= 80 ? 'warn' : 'bad', p: nf(P.sla.fim.pess, 1) + '–' + nf(P.sla.fim.otim, 1) + '%', pc: s >= 90 ? 'p-good' : s >= 80 ? 'p-warn' : 'p-bad' });
    }
    if (P.back) {
        const b = P.back.real[P.horiz - 1], d = b - P.filaHoje;
        cards.push({ l: 'Fila em ' + P.horiz + ' semanas', v: nf(b, 0), c: d <= 0 ? 'good' : 'bad', p: (d >= 0 ? '+' : '') + nf(d, 0) + ' vs. hoje', pc: d <= 0 ? 'p-good' : 'p-bad' });
    }
    if (P.sav.ok) {
        cards.push({ l: 'Saving acumulado até ' + fimLbl, v: Kf(P.sav.acum.real), c: 'good', p: Kf(P.sav.acum.pess) + '–' + Kf(P.sav.acum.otim), pc: 'p-good' });
    }
    kpi('kpi-proj', cards);

    // ── Gráficos
    // null (semana sem conclusão) precisa continuar null até o gráfico: virar 0 aqui desenharia um
    // mergulho a zero que não aconteceu — o mesmo erro que a série tinha antes da correção.
    if (P.ating.ok) projLine('c_proj_ating', labels, P.serie.ating.map(v => v == null ? null : projRnd(v, 1)), P.ating, { meta: 100, metaTxt: '100%', fmt: v => nf(v, 0) + '%' });
    projLine('c_proj_concl', labels, P.serie.concl, P.concl, { fmt: v => nf(v, 0) + ' itens' });
    if (P.sla.ok) projLine('c_proj_sla', labels, P.serie.sla.map(v => v == null ? null : projRnd(v, 1)), P.sla, { meta: 90, metaTxt: '90%', max: 100, fmt: v => nf(v, 1) + '%' });
    if (P.back) {
        // A fila só existe como projeção — o histórico dela não é reconstruível item a item na base
        // atual (não há data de saída para Canceladas/Devolvidas), então o gráfico parte de hoje.
        const histFila = P.axP.map((_, i) => i === P.axP.length - 1 ? P.filaHoje : null);
        // O aging implícito vai junto, no eixo da direita: era a única série que o relatório publicava
        // (pelo ponto final) sem nunca desenhar. Uma trajetória que despenca se autodocumenta; um "0,0d"
        // solto no sumário, não.
        const extra = [{ label: 'Demanda +1σ (fila)', vs: P.back.demStress, color: PROJ_C.dem, fmt: v => nf(v, 0) + ' itens' }];
        if (P.aging) extra.push({ label: 'Dias para zerar a fila (implícito)', vs: P.aging.real, color: PROJ_C.aging, dash: [4, 3], axis: 'y1', fmt: v => nf(v, 1) + 'd' });
        projLine('c_proj_back', labels, histFila, P.back, {
            fmt: v => nf(v, 0) + ' itens', extra,
            y1: P.aging ? { title: 'dias úteis para zerar a fila', fmt: v => nf(v, 0) + 'd' } : null
        });
    }
    if (P.sav.ok) projLine('c_proj_sav', labelsV, P.serie.sav.map(v => Math.round(v)), P.sav, { fmt: v => BRL(v) });

    // ── Tabela de cenários
    const linhas = [];
    const row = (ind, un, hoje, sc, dec, fmt) => {
        if (!sc || !sc.ok) return;
        const f = fmt || (v => nf(v, dec || 0) + (un || ''));
        // Inclinação não significativa aparece marcada: é ela que decide se a projeção é reta ou patamar,
        // e um número de tendência sem essa marca convida a ler direção onde só há ruído.
        const tend = (sc.slope >= 0 ? '+' : '') + nf(sc.slope, 2) + (un || '') + '/sem' +
            (sc.trendOK ? '' : ` <span class="muted" title="t=${nf(sc.tB, 2)} contra crítico ${nf(sc.tCrit, 2)} — projetado como patamar">n.s.</span>`);
        linhas.push(`<tr><td>${ind}</td><td class="num">${f(hoje)}</td><td class="num">${f(sc.fim.pess)}</td><td class="num"><b>${f(sc.fim.real)}</b></td><td class="num">${f(sc.fim.otim)}</td><td class="num">${tend}</td><td class="num">${nf(sc.r2 * 100, 0)}%</td></tr>`);
    };
    row('Atingimento da meta', '%', P.ating.ok ? P.ating.last : 0, P.ating, 0);
    row('Itens concluídos por semana', '', P.concl.last, P.concl, 0);
    row('Entradas por semana', '', P.entr.ok ? P.entr.last : 0, P.entr, 0);
    row('% dentro do SLA', '%', P.sla.ok ? P.sla.last : 0, P.sla, 1);
    row('Saving por semana', '', P.sav.ok ? P.sav.last : 0, P.sav, 0, v => BRL(v));
    if (P.back) linhas.push(`<tr><td>Itens em aberto (fila)</td><td class="num">${nf(P.filaHoje, 0)}</td><td class="num">${nf(P.back.pess[P.horiz - 1], 0)}</td><td class="num"><b>${nf(P.back.real[P.horiz - 1], 0)}</b></td><td class="num">${nf(P.back.otim[P.horiz - 1], 0)}</td><td class="num">—</td><td class="num">—</td></tr>`);
    if (P.aging) {
        const a = k => P.aging[k][P.horiz - 1];
        linhas.push(`<tr><td>Dias para zerar a fila no ritmo da semana <span class="muted">(implícito: fila ÷ vazão)</span></td><td class="num">—</td><td class="num">${a('pess') == null ? '—' : nf(a('pess'), 1) + 'd'}</td><td class="num"><b>${a('real') == null ? '—' : nf(a('real'), 1) + 'd'}</b></td><td class="num">${a('otim') == null ? '—' : nf(a('otim'), 1) + 'd'}</td><td class="num">—</td><td class="num">—</td></tr>`);
    }
    if (P.back) linhas.push(`<tr><td>Fila com demanda a +1σ <span class="muted">(estresse de chegada)</span></td><td class="num">${nf(P.filaHoje, 0)}</td><td class="num">—</td><td class="num"><b>${nf(P.back.demStress[P.horiz - 1], 0)}</b></td><td class="num">—</td><td class="num">—</td><td class="num">—</td></tr>`);
    document.getElementById('t_proj').querySelector('tbody').innerHTML = linhas.join('');

    // ── Leitura
    // Sem inclinação significativa a série é lida como estável, e não "em alta/em queda": o texto e a
    // projeção precisam contar a mesma história — se a projeção virou patamar, a leitura também vira.
    const dirTxt = sc => !sc.trendOK || Math.abs(sc.slope) < 1e-6 ? 'estável' : sc.slope > 0 ? 'em alta' : 'em queda';
    const partes = [];
    if (P.ating.ok) {
        const a = P.ating.fim.real;
        partes.push(`o atingimento está <b>${dirTxt(P.ating)}</b> e chega a <b>${nf(a, 0)}%</b> em ${P.horiz} semanas no cenário realista (faixa ${nf(P.ating.fim.pess, 0)}%–${nf(P.ating.fim.otim, 0)}%)${a < 100 ? `, ainda <b>${nf(100 - a, 0)} pontos</b> abaixo da meta` : ', <b>acima da meta</b>'}`);
    }
    if (P.sla.ok) {
        const s = P.sla.fim.real;
        partes.push(`o SLA projetado é <b>${nf(s, 1)}%</b> — ${s >= 90 ? 'dentro da meta de 90%' : P.sla.fim.otim >= 90 ? 'a meta de 90% só é alcançada no cenário otimista' : `<b>nenhum dos três cenários alcança a meta de 90%</b> (teto projetado: ${nf(P.sla.fim.otim, 1)}%)`}`);
    }
    if (P.back) {
        const b = P.back.real[P.horiz - 1], d = b - P.filaHoje;
        partes.push(`a fila sai de <b>${nf(P.filaHoje, 0)}</b> para <b>${nf(b, 0)}</b> itens (${d >= 0 ? '+' : ''}${nf(d, 0)}) porque entram ~<b>${nf(P.entradaReal, 0)}</b> e saem ~<b>${nf(P.vazaoReal, 0)}</b> por semana`);
    }
    if (P.sav.ok) partes.push(`o saving acumulado das ${P.horiz} semanas fica entre <b>${BRL(P.sav.acum.pess)}</b> e <b>${BRL(P.sav.acum.otim)}</b>`);

    // O que faz a projeção ondular precisa estar escrito, senão o leitor atribui a curva a poder de
    // previsão que ela não tem. Cada frase abaixo só aparece quando aquele efeito de fato entrou.
    const curtas = P.futuras.map((w, i) => ({ w, du: P.duFut[i] })).filter(x => x.du < DU_SEM);
    const comInercia = [P.concl, P.entr, P.sla, P.ating, P.sav].filter(s => s.ok && s.phi);
    const comMes = [P.concl, P.entr, P.sav].filter(s => s.ok && s.mDelta);
    const forma = [];
    if (curtas.length) forma.push(`<b>${curtas.length === 1 ? 'uma semana do horizonte tem' : curtas.length + ' semanas do horizonte têm'} feriado</b> (${curtas.map(x => wkLabel(x.w) + ': ' + x.du + 'd').join(', ')}) — a queda da projeção nessas semanas é de calendário, não de desempenho`);
    if (comInercia.length) forma.push(`a projeção parte de onde a série <b>está</b> e converge para a tendência ao longo de ~${nf(1 / Math.max(.15, 1 - Math.abs(comInercia[0].phi)), 0)} semanas (inércia medida no histórico)`);
    if (comMes.length) forma.push(`a semana de <b>fechamento de mês</b> aparece ${comMes[0].mPct >= 0 ? 'acima' : 'abaixo'} das demais em ~${nf(Math.abs(comMes[0].mPct), 0)}%`);

    const r2Baixo = [P.ating, P.sla, P.concl].filter(s => s.ok && s.r2 < .2).length;
    const semTend = [P.ating, P.sla, P.concl, P.entr, P.sav].filter(s => s.ok && !s.trendOK).length;
    // Cobertura observada da banda no backtest de um passo à frente: com ±1σ o esperado é ~68%. Fica
    // no rodapé porque é a única medida de fora da amostra que o painel tem — R² não substitui.
    const cob = ['concl', 'sla', 'ating', 'entr', 'sav'].map(k => P.bt[k]).filter(b => b && b.cobertura != null);
    const cobMed = cob.length ? cob.reduce((a, b) => a + b.cobertura, 0) / cob.length : null;
    document.getElementById('ins-proj').innerHTML = `<b>Leitura:</b> ${partes.join('; ')}. Base: ${P.concl.n} semanas fechadas até ${wkLabelFull(P.ultima)}.` +
        (forma.length ? ` <b>Por que a projeção ondula:</b> ${forma.join('; ')}. O resto da variação semanal não é previsível e por isso aparece só como faixa e como as trajetórias simuladas ao fundo — elas mostram como um futuro plausível se pareceria, não em que semana a alta acontece.` : '') +
        (semTend ? ` <b>Atenção:</b> ${semTend === 1 ? 'uma das séries não tem' : semTend + ' das séries não têm'} inclinação significativa a 5% — para ela${semTend === 1 ? '' : 's'} o cenário realista é o <b>patamar médio</b> das últimas ${P.hist} semanas, não uma reta subindo ou descendo.` : '') +
        (r2Baixo ? ` <b>Atenção:</b> ${r2Baixo === 1 ? 'uma das séries tem' : r2Baixo + ' das séries têm'} R² abaixo de 20% — a tendência explica pouco do que acontece semana a semana, então trate os números como faixa de possibilidades, não como previsão.` : '') +
        (cobMed != null ? ` No backtest de uma semana à frente, a banda cobriu <b>${nf(cobMed * 100, 0)}%</b> dos pontos observados (esperado ~68% para ±1σ${cobMed < .55 ? ' — abaixo disso a banda ainda está estreita' : ''}).` : '');
}
