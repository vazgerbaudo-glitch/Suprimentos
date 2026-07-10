function setSrc(s,m){const d=document.getElementById('srcdot'),t=document.getElementById('srctxt');d.className='dot '+(s||'');d.title=m||'';t.textContent='';}
function applyRecords(recs,srcLabel){ALL=recs;setSrc('live',srcLabel+' · '+ALL.length+' registros · '+new Date().toLocaleString('pt-BR'));buildFilters();render();}
function loadEmpty(msg){ALL=fromEmbedded();setSrc(msg?'err':'',msg||'Nenhuma base carregada');buildFilters();render();}
function loadLocalBase(prefix){
 fetch(BASE_CSV_PATH).then(r=>{if(!r.ok)throw new Error(r.status);return r.text();}).then(txt=>{const recs=fromCSV(txt).filter(r=>r.dc||r.dl||r.st==='A');if(!recs.length)throw new Error('vazio');applyRecords(recs,'Base local ('+BASE_CSV_PATH+')');}).catch(()=>{loadEmpty(prefix?prefix+' Exibindo base inicial.':null);});
}
function loadSheet(url){
 setSrc('','Buscando Google Sheets…');
 fetch(url).then(r=>{if(!r.ok)throw new Error(r.status);return r.text();}).then(txt=>{const recs=fromCSV(txt).filter(r=>r.dc||r.dl||r.st==='A');if(!recs.length)throw new Error('vazio');applyRecords(recs,'Conectado ao Google Sheets');}).catch(e=>{loadLocalBase('Falha ao ler o Sheets ('+e.message+').');});
}
function loadData(url){if(url)return loadSheet(url);loadLocalBase();}
function loadCSVText(txt,nome){try{const recs=fromCSV(txt).filter(r=>r.dc||r.dl||r.st==='A');if(!recs.length)throw new Error('vazio ou cabeçalhos não reconhecidos');ALL=recs;setSrc('live','Base carregada: '+(nome||'CSV')+' · '+ALL.length+' registros · '+new Date().toLocaleString('pt-BR'));buildFilters();render();}catch(err){setSrc('err','Falha ao ler o CSV ('+err.message+'). Exibindo base inicial. Confira o cabeçalho das colunas.');}}
function readFile(file){if(!file)return;const rd=new FileReader();rd.onload=()=>loadCSVText(rd.result,file.name);rd.onerror=()=>setSrc('err','Erro ao abrir o arquivo.');rd.readAsText(file,'UTF-8');}
f_file.onchange=e=>readFile(e.target.files[0]);
const drop=document.getElementById('drop');
['dragover','dragenter'].forEach(ev=>drop.addEventListener(ev,e=>{e.preventDefault();drop.style.opacity=.6;}));
['dragleave','drop'].forEach(ev=>drop.addEventListener(ev,e=>{e.preventDefault();drop.style.opacity=1;}));
drop.addEventListener('drop',e=>{if(e.dataTransfer.files[0])readFile(e.dataTransfer.files[0]);});
loadData(SHEET_CSV_URL);
