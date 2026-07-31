const BRL = n => 'R$ ' + Math.round(n).toLocaleString('pt-BR');

const Kf = n => {
    n = Math.round(n);
    return Math.abs(n) >= 1e6 ? (n / 1e6).toFixed(1).replace('.', ',') + 'M'
        : Math.abs(n) >= 1e3 ? (n / 1e3).toFixed(0) + 'k'
        : n;
};

function parseDate(s) {
    if (!s) return null;
    if (s instanceof Date) return s;
    s = ('' + s).trim();
    if (!s) return null;
    let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) return new Date(+m[1], +m[2] - 1, +m[3]);
    m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
    if (m) {
        let y = +m[3];
        if (y < 100) y += 2000;
        return new Date(y, +m[2] - 1, +m[1]);
    }
    const d = new Date(s);
    return isNaN(d) ? null : d;
}

function parseNum(v) {
    if (typeof v === 'number') return v;
    if (v == null || v === '') return 0;
    let s = ('' + v).trim().replace(/[R$\s]/g, '');
    if (s.indexOf(',') > -1 && s.indexOf('.') > -1) s = s.replace(/\./g, '').replace(',', '.');
    else if (s.indexOf(',') > -1) s = s.replace(',', '.');
    const n = parseFloat(s);
    return isNaN(n) ? 0 : n;
}

// Remove zeros à esquerda de um RC para casar chaves entre bases com preenchimento diferente
// (ex.: Spend "00012345" × Gestão à Vista "12345") — nunca zera a string inteira ("000" -> "0").
function stripLeadZeros(v) {
    return ('' + (v || '')).trim().replace(/^0+(?=\d)/, '');
}

// RC como texto: mantém só dígitos (nunca converte para número) e remove zeros à esquerda —
// usado para casar Spend[Requisição de compra] × Gestão à Vista[RC] na aba Contratualização.
function normRC(v) {
    const digits = ('' + (v == null ? '' : v)).replace(/\D+/g, '');
    return digits.replace(/^0+(?=\d)/, '');
}

// Pedido como texto: remove espaços/tabs/quebras de linha, caracteres invisíveis (zero-width,
// NBSP) e um eventual sufixo ".0" (artefato de Excel/float) — usado para casar Spend[Pedido] ×
// Gestão à Vista[Contrato SAP/ Pedido] na aba Contratualização.
function normPed(v) {
    const s = '' + (v == null ? '' : v);
    let out = '';
    for (let i = 0; i < s.length; i++) {
        const c = s.charCodeAt(i);
        if (c === 32 || c === 9 || c === 10 || c === 13 || c === 160 || (c >= 8203 && c <= 8207) || c === 65279) continue;
        out += s[i];
    }
    if (out.slice(-2) === '.0') out = out.slice(0, -2);
    return out;
}

// "Contrato SAP/ Pedido" da Gestão à Vista pode trazer vários números de pedido separados por
// barra, vírgula, ponto e vírgula ou quebra de linha — cada um é indexado separadamente.
function splitPedidos(v) {
    return ('' + (v == null ? '' : v)).split(/[\/,;\n]+/).map(normPed).filter(Boolean);
}

const ST = v => ({
    'C': 'C', 'X': 'X', 'A': 'A', 'D': 'D',
    'Concluída': 'C', 'Cancelada': 'X', 'Em Aberto': 'A', 'Devolvida': 'D'
}[('' + v).trim()] || '?');

const SS = v => ({
    'I': 'I', 'F': 'F', 'X': 'X', 'S': 'S',
    'Dentro do SLA Alvo': 'I', 'Fora do SLA Alvo': 'F', 'Cancelada': 'X', 'Sem SLA Alvo': 'S'
}[('' + v).trim()] || '?');

function classTipo(cen, tp) {
    const s = cen || '';
    if (s.indexOf('Contrato') > -1) return 'Contrato';
    if (s.indexOf('Spot') > -1 || s.indexOf('Minuta') > -1) return 'Spot';
    const t = tp || '';
    if (t === 'Contrato') return 'Contrato';
    if (['Spot', 'Urgente', 'Determinada', 'Exclusiva', 'MRP', 'Regularização', 'Cotação', 'Delegada', 'Programada'].indexOf(t) > -1) return 'Spot';
    return 'Outros';
}

function detectDelim(txt) {
    const l = (txt.split(/\r?\n/)[0] || '');
    const cnt = {
        ',': (l.match(/,/g) || []).length,
        ';': (l.match(/;/g) || []).length,
        '\t': (l.match(/\t/g) || []).length
    };
    return Object.keys(cnt).sort((a, b) => cnt[b] - cnt[a])[0];
}

function parseCSV(txt) {
    if (txt.charCodeAt(0) === 0xFEFF) txt = txt.slice(1);
    const D = detectDelim(txt);
    const rows = [];
    let i = 0, f = '', row = [], q = false;
    while (i < txt.length) {
        const c = txt[i];
        if (q) {
            if (c == '"') {
                if (txt[i + 1] == '"') { f += '"'; i++; }
                else q = false;
            } else f += c;
        } else {
            if (c == '"') q = true;
            else if (c === D) { row.push(f); f = ''; }
            else if (c == '\n') { row.push(f); rows.push(row); row = []; f = ''; }
            else if (c != '\r') f += c;
        }
        i++;
    }
    if (f.length || row.length) { row.push(f); rows.push(row); }
    return rows;
}

const nrm = s => ('' + s).toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '');

const MAP = {
    'statusrc': 'st', 'slastatus': 'ss', 'slaalvo': 'sa', 'slareal': 'sr',
    'compradorresponsavelreal': 'cp', 'pontofocal': 'pf', 'etapaatual': 'et',
    'datadeconclusaodarc': 'dc', 'dataliberacao': 'dl', 'rc': 'rc', 'itemrc': 'it',
    'valor': 'vl', 'valor1aproposta': 'vp', 'valornegociado': 'vn',
    'itemdia': 'ipd', 'itemdiacomprador': 'ipc', 'carteiracategoria': 'cat',
    'grupocompradorsistema': 'gcs', 'grupodecompradorsistema': 'gcs',
    'cenariosla': 'cen', 'tipo': 'tpc', 'classificacao': 'cl',
    'numerodefuncionariosativos': 'fa', 'diasuteisnasemana': 'du',
    'diasem02': 'd2', 'diasem03': 'd3', 'diasem04': 'd4', 'diasem05': 'd5',
    'diasem06': 'd6', 'diasem07': 'd7', 'diasem08': 'd8', 'diasem09': 'd9',
    'diasem10': 'd10', 'diasem11': 'd11', 'removerdecomprasageis': 'rm',
    'areacliente': 'ac', 'datainicio2analisedeescopo': 'di2',
    'contratosappedido': 'ped'
};

function computeGar(o) {
    const ds = [o.d2, o.d3, o.d4, o.d5, o.d6, o.d7, o.d8, o.d9, o.d10, o.d11].map(parseNum);
    let best = -1, bi = -1;
    ds.forEach((v, k) => {
        if (v > 0 && v <= 400 && v > best) { best = v; bi = k; }
    });
    return bi >= 0 ? GN[bi] : '';
}

function fromEmbedded() {
    const ci = {};
    EMB.cols.forEach((c, k) => ci[c] = k);
    return EMB.rows.map(r => {
        const g = c => r[ci[c]];
        return {
            st: g('st'), ss: g('ss'), sa: +g('sa') || 0, sr: +g('sr') || 0,
            cp: g('cp') || 'N/D', pf: g('pf') || '', et: g('et') || '',
            dc: parseDate(g('dc')), dl: parseDate(g('dl')),
            rc: g('rc'), it: g('it'),
            vl: +g('vl') || 0, vp: +g('vp') || 0, vn: +g('vn') || 0,
            ipd: +g('ipd') || 0, ipc: +g('ipc') || 0,
            cat: g('cat') || '', ccd: g('ccd') || '', gcs: ('' + (g('gcs') || '')).trim().toUpperCase(), tp: g('tp') || 'Outros', cen: g('cen') || '',
            gar: g('gar') || '', cl: g('cl') || '', td: g('td') || '',
            fa: +g('fa') || 0, du: +g('du') || 0,
            ac: g('ac') || '', di2: parseDate(g('di2')), rm: false, ped: g('ped') || ''
        };
    });
}

function fromCSV(txt) {
    const g = parseCSV(txt).filter(r => r.length > 1);
    if (!g.length) return [];
    const head = g[0].map(h => MAP[nrm(h)] || null);
    return g.slice(1).map(r => {
        const o = {};
        head.forEach((f, k) => { if (f) o[f] = r[k]; });
        let st = ST(o.st);
        const rm = ('' + (o.rm || '')).trim().toLowerCase() === 'sim';
        if (rm && st === 'A') st = 'X';
        const sa = parseNum(o.sa), sr = parseNum(o.sr);
        let ss = SS(o.ss);
        // Base "Gestão à Vista" (Terminais) não traz coluna de Status SLA — deriva de SLA Alvo × SLA Real
        // (SLA Alvo chega como "#N/D"/"Não se aplica" nesses casos, e parseNum já normaliza para 0)
        if (ss === '?') {
            if (st === 'X') ss = 'X';
            else if (!(sa > 0)) ss = 'S';
            else ss = sr <= sa ? 'I' : 'F';
        }
        const catRaw = (o.cat || '').trim();
        const ci = catRaw.indexOf(' - ');
        const ccd = ci > -1 ? catRaw.slice(0, ci).trim().toUpperCase() : '';
        const catd = ci > -1 ? catRaw.slice(ci + 3).trim() : catRaw;
        return {
            st: st, ss: ss, sa: sa, sr: sr,
            cp: (o.cp || 'N/D').trim() || 'N/D', pf: (o.pf || '').trim(), et: (o.et || '').trim(),
            dc: parseDate(o.dc), dl: parseDate(o.dl),
            rc: o.rc, it: o.it,
            vl: parseNum(o.vl), vp: parseNum(o.vp), vn: parseNum(o.vn),
            ipd: parseNum(o.ipd), ipc: parseNum(o.ipc),
            cat: catd, ccd: ccd, gcs: (o.gcs || '').trim().toUpperCase(), tp: classTipo(o.cen, o.tpc), cen: (o.cen || '').trim(),
            gar: computeGar(o), cl: (o.cl || '').trim(), td: (o.tpc || '').trim(),
            fa: parseNum(o.fa), du: parseNum(o.du), rm: rm,
            ac: (o.ac || '').trim(), di2: parseDate(o.di2), ped: (o.ped || '').trim()
        };
    });
}

// ===== Base de Carteiras / Spend (CSV auxiliar) — fonte principal da aba Contratualização =====
// Uma linha por linha do Spend. O campo "Item" aqui é o ITEM DO PEDIDO — nunca o "Item RC" da
// Gestão à Vista; por isso a aba nunca casa as duas bases por RC+Item, só por Pedido ou por RC
// (ver normPed/normRC/splitPedidos e a resolução em renderContr, js/render.js).
const MAP_CART = {
    'requisicaodecompra': 'rc', 'rc': 'rc',
    'item': 'it',
    'pedido': 'pedido',
    'car': 'car',
    'carteiranome': 'nome',
    'materialxservico': 'ms', 'materialservico': 'ms',
    'contratoxspot': 'td',
    'dtpedido': 'dt', 'statusdeliberacao': 'status',
    'gerenciafinal': 'gerFinal'
};
const GERENCIA_ALVO = 'comprasageis';

// Retorna a lista de linhas do Spend (uma por linha do arquivo, sem deduplicar), só as de
// Gerência Final = "Compras Ágeis". Preserva todas as linhas — nenhum valor é somado ou
// descartado aqui; o rollup por RC acontece depois, em renderContr.
function fromCarteirasCSV(txt) {
    const g = parseCSV(txt).filter(r => r.length > 1);
    if (!g.length) return [];
    const head = g[0].map(h => MAP_CART[nrm(h)] || null);
    const hasGerCol = head.indexOf('gerFinal') > -1;
    const rows = [];
    g.slice(1).forEach(r => {
        const o = {};
        head.forEach((f, k) => { if (f) o[f] = r[k]; });
        if (hasGerCol && nrm(o.gerFinal) !== GERENCIA_ALVO) return;
        const rc = ('' + (o.rc || '')).trim();
        if (!rc) return;
        const it = ('' + (o.it || '')).trim();
        const car = ('' + (o.car || '')).trim().toUpperCase();
        const nome = ('' + (o.nome || '')).trim();
        const pedido = ('' + (o.pedido || '')).trim();
        const msRaw = ('' + (o.ms || '')).trim().toLowerCase();
        const ms = msRaw.indexOf('mat') > -1 ? 'Material' : msRaw.indexOf('serv') > -1 ? 'Serviço' : '';
        const tdRaw = ('' + (o.td || '')).trim(), tdLow = tdRaw.toLowerCase();
        const td = tdLow === 'contrato' ? 'Contrato' : tdLow === 'spot' ? 'Spot' : (tdRaw || 'N/D');
        rows.push({
            rc, rcNorm: normRC(rc), it, car, nome, pedido, pedidoNorm: normPed(pedido),
            ms, td, tdRaw, dt: parseDate(o.dt), status: ('' + (o.status || '')).trim()
        });
    });
    return rows;
}

// Calendário de dias úteis por semana ISO, a partir da coluna "Dias Úteis na Semana" (du) da
// própria base — evita depender de uma lista de feriados mantida à parte. Cada semana usa o
// valor de du mais comum entre os itens concluídos (dc) nela; sem dado próprio, cai no padrão de 5.
function buildDuCalendar(all) {
    const m = {};
    all.forEach(r => {
        if (!(r.du > 0)) return;
        const d = r.dc || r.dl;
        if (!d) return;
        const w = isoWeek(d);
        (m[w] = m[w] || new Map()).set(r.du, (m[w].get(r.du) || 0) + 1);
    });
    const out = {};
    Object.keys(m).forEach(w => {
        let best = 5, bc = -1;
        m[w].forEach((c, v) => { if (c > bc) { bc = c; best = v; } });
        out[w] = best;
    });
    return out;
}
// Aging/ciclo em dias úteis entre duas datas, respeitando o nº de dias úteis de cada semana
// (DUCAL, calculado em render()). Numa semana com du < 5, assume que o(s) dia(s) fora do
// expediente caem no fim da semana (aproximação: a base diz quantos dias úteis a semana teve,
// não qual dia específico foi feriado).
function bizDaysDiff(from, to) {
    if (!from || !to) return null;
    const a = new Date(from.getFullYear(), from.getMonth(), from.getDate());
    const b = new Date(to.getFullYear(), to.getMonth(), to.getDate());
    const dir = b >= a ? 1 : -1;
    let n = 0;
    const d = new Date(a);
    while (d.getTime() !== b.getTime()) {
        d.setDate(d.getDate() + dir);
        const dow = d.getDay();
        if (dow !== 0 && dow !== 6) {
            const wIdx = (dow + 6) % 7;
            const du = DUCAL[isoWeek(d)];
            if (wIdx < (du != null ? du : 5)) n += dir;
        }
    }
    return n;
}
function isoWeek(d) {
    const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    const dn = (t.getUTCDay() + 6) % 7;
    t.setUTCDate(t.getUTCDate() - dn + 3);
    const f = new Date(Date.UTC(t.getUTCFullYear(), 0, 4));
    const w = 1 + Math.round(((t - f) / 86400000 - 3 + ((f.getUTCDay() + 6) % 7)) / 7);
    return t.getUTCFullYear() + '-S' + String(w).padStart(2, '0');
}

function isoWeekStart(s) {
    const p = s.split('-S');
    const yr = +p[0], wk = +p[1];
    const j = new Date(yr, 0, 4);
    const dow = (j.getDay() + 6) % 7;
    const m = new Date(yr, 0, 4 - dow);
    m.setDate(m.getDate() + (wk - 1) * 7);
    return m;
}

function wkLabel(s) {
    const d = isoWeekStart(s);
    return String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0');
}

function wkLabelFull(s) {
    const d = isoWeekStart(s);
    return wkLabel(s) + '/' + d.getFullYear();
}

const ymKey = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');

const MES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const mLabel = k => {
    const [y, m] = k.split('-');
    return MES[+m - 1] + '/' + y.slice(2);
};

function mode(a) {
    const m = {};
    let b = null, bc = -1;
    a.forEach(v => {
        if (v == null || v === '') return;
        m[v] = (m[v] || 0) + 1;
        if (m[v] > bc) { bc = m[v]; b = v; }
    });
    return b;
}

function rollupRC(rows) {
    const g = {};
    rows.forEach(r => {
        if (r.rc == null || r.rc === '') return;
        (g[r.rc] = g[r.rc] || []).push(r);
    });
    return Object.keys(g).map(rc => {
        const its = g[rc];
        let dc = null;
        its.forEach(x => { if (x.st === 'C' && x.dc && (!dc || x.dc > dc)) dc = x.dc; });
        const dl = (its.find(x => x.dl) || {}).dl || null;
        const anyOpen = its.some(x => x.st === 'A');
        const st = anyOpen ? 'A' : (its.some(x => x.st === 'C') ? 'C' : (its.some(x => x.st === 'D') ? 'D' : 'X'));
        const anyF = its.some(x => x.ss === 'F'), anyI = its.some(x => x.ss === 'I');
        const ss = anyF ? 'F' : (anyI ? 'I' : its[0].ss);
        const openIt = its.filter(x => x.st === 'A');
        const srNeg = its.some(x => x.st === 'C' && x.sr < 0);
        return {
            rc, it: its.length, dl, dc, st, ss, srNeg,
            sa: Math.max(0, ...its.map(x => x.sa || 0)),
            sr: Math.max(0, ...its.map(x => x.sr || 0)),
            cp: mode(its.map(x => x.cp)) || 'N/D',
            pf: mode(its.map(x => x.pf)) || '',
            et: ((openIt[0] || its[0]).et) || '',
            tp: mode(its.map(x => x.tp)) || 'Outros',
            cen: mode(its.map(x => x.cen)) || '',
            cl: mode(its.map(x => x.cl)) || '',
            td: mode(its.map(x => x.td)) || '',
            cat: mode(its.map(x => x.cat)) || '',
            ccd: mode(its.map(x => x.ccd)) || '',
            gar: mode(its.filter(x => x.gar).map(x => x.gar)) || '',
            vl: its.reduce((a, x) => a + (x.vl || 0), 0),
            vp: its.reduce((a, x) => a + (x.vp || 0), 0),
            vn: its.reduce((a, x) => a + (x.vn || 0), 0)
        };
    });
}

const inY = d => d && d.getFullYear() === 2026;

function periodHit(d) {
    if (!d || !inY(d)) return false;
    if (STATE.modo === 'geral') return true;
    if (STATE.modo === 'mes') return ymKey(d) === STATE.mes;
    if (STATE.modo === 'atual') return isoWeek(d) === isoWeek(HOJE);
    if (STATE.modo === 'semana') return isoWeek(d) === STATE.sem;
    return true;
}

// Só para a aba Aging (e o painel "RCs em aberto" da aba Compradores, que usa a mesma base):
// inclui também 2025, além de 2026 — os demais módulos do painel seguem restritos a 2026 (inY/periodHit)
const inYAging = d => d && (d.getFullYear() === 2026 || d.getFullYear() === 2025);
function periodHitAging(d) {
    if (!d || !inYAging(d)) return false;
    if (STATE.modo === 'geral') return true;
    if (STATE.modo === 'mes') return ymKey(d) === STATE.mes;
    if (STATE.modo === 'atual') return isoWeek(d) === isoWeek(HOJE);
    if (STATE.modo === 'semana') return isoWeek(d) === STATE.sem;
    return true;
}

const compHit = r => STATE.comp === 'GERAL' || r.cp === STATE.comp;
const tpHit = r => STATE.tp === 'GERAL' || (STATE.tp === 'CS' ? ['Contrato', 'Spot', 'Exclusiva', 'Determinada'].indexOf(r.td) > -1 : r.td === STATE.tp);
const stHit = r => STATE.st === 'GERAL' || r.st === STATE.st;

// RCs excluídas da apuração de SLA a pedido do time — não representam atraso real do comprador
const SLA_EXCL_RC = new Set(['920055115', '910104927', '910104998', '11413071', '970001260', '11413074', '11413106', '11422133', '11422300', '11422847', '11423317', '11423374', '11420372', '11426523', '910105439', '11420487', '11427653', '11427593', '11428002', '11428169', '910105570', '11428021', '940011954', '910105292', '11428003', '11428914', '910105382', '910105438', '910105350']);
const slaHit = r => !SLA_EXCL_RC.has(('' + (r.rc || '')).trim());
