const SHEET_CSV_URL = ""; // cole aqui o link CSV publicado para atualização automática
const BASE_CSV_PATH = "base.csv"; // arquivo local lido automaticamente se existir (deploy)
const EMB = {cols:[],rows:[]};
const HOJE=new Date(), DATA_INI=new Date(2026,3,1), DATA_INI_AGING=new Date(2026,0,1);
const C={ink:'#13303F',steel:'#5A8CAE',blue:'#0E538C',teal:'#1E9F7F',amber:'#D9A400',red:'#D2373C',mist:'#7A8C97',green:'#7FE06C',accent:'#FBD300',purple:'#003865'};
const GN=['Análise Escopo','Estratégia','Envio RFx','Receb. Propostas','Equaliz. Técnica','Equaliz. Comercial','Negociação','Aprovação','Chancela','Assinatura'];
const COMP_COLS=[{k:'cp',l:'Comprador'},{k:'concl',l:'Concluídos'},{k:'ipd',l:'Itens/dia'},{k:'openN',l:'Abertas'},{k:'agingAvg',l:'Aging médio'},{k:'slaPct',l:'% SLA'},{k:'saving',l:'Saving (R$)'}];
