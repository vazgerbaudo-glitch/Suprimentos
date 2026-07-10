const SHEET_CSV_URL = ""; // cole aqui o link CSV publicado para atualização automática
const BASE_CSV_PATH = "base.csv"; // arquivo local lido automaticamente se existir (deploy)
const EMB = {cols:[],rows:[]};
const HOJE=new Date(), DATA_INI=new Date(2026,3,1);
const C={ink:'#F5F6F7',steel:'#4FA8D8',blue:'#5FC3E8',teal:'#22D3A6',amber:'#F5B942',red:'#F0575D',mist:'#9BA1A6',green:'#6EE7B7',accent:'#FFEA00',purple:'#C77DDA'};
const GN=['Análise Escopo','Estratégia','Envio RFx','Receb. Propostas','Equaliz. Técnica','Equaliz. Comercial','Negociação','Aprovação','Chancela','Assinatura'];
const COMP_COLS=[{k:'cp',l:'Comprador'},{k:'concl',l:'Concluídos'},{k:'ipd',l:'Itens/dia'},{k:'openN',l:'Abertas'},{k:'agingAvg',l:'Aging médio'},{k:'slaPct',l:'% SLA'},{k:'saving',l:'Saving (R$)'}];
