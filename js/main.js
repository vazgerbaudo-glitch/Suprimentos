function setSrc(s,m){const d=document.getElementById('srcdot'),t=document.getElementById('srctxt');d.className='dot '+(s||'');d.title=m||'';t.textContent='';}
// ===== tela de abertura — 3 fileiras de vagões; locomotiva puxa o "Ágeis" =====
function buildSplash(){
 const el=document.getElementById('splash');if(!el)return;
 el.innerHTML='';
 const H=64,WW=200,LW=150,CF=14,SW=3,GX=14,GY=14,vw=window.innerWidth,vh=window.innerHeight;
 const stepX=WW+GX;
 const FILL=['#0E538C','#003865'],STK=['#3FA9F5','#FFFFFF'];
 const wagonD=(x,cham)=>cham?`M${x} 0H${x+WW}V${H-CF}L${x+WW-CF} ${H}H${x+CF}L${x} ${H-CF}Z`:`M${x} 0H${x+WW}V${H}H${x}Z`;
 const locoD=x=>`M${x+44} 0H${x+LW}V${H-CF}L${x+LW-CF} ${H}H${x+CF}L${x} ${H-CF}V26Z`;
 const tops=[vh/2-H*1.5-GY,vh/2-H/2,vh/2+H/2+GY];
 const rowsEls=[];
 for(let r=0;r<3;r++){
  const row=document.createElement('div');row.className='train-row';
  row.style.top=tops[r]+'px';row.style.height=H+'px';
  const shift=(r%2)?stepX/2:0;
  const cA=Math.floor((-stepX+shift)/stepX),cB=Math.ceil((vw+stepX+shift)/stepX);
  const cBtn=(r===1)?Math.round((vw/2-WW/2+shift)/stepX):null;
  let svg=`<svg width="${vw+4*stepX}" height="${H}" style="position:absolute;left:${-2*stepX}px;top:0;overflow:visible">`;
  for(let c=cA;c<=cB;c++){
   if(c===cBtn||(cBtn!=null&&c===cBtn+1))continue;
   const x=c*stepX-shift+2*stepX;
   if(cBtn!=null&&c===cBtn-1){svg+=`<path d="${locoD(x+WW-LW)}" fill="#003865" stroke="#FFFFFF" stroke-width="${SW}" stroke-linejoin="round"/>`;continue;}
   const k=(((c+r)%2)+2)%2;
   svg+=`<path d="${wagonD(x,(((c%2)+2)%2)===0)}" fill="${FILL[k]}" stroke="${STK[k]}" stroke-width="${SW}" stroke-linejoin="round"/>`;
  }
  row.innerHTML=svg+'</svg>';
  if(cBtn!=null){
   const mkBtn=(col,cls,label,aria,url)=>{
    const btn=document.createElement('button');
    btn.className=cls;
    btn.style.left=col*stepX-shift+'px';btn.style.width=WW+'px';btn.style.height=H+'px';btn.style.setProperty('--cf',CF+'px');
    btn.textContent=label;
    btn.setAttribute('aria-label',aria);
    btn.onclick=()=>departSplash(el,row,rowsEls,url);
    row.appendChild(btn);
   };
   mkBtn(cBtn,'brick-enter b','Ágeis','Entrar no dashboard');
   mkBtn(cBtn+1,'brick-enter alt b','teste','Abrir painel de teste','curioso.html');
  }
  rowsEls.push(row);el.appendChild(row);
 }
}
function departSplash(el,btnRow,rows,url){
 el.classList.add('depart');
 window.removeEventListener('resize',onSplashResize);
 btnRow.style.transition='transform 1.1s cubic-bezier(.6,0,1,.45)';
 btnRow.style.transform='translateX(-130vw)';
 rows.forEach(o=>{if(o!==btnRow){o.style.transition='opacity .7s ease .1s';o.style.opacity='0';}});
 setTimeout(()=>{el.classList.add('hide');if(url)setTimeout(()=>{location.href=url;},250);else setTimeout(()=>el.remove(),400);},1100);
}
function onSplashResize(){const s=document.getElementById('splash');if(s&&!s.classList.contains('depart'))buildSplash();}
buildSplash();
window.addEventListener('resize',onSplashResize);
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
