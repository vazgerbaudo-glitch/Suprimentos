const SHEET_CSV_URL = ""; // cole aqui o link CSV publicado para atualização automática
const BASE_CSV_PATH = "base.csv"; // arquivo local lido automaticamente se existir (deploy)
const EMB = { cols: [], rows: [] };

// Recortes de apuração. DATA_INI é o corte histórico (abr/2026) e continua valendo para os painéis de
// setor (render_setor.js), que não mudaram. O painel Compras Ágeis passou a separar dois recortes para
// bater com o BI "Gestão à Vista", que usa escopos diferentes por indicador: volume (entradas, conclusões,
// produtividade, saving) cobre 2026 inteiro via DATA_INI_VOL, enquanto a aderência ao SLA só conta a
// partir de abr/2026 via DATA_INI_SLA. Com um corte único, um dos dois necessariamente diverge do BI.
const HOJE = new Date(),
    DATA_INI = new Date(2026, 3, 1),
    DATA_INI_VOL = new Date(2026, 0, 1),
    DATA_INI_SLA = new Date(2026, 3, 1),
    DATA_INI_AGING = new Date(2026, 0, 1);

const C = {
    ink: '#13303F',
    steel: '#5A8CAE',
    blue: '#0E538C',
    teal: '#1E9F7F',
    amber: '#D9A400',
    red: '#D2373C',
    mist: '#7A8C97',
    green: '#7FE06C',
    accent: '#FBD300',
    purple: '#003865'
};

const GN = ['Análise Escopo', 'Estratégia', 'Envio RFx', 'Receb. Propostas', 'Equaliz. Técnica', 'Equaliz. Comercial', 'Negociação', 'Aprovação', 'Chancela', 'Assinatura'];

const COMP_COLS = [
    { k: 'cp', l: 'Comprador' },
    { k: 'concl', l: 'Concluídos' },
    { k: 'ipd', l: 'Itens/dia' },
    { k: 'openN', l: 'Itens abertos' },
    { k: 'agingAvg', l: 'Aging médio' },
    { k: 'slaPct', l: '% SLA' },
    { k: 'saving', l: 'Saving (R$)' }
];

const RCOPEN_COLS = [
    { k: 'cp', l: 'Comprador' },
    { k: 'rc', l: 'RC' },
    { k: 'it', l: 'Itens' },
    { k: 'sa', l: 'SLA Alvo' },
    { k: 'age', l: 'Aging (d)' },
    { k: 'saldo', l: 'Saldo SLA' }
];
