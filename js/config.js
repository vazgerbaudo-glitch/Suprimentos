const SHEET_CSV_URL = ""; // cole aqui o link CSV publicado para atualização automática
const BASE_CSV_PATH = "base.csv"; // arquivo local lido automaticamente se existir (deploy)
const EMB = {cols:[],rows:[]};
const HOJE=new Date(2026,5,25), DATA_INI=new Date(2026,3,1);
const C={ink:'#1C2325',steel:'#28738A',blue:'#3599B8',teal:'#168980',amber:'#B59525',red:'#BB4A4A',mist:'#7F898A',green:'#7FE06C',accent:'#FFEA00',purple:'#9F4BB9'};
const GN=['Análise Escopo','Estratégia','Envio RFx','Receb. Propostas','Equaliz. Técnica','Equaliz. Comercial','Negociação','Aprovação','Chancela','Assinatura'];
const COMP_COLS=[{k:'cp',l:'Comprador'},{k:'concl',l:'Concluídos'},{k:'ipd',l:'Itens/dia'},{k:'openN',l:'Abertas'},{k:'agingAvg',l:'Aging médio'},{k:'slaPct',l:'% SLA'},{k:'saving',l:'Saving (R$)'}];
