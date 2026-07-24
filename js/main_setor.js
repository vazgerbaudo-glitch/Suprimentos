function setDot(cls) {
    document.getElementById('srcdot').className = 'dot' + (cls ? ' ' + cls : '');
}

function loadEmpty() {
    ALL = fromEmbedded();
    setDot('');
    buildFilters();
    render();
}

function loadCSVText(txt, nome) {
    try {
        const recs = fromCSV(txt).filter(r => r.dc || r.dl || r.st === 'A');
        if (!recs.length) throw new Error('vazio ou cabeçalhos não reconhecidos');
        ALL = recs;
        setDot('live');
        buildFilters();
        render();
    } catch (err) {
        setDot('err');
        alert('Falha ao ler o CSV (' + err.message + '). Confira o cabeçalho das colunas.');
    }
}

function readFile(file) {
    if (!file) return;
    const rd = new FileReader();
    rd.onload = () => loadCSVText(rd.result, file.name);
    rd.onerror = () => { setDot('err'); alert('Erro ao abrir o arquivo.'); };
    rd.readAsText(file, 'UTF-8');
}

f_file.onchange = e => readFile(e.target.files[0]);

const drop = document.getElementById('drop');
['dragover', 'dragenter'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.style.opacity = .6; }));
['dragleave', 'drop'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.style.opacity = 1; }));
drop.addEventListener('drop', e => { if (e.dataTransfer.files[0]) readFile(e.dataTransfer.files[0]); });

loadEmpty();
