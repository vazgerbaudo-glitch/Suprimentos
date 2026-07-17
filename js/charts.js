Chart.defaults.font.family="Verdana,sans-serif";Chart.defaults.font.size=11;Chart.defaults.color='#46606F';
Chart.defaults.layout.padding={top:12};
const noG={grid:{display:false}},soG={grid:{color:'#E5EBEE'},border:{display:false}};
// ---- helpers de cor ----
function colA(col,a){if(typeof col!=='string')return `rgba(70,96,111,${a})`;const m=/^#([0-9a-f]{6})$/i.exec(col);if(!m)return col;const n=parseInt(m[1],16);return `rgba(${n>>16&255},${n>>8&255},${n&255},${a})`;}
function colLight(col){const m=/^#([0-9a-f]{6})$/i.exec(col||'');if(!m)return col;const n=parseInt(m[1],16),mx=c=>Math.round(c+(255-c)*.45);return `rgb(${mx(n>>16&255)},${mx(n>>8&255)},${mx(n&255)})`;}
// ---- rótulo no topo das colunas: negrito, na cor da própria coluna a 60% (some se a coluna for estreita) ----
const valLabels={id:'valLabels',afterDatasetsDraw(chart){if(chart.options.indexAxis==='y')return;const ctx=chart.ctx;ctx.save();ctx.font="700 9px Verdana,sans-serif";ctx.textAlign='center';ctx.textBaseline='bottom';chart.data.datasets.forEach((ds,di)=>{const meta=chart.getDatasetMeta(di);if(meta.hidden||meta.type!=='bar'||ds.stack)return;meta.data.forEach((el,i)=>{const v=ds.data[i];if(v==null||typeof v==='object'||isNaN(v)||!+v)return;if(el.width<14)return;const c=Array.isArray(ds.backgroundColor)?ds.backgroundColor[i]:ds.backgroundColor;ctx.fillStyle=colA(c,.6);const n=+v;ctx.fillText(Math.abs(n)>=1e4?Kf(n):n.toLocaleString('pt-BR',{maximumFractionDigits:2}),el.x,el.y-3);});});ctx.restore();}};
Chart.register(valLabels);
// ---- pílulas de valor nas barras horizontais: passar o mouse em qualquer ponto do gráfico mostra todas de uma vez ----
const hoverPills={id:'hoverPills',
 afterEvent(chart,args){if(chart.options.indexAxis!=='y')return;const on=args.event.type!=='mouseout';if(chart.$pills!==on){chart.$pills=on;args.changed=true;}},
 afterDatasetsDraw(chart){
  if(chart.options.indexAxis!=='y'||!chart.$pills)return;
  const ctx=chart.ctx,tt=chart.options.plugins&&chart.options.plugins.tooltip,cb=tt&&tt.callbacks&&tt.callbacks.label;
  ctx.save();ctx.font="700 9px Verdana,sans-serif";ctx.textBaseline='middle';ctx.textAlign='left';
  chart.data.datasets.forEach((ds,di)=>{
   const meta=chart.getDatasetMeta(di);if(meta.hidden||meta.type!=='bar')return;
   meta.data.forEach((el,i)=>{
    const v=ds.data[i];if(v==null||typeof v==='object'||isNaN(+v)||!+v)return;
    let txt=null;if(cb)try{txt=cb({chart,parsed:{x:+v,y:i},raw:v,dataset:ds,dataIndex:i,datasetIndex:di});}catch(e){}
    if(txt==null)txt=(+v).toLocaleString('pt-BR',{maximumFractionDigits:2});
    if(Array.isArray(txt))txt=txt.join(' ');txt=String(txt);
    const tw=ctx.measureText(txt).width,h=16,w=tw+22;
    const left=Math.min(el.base,el.x),segW=Math.abs(el.x-el.base);
    if(ds.stack&&segW<w+8)return;
    const x=left+5,y=el.y,col=Array.isArray(ds.backgroundColor)?ds.backgroundColor[i]:ds.backgroundColor;
    ctx.fillStyle='rgba(31,41,51,.92)';
    if(ctx.roundRect){ctx.beginPath();ctx.roundRect(x,y-h/2,w,h,8);ctx.fill();}else ctx.fillRect(x,y-h/2,w,h);
    ctx.beginPath();ctx.arc(x+8,y,2.5,0,Math.PI*2);ctx.fillStyle=typeof col==='string'?col:'#5A8CAE';ctx.fill();
    ctx.fillStyle='#FFF';ctx.fillText(txt,x+14,y+.5);
   });
  });
  ctx.restore();
 }};
Chart.register(hoverPills);
// ---- tooltip HTML unificado: fundo escuro arredondado, título em negrito, série colorida, valor em negrito e variação % vs ponto anterior ----
function ttEl(){let el=document.getElementById('chartjs-tt');if(!el){el=document.createElement('div');el.id='chartjs-tt';el.style.cssText='position:absolute;pointer-events:none;z-index:9999;background:#3B4046;color:#FFF;border-radius:12px;padding:10px 14px;font:11px/1.55 Verdana,sans-serif;box-shadow:0 8px 20px rgba(19,48,63,.30);opacity:0;transition:opacity .12s;white-space:nowrap';document.body.appendChild(el);}return el;}
function ttPct(chart,dp){if(!dp)return'';const meta=chart.getDatasetMeta(dp.datasetIndex);if(meta.type!=='bar'&&meta.type!=='line')return'';if(chart.options.indexAxis==='y')return'';const i=dp.dataIndex;if(i<1)return'';const raw=v=>(v&&typeof v==='object')?NaN:+v;const cur=raw(dp.dataset.data[i]),prev=raw(dp.dataset.data[i-1]);if(!isFinite(cur)||!isFinite(prev)||!prev)return'';const p=(cur-prev)/Math.abs(prev)*100,up=p>=0;if(!p)return'';return ` <b style="color:${up?'#7FE06C':'#FF8A8C'}">${(up?'+':'')+p.toFixed(1).replace('.',',')}% ${up?'↑':'↓'}</b>`;}
function ttExternal(ctx){const{chart,tooltip}=ctx;const el=ttEl();if(!tooltip.opacity){el.style.opacity=0;return;}
 const title=(tooltip.title||[]).join(' ');
 const rows=(tooltip.body||[]).map((b,i)=>{const dp=tooltip.dataPoints&&tooltip.dataPoints[i];const lc=(tooltip.labelColors&&tooltip.labelColors[i])||{};
  let col=lc.backgroundColor;if(dp){const mt=chart.getDatasetMeta(dp.datasetIndex).type;if(mt==='line'&&typeof dp.dataset.borderColor==='string')col=dp.dataset.borderColor;}
  if(typeof col!=='string')col=typeof lc.borderColor==='string'?lc.borderColor:'#5A8CAE';
  let txt=b.lines.join(' '),name='',val=txt;const ci=txt.indexOf(':');
  if(ci>0){name=txt.slice(0,ci).trim();val=txt.slice(ci+1).trim();}
  val=val.replace(/(-?(?:R\$\s?)?\d[\d.,]*\s?%?)/g,'<b>$1</b>');
  return `<div style="display:flex;align-items:center;gap:7px;margin-top:5px"><span style="width:8px;height:8px;border-radius:50%;background:${col};flex:0 0 8px"></span><span>${name?`<b style="color:${colLight(col)}">${name}</b> : `:''}${val}${ttPct(chart,dp)}</span></div>`;}).join('');
 el.innerHTML=(title?`<div style="font-weight:700;margin-bottom:2px">${title}</div>`:'')+rows;
 const r=chart.canvas.getBoundingClientRect();
 el.style.left=(r.left+window.scrollX+tooltip.caretX)+'px';
 el.style.top=(r.top+window.scrollY+tooltip.caretY)+'px';
 el.style.transform=tooltip.caretX>chart.width/2?'translate(calc(-100% - 14px),-50%)':'translate(14px,-50%)';
 el.style.opacity=1;}
Chart.defaults.plugins.tooltip.enabled=false;
Chart.defaults.plugins.tooltip.external=ttExternal;
Chart.defaults.plugins.legend.display=false;
const crosshair={id:'crosshair',afterDatasetsDraw(chart){const act=chart.tooltip&&chart.tooltip._active;if(!act||!act.length)return;const x=act[0].element.x,{top,bottom}=chart.chartArea,ctx=chart.ctx;ctx.save();ctx.beginPath();ctx.setLineDash([4,4]);ctx.lineWidth=1;ctx.strokeStyle='rgba(0,56,101,.30)';ctx.moveTo(x,top);ctx.lineTo(x,bottom);ctx.stroke();ctx.restore();}};
const refLines=vals=>({id:'refLines',afterDatasetsDraw(chart){const xs=chart.scales.x;if(!xs)return;const{top,bottom}=chart.chartArea,ctx=chart.ctx;ctx.save();vals.forEach(v=>{const x=xs.getPixelForValue(v.v);if(x<chart.chartArea.left||x>chart.chartArea.right)return;ctx.beginPath();ctx.setLineDash([5,4]);ctx.lineWidth=1.4;ctx.strokeStyle=v.color;ctx.moveTo(x,top);ctx.lineTo(x,bottom);ctx.stroke();if(v.label){ctx.setLineDash([]);ctx.fillStyle=v.color;ctx.font="700 9px Verdana,sans-serif";ctx.textAlign='center';ctx.fillText(v.label,x,top-3);}});ctx.restore();}});
function kill(id){if(CH[id]){CH[id].destroy();delete CH[id];}}
function mkChart(id,cfg){kill(id);const o=cfg.options||(cfg.options={});if(o.indexAxis==='y'){o.plugins=o.plugins||{};o.plugins.tooltip=Object.assign({},o.plugins.tooltip,{enabled:false,external:null});}CH[id]=new Chart(document.getElementById(id),cfg);renderLegend(CH[id]);}
// ---- cabeçalho dos cards: "Título • Rótulo", descrição vira ícone ⓘ, legenda em chips no topo ----
function cap(s){s=(s||'').trim();return s?s[0].toUpperCase()+s.slice(1):s;}
// Rótulos manuais para títulos sem divisão natural (—/por/vs)
const TAGMAP={
 'Atingimento da meta de produtividade':['Produtividade','Atingimento da meta'],
 'Mix Contrato × Spot':['Mix','Contrato × Spot'],
 '% dentro do SLA':['SLA','% dentro do prazo'],
 'Evolução do % dentro do SLA':['SLA','Evolução semanal'],
 'Gravidade do atraso':['Atrasos','Por gravidade'],
 'Evolução do tempo de ciclo':['Tempo de ciclo','Evolução'],
 'Evolução dos itens críticos':['Itens críticos','Evolução'],
 'Saving × Volume de compras':['Saving × Volume','Por categoria'],
 'Material × Serviço':['Material × Serviço','Composição']
};
function upgradeHeaders(){
 document.querySelectorAll('.panel h3').forEach(h=>{
  if(h.dataset.up)return;h.dataset.up='1';
  const link=h.querySelector('.link-tab');if(link)link.remove();
  const par=h.parentElement;
  const ph=par?par.querySelector(':scope > .ph'):null;
  const tip=(ph&&!ph.id)?ph.textContent.replace(/\s+/g,' ').trim():'';
  if(ph&&!ph.id)ph.remove();
  let titleHTML,tag='';
  if(h.children.length>0){titleHTML=h.innerHTML;}
  else{
   const raw=h.textContent.replace(/\s+/g,' ').trim();
   let t=raw,g='';
   const dash=raw.split(/\s+—\s+/);
   if(TAGMAP[raw]){t=TAGMAP[raw][0];g=TAGMAP[raw][1];}
   else if(dash.length>1){t=dash[0];g=cap(dash.slice(1).join(' — '));}
   else{const m=/^(.+?)\s+(por|vs\.?)\s+(.+)$/.exec(raw);if(m){t=m[1];g=m[2]==='por'?cap(m[2]+' '+m[3]):m[2]+' '+m[3];}}
   titleHTML=t;tag=g;
  }
  h.innerHTML='';
  const ts=document.createElement('span');ts.className='h3t';ts.innerHTML=titleHTML;h.appendChild(ts);
  if(tag){const d=document.createElement('span');d.className='h3dot';d.textContent='•';h.appendChild(d);
   const tg=document.createElement('span');tg.className='h3tag';tg.textContent=tag;h.appendChild(tg);}
  if(tip){const ic=document.createElement('span');ic.className='info';ic.textContent='i';ic.setAttribute('data-tip',tip);h.appendChild(ic);}
  const lg=document.createElement('span');lg.className='leg';h.appendChild(lg);
  if(link)h.appendChild(link);
 });
}
function solidCol(chart,di){const ds=chart.data.datasets[di];if(chart.getDatasetMeta(di).type==='line'&&typeof ds.borderColor==='string')return ds.borderColor;const b=ds.backgroundColor;return typeof b==='string'?b:(Array.isArray(b)?b[0]:(typeof ds.borderColor==='string'?ds.borderColor:'#5A8CAE'));}
function renderLegend(chart){
 const p=chart.canvas.closest('.panel');if(!p)return;
 const el=p.querySelector('h3 .leg');if(!el)return;
 const dss=chart.data.datasets||[],labs=chart.data.labels||[],t=chart.config.type;
 const named=dss.map((ds,i)=>({ds,i})).filter(o=>o.ds.label);
 const custom=chart.config.options&&chart.config.options.legendChips;
 let items=[];
 if(custom)items=custom.map(c=>({txt:c[0],col:c[1]}));
 else if(named.length>=2)items=named.map(o=>({txt:o.ds.label,col:solidCol(chart,o.i),di:o.i}));
 else if(t==='doughnut'||t==='pie')items=labs.map((l,i)=>({txt:l,col:Array.isArray(dss[0].backgroundColor)?dss[0].backgroundColor[i]:dss[0].backgroundColor,ci:i}));
 else if(dss.length===1&&Array.isArray(dss[0].backgroundColor)&&labs.length>1&&labs.length<=6&&new Set(dss[0].backgroundColor).size>1)items=labs.map((l,i)=>({txt:l,col:dss[0].backgroundColor[i]}));
 if(items.length>8)items=items.slice(0,8);
 el.innerHTML=items.map(it=>`<span class="lg-it" data-di="${it.di!=null?it.di:''}" data-ci="${it.ci!=null?it.ci:''}"><span class="lg-dot" style="background:${it.col}"></span>${it.txt}</span>`).join('');
 el.querySelectorAll('.lg-it').forEach(s=>{s.onclick=()=>{
  const di=s.dataset.di,ci=s.dataset.ci;
  if(di!==''){const v=chart.isDatasetVisible(+di);chart.setDatasetVisibility(+di,!v);s.classList.toggle('off',v);chart.update();}
  else if(ci!==''){chart.toggleDataVisibility(+ci);s.classList.toggle('off');chart.update();}
 };});
}
upgradeHeaders();
