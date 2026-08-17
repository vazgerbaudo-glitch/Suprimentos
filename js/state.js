let ALL = [], ALLRC = [], DUCAL = {}, STATE = {
    modo: 'geral',
    mes: null,
    sem: null,
    comp: 'GERAL',
    tp: 'GERAL',
    st: 'GERAL',
    car: 'GERAL',
    metaMat: 11,
    metaServ: 3,
    metaAgG: 60,
    metaAgC: 87,
    metaAgS: 67,
    ccdTipoMode: 'linha',
    // Aba Contratualização: escopo da "Consulta por carteira" ('todas' = todas as Gerências Finais,
    // 'alvo' = só a gerência da página) e a exclusão das RCs ainda pendentes por Grupo Comprador
    // (Sistema) — quando ligada, tira essas RCs de todo o arquivo Spend nos cálculos da aba.
    cartTblGer: 'todas',
    exclPend: false
}, CH = {}, SUM = {}, compSort = { key: 'concl', dir: -1 }, rcOpenSort = { key: 'age', dir: -1 }, CARTEIRAS = [];
