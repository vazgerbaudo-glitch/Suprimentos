function setSrc(s, m) {
    const d = document.getElementById('srcdot'), t = document.getElementById('srctxt');
    d.className = 'dot ' + (s || '');
    d.title = m || '';
    t.textContent = m || '';
}

function loadEmpty(msg) {
    ALL = fromEmbedded();
    setSrc(msg ? 'err' : '', msg || 'Carregue o CSV de Gestão à Vista do setor');
    buildFilters();
    render();
}

function loadCSVText(txt, nome) {
    try {
        const recs = fromCSV(txt).filter(r => r.dc || r.dl || r.st === 'A');
        if (!recs.length) throw new Error('vazio ou cabeçalhos não reconhecidos');
        ALL = recs;
        setSrc('live', 'Base carregada: ' + (nome || 'CSV') + ' · ' + ALL.length + ' registros · ' + new Date().toLocaleString('pt-BR'));
        buildFilters();
        render();
    } catch (err) {
        setSrc('err', 'Falha ao ler o CSV (' + err.message + '). Confira o cabeçalho das colunas.');
    }
}

function readFile(file) {
    if (!file) return;
    const rd = new FileReader();
    rd.onload = () => loadCSVText(rd.result, file.name);
    rd.onerror = () => setSrc('err', 'Erro ao abrir o arquivo.');
    rd.readAsText(file, 'UTF-8');
}

f_file.onchange = e => readFile(e.target.files[0]);

const drop = document.getElementById('drop');
['dragover', 'dragenter'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.style.opacity = .6; }));
['dragleave', 'drop'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.style.opacity = 1; }));
drop.addEventListener('drop', e => { if (e.dataTransfer.files[0]) readFile(e.dataTransfer.files[0]); });

loadEmpty();
