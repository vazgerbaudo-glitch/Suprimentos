function periodoLabel(){
 if(STATE.modo==='mes')return 'Mês de '+mLabel(STATE.mes);
 if(STATE.modo==='atual')return 'Semana atual (início '+wkLabelFull(isoWeek(HOJE))+')';
 if(STATE.modo==='semana')return 'Semana de '+wkLabelFull(STATE.sem);
 return 'Geral (2026)';
}
function tipoLabel(){return STATE.tp==='GERAL'?'Geral (todos os tipos)':STATE.tp==='CS'?'Contrato e Spot':STATE.tp;}
function leitura(id){const el=document.getElementById(id);return el?el.textContent.replace(/^Leitura:\s*/,'').trim():'';}
function buildSlidesData(){
 const P=SUM.prod,A=SUM.aging,S=SUM.sla,V=SUM.saving,K=SUM.contr;
 if(!P||!A||!S||!V||!K)return null;
 const pt1=n=>(+n).toFixed(1).replace('.',',');
 // Comparativo por comprador — semana anterior → semana atual (equipe toda, independe do filtro de comprador)
 const wCur=isoWeek(HOJE),wPrev=isoWeek(new Date(HOJE.getTime()-7*86400000));
 const bwC={};ALL.forEach(r=>{if(r.st!=='C'||!r.dc||r.dc<DATA_INI||!tpHit(r))return;const w=isoWeek(r.dc);if(w!==wCur&&w!==wPrev)return;const o=bwC[r.cp]=bwC[r.cp]||{p:0,c:0};if(w===wPrev)o.p++;else o.c++;});
 const wkRows=Object.entries(bwC).map(([cp,o])=>({cp,p:o.p,c:o.c})).sort((a,b)=>(b.p+b.c)-(a.p+a.c)).slice(0,14).reverse();
 // Material × Serviço concluídos no recorte
 const msB=ALL.filter(r=>r.st==='C'&&r.dc&&r.dc>=DATA_INI&&periodHit(r.dc)&&tpHit(r)&&compHit(r));
 const nMat=msB.filter(r=>r.cl==='Material').length,nServ=msB.filter(r=>r.cl==='Serviço').length,totMS=nMat+nServ;
 const pMat=totMS?Math.round(nMat/totMS*100):0,pServ=totMS?100-pMat:0;
 // Faróis
 const fProd=P.ating>=100?'verde':P.ating>=80?'amarelo':'vermelho';
 const fAgG=A.gpct<=0?'verde':'vermelho',fAgC=A.con.pct<=0?'verde':'vermelho',fAgS=A.spo.pct<=0?'verde':'vermelho';
 const fSla=S.pct>=90?'verde':S.pct>=80?'amarelo':'vermelho';
 // Pontos críticos + recomendações (determinístico: só o que está fora/perto do limite)
 const pontos=[],recs=[];
 if(P.ating<100){pontos.push(['Produtividade em '+P.ating.toFixed(0)+'% da meta ponderada (mínimo aceitável 80%)',P.ating>=80?'amarelo':'vermelho']);recs.push('Priorizar a fila de conclusão para recuperar o atingimento da meta ponderada.');}
 if(A.gpct>0){pontos.push(['Aging geral em '+A.avg+'d — acima da meta de '+A.meta+'d em '+A.gpct.toFixed(0)+'%','vermelho']);recs.push('Mutirão de limpeza das RCs mais antigas da carteira (backlog de meses anteriores).');}
 if(A.con.pct>0)pontos.push(['Aging Contrato em '+A.con.avg+'d vs meta ≤ '+A.con.meta+'d','vermelho']);
 if(A.spo.pct>0)pontos.push(['Aging Spot em '+A.spo.avg+'d vs meta ≤ '+A.spo.meta+'d','vermelho']);
 if(A.crit>0){pontos.push([A.crit+' RCs críticas com ciclo aberto acima de 30 dias','vermelho']);recs.push('Tratar individualmente as RCs críticas (>30d) com plano de destravamento por comprador.');}
 if(S.pct<90){pontos.push(['SLA em '+pt1(S.pct)+'% — abaixo da meta de 90% ('+S.fora+' RCs fora do prazo)',S.pct>=80?'amarelo':'vermelho']);recs.push('Atacar a principal causa de atraso apontada no Pareto da aba SLA do painel.');}
 if(V.total<0){pontos.push(['Saving negativo no recorte: '+Kf(V.total),'vermelho']);recs.push('Rever as negociações com resultado abaixo da 1ª proposta.');}
 if(!recs.length)recs.push('Manter o ritmo atual e monitorar os faróis semanalmente.');
 const cart=(K.top||[]).slice(0,6).reverse();
 return {
  gerado:new Date().toLocaleString('pt-BR'),
  base:(document.getElementById('srcdot').title||'Base não identificada'),
  periodo:periodoLabel(),tipo:tipoLabel(),
  comprador:STATE.comp==='GERAL'?'Geral (todos os compradores)':STATE.comp,
  cards:[
   ['ATINGIMENTO DA META',P.ating.toFixed(0)+'%','meta 100% · mínimo 80%',fProd],
   ['AGING MÉDIO GERAL',A.avg+'d','meta ≤ '+A.meta+'d',A.avg<=A.meta?'verde':A.avg<=A.meta*1.3?'amarelo':'vermelho'],
   ['% DENTRO DO SLA',pt1(S.pct)+'%','meta ≥ 90%',fSla],
   ['SAVING TOTAL',Kf(V.total),pt1(V.taxa)+'% de taxa de economia',V.total>=0?'verde':'vermelho'],
   ['RCS CRÍTICAS DE AGING',String(A.crit),'ciclo aberto > 30 dias',A.crit>0?'amarelo':'verde'],
   ['MIX CONTRATO × SPOT',K.pctCon.toFixed(0)+'% × '+K.pctSpo.toFixed(0)+'%',K.total+' RCs liberadas no recorte',null]
  ],
  prod:{ating:+P.ating.toFixed(0),farol:fProd,ritmo:P.val.toFixed(2).replace('.',','),ritmoUn:P.ger?'itens/dia/comprador':'itens/dia',concl:P.concluidos,weeks:P.weeks,weekly:P.weekly},
  comp:{prevLabel:wkLabelFull(wPrev),curLabel:wkLabelFull(wCur),nomes:wkRows.map(r=>r.cp),prev:wkRows.map(r=>r.p),cur:wkRows.map(r=>r.c)},
  ms:{mat:nMat,serv:nServ,pMat,pServ,metaMat:STATE.metaMat,metaServ:STATE.metaServ},
  aging:{blocks:[['Geral',A.open,A.avg,A.meta,fAgG],['Contrato',A.con.open,A.con.avg,A.con.meta,fAgC],['Spot',A.spo.open,A.spo.avg,A.spo.meta,fAgS]],crit:A.crit,faixaLabels:A.faixaLabels,faixaCounts:A.faixaCounts,faixaColors:A.faixaColors},
  sla:{weeks:S.weeks,weekly:S.weekly,pctTxt:pt1(S.pct)+'%',farol:fSla,baseTxt:S.tot+' RCs avaliadas · '+S.fora+' fora do SLA · atraso médio '+S.atrMed+'d quando fura'},
  sav:{totalTxt:Kf(V.total),taxaTxt:pt1(V.taxa)+'%',itens:V.itens,pos:V.total>=0,weeks:V.weeks,weekly:V.weekly.map(v=>Math.round(v))},
  contr:{nCon:K.nCon,nSpo:K.nSpo,nOut:K.nOut,total:K.total,cartNomes:cart.map(x=>x.c),cartVals:cart.map(x=>x.tot)},
  pontos,recs:recs.slice(0,5),
  leituras:{overview:leitura('ins-overview'),prod:leitura('ins-prod'),aging:leitura('ins-aging'),sla:leitura('ins-sla'),saving:leitura('ins-saving'),contr:leitura('ins-contr')}
 };
}
function buildSlidesPrompt(){
 const DATA=buildSlidesData();
 if(!DATA)return null;
 return `INSTRUÇÕES PARA A IA (Copilot): você NÃO vai desenhar slides — vai apenas EXECUTAR o código abaixo.
1. Execute o código Python abaixo EXATAMENTE como está, sem alterar nenhuma linha, usando a biblioteca python-pptx (se necessário: pip install python-pptx).
2. Todos os números, textos, cores e a estrutura dos 10 slides já estão embutidos no código — não recalcule, não reformate, não "melhore" nada.
3. Ao final, entregue o arquivo gerado "Gestao_a_Vista_Compras_Ageis.pptx" para download.
4. Se você não conseguir executar Python ou instalar python-pptx neste ambiente, responda apenas "Não consigo executar código neste ambiente" — NÃO tente montar a apresentação manualmente.

\`\`\`python
# -*- coding: utf-8 -*-
# Gestão à Vista — Compras Ágeis (Rumo) · script gerado automaticamente pelo painel
# Requisito: pip install python-pptx
import json
from pptx import Presentation
from pptx.util import Inches, Pt
from pptx.dml.color import RGBColor
from pptx.enum.text import PP_ALIGN, MSO_ANCHOR
from pptx.enum.shapes import MSO_SHAPE
from pptx.chart.data import CategoryChartData
from pptx.enum.chart import XL_CHART_TYPE, XL_LEGEND_POSITION

D = json.loads(r'''${JSON.stringify(DATA)}''')

def C(h):
    h = h.lstrip('#')
    return RGBColor(int(h[0:2],16), int(h[2:4],16), int(h[4:6],16))

AZUL='#003865'; AZUL2='#0E538C'; STEEL='#5A8CAE'; VERDE='#1E9F7F'
AMARELO='#FBD300'; VERM='#D2373C'; FUNDO='#F2F5F6'; TXTC='#13303F'
MUT='#46606F'; CZB='#CAD6DD'; BRANCO='#FFFFFF'
FAROL={'verde':VERDE,'amarelo':AMARELO,'vermelho':VERM}
FAROL_TXT={'verde':VERDE,'amarelo':'#C79100','vermelho':VERM}

prs = Presentation()
prs.slide_width = Inches(13.333)
prs.slide_height = Inches(7.5)
BLANK = prs.slide_layouts[6]

def novo_slide():
    s = prs.slides.add_slide(BLANK)
    bg = s.shapes.add_shape(MSO_SHAPE.RECTANGLE, 0, 0, prs.slide_width, prs.slide_height)
    bg.fill.solid(); bg.fill.fore_color.rgb = C(FUNDO); bg.line.fill.background(); bg.shadow.inherit = False
    return s

def txt(s,x,y,w,h,t,size=14,color=TXTC,bold=False,align='l'):
    tb = s.shapes.add_textbox(Inches(x),Inches(y),Inches(w),Inches(h))
    tf = tb.text_frame; tf.word_wrap = True
    p = tf.paragraphs[0]
    p.alignment = {'l':PP_ALIGN.LEFT,'c':PP_ALIGN.CENTER,'r':PP_ALIGN.RIGHT}[align]
    r = p.add_run(); r.text = str(t)
    f = r.font; f.size = Pt(size); f.bold = bold; f.name = 'Verdana'; f.color.rgb = C(color)
    return tb

def card(s,x,y,w,h,fill=BRANCO):
    sh = s.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(x),Inches(y),Inches(w),Inches(h))
    sh.adjustments[0] = 0.10
    sh.fill.solid(); sh.fill.fore_color.rgb = C(fill); sh.line.fill.background(); sh.shadow.inherit = False
    return sh

def dot(s,x,y,cor,dm=0.2):
    sh = s.shapes.add_shape(MSO_SHAPE.OVAL, Inches(x),Inches(y),Inches(dm),Inches(dm))
    sh.fill.solid(); sh.fill.fore_color.rgb = C(cor); sh.line.fill.background(); sh.shadow.inherit = False
    return sh

def titulo(s,t,sub=''):
    txt(s,0.55,0.32,12.2,0.7,t,26,AZUL,True)
    if sub: txt(s,0.55,0.95,12.2,0.4,sub,11,MUT)

def grafico(s,tipo,x,y,w,h,cats,series,serie_cores=None,ponto_cores=None,rotulos=True,fmt='0'):
    cd = CategoryChartData(); cd.categories = cats
    for nome, vals in series: cd.add_series(nome, vals)
    gf = s.shapes.add_chart(tipo, Inches(x),Inches(y),Inches(w),Inches(h), cd)
    ch = gf.chart
    ch.has_legend = len(series) > 1
    if ch.has_legend:
        ch.legend.position = XL_LEGEND_POSITION.TOP
        ch.legend.include_in_layout = False
    try:
        ch.font.size = Pt(9); ch.font.name = 'Verdana'; ch.font.color.rgb = C(MUT)
    except Exception: pass
    for i, ser in enumerate(ch.series):
        if tipo == XL_CHART_TYPE.LINE:
            if serie_cores: ser.format.line.color.rgb = C(serie_cores[i])
            try: ser.smooth = True
            except Exception: pass
        elif serie_cores:
            ser.format.fill.solid(); ser.format.fill.fore_color.rgb = C(serie_cores[i])
        if ponto_cores and i == 0:
            for j, p in enumerate(ser.points):
                p.format.fill.solid(); p.format.fill.fore_color.rgb = C(ponto_cores[j])
    if rotulos and tipo != XL_CHART_TYPE.LINE:
        try:
            pl = ch.plots[0]; pl.has_data_labels = True
            dl = pl.data_labels; dl.font.size = Pt(8); dl.font.name = 'Verdana'
            dl.number_format = fmt; dl.number_format_is_linked = False
        except Exception: pass
    return ch

def notas(s,t):
    if t: s.notes_slide.notes_text_frame.text = t

# ---------- Slide 1 — Capa ----------
s = novo_slide()
faixa = s.shapes.add_shape(MSO_SHAPE.RECTANGLE, 0, Inches(6.7), prs.slide_width, Inches(0.8))
faixa.fill.solid(); faixa.fill.fore_color.rgb = C(AZUL); faixa.line.fill.background(); faixa.shadow.inherit = False
txt(s,0.9,2.3,11.5,1.1,'Gestão à Vista — Compras Ágeis',40,AZUL,True)
txt(s,0.9,3.4,11.5,0.5,'Suprimentos · Rumo Logística',18,AZUL2)
txt(s,0.9,4.5,11.5,0.4,D['periodo']+' · '+D['tipo']+' · Comprador: '+D['comprador'],13,MUT)
txt(s,0.9,4.95,11.5,0.4,'Gerado em '+D['gerado']+' · '+D['base'],10,MUT)

# ---------- Slide 2 — Scorecard executivo ----------
s = novo_slide(); titulo(s,'Scorecard executivo', D['periodo']+' · '+D['tipo'])
cw, chh, x0, y0 = 4.0, 2.5, 0.55, 1.55
for i, item in enumerate(D['cards']):
    rot, val, meta, farol = item
    cx = x0 + (i % 3) * (cw + 0.22); cy = y0 + (i // 3) * (chh + 0.25)
    card(s,cx,cy,cw,chh)
    txt(s,cx+0.25,cy+0.22,cw-0.5,0.35,rot,11,MUT,True)
    txt(s,cx+0.25,cy+0.62,cw-0.5,1.25,val,42,AZUL,True)
    txt(s,cx+0.25,cy+1.95,cw-0.9,0.45,meta,10,MUT)
    if farol: dot(s,cx+cw-0.45,cy+2.1,FAROL[farol])
notas(s,D['leituras'].get('overview',''))

# ---------- Slide 3 — Produtividade da equipe ----------
s = novo_slide(); titulo(s,'Produtividade da equipe','Atingimento da meta ponderada — Material e Serviço têm metas próprias')
card(s,0.55,1.6,3.6,5.2)
txt(s,0.8,1.95,3.1,0.35,'ATINGIMENTO',11,MUT,True)
txt(s,0.8,2.35,3.1,1.3,str(D['prod']['ating'])+'%',58,FAROL_TXT[D['prod']['farol']],True)
txt(s,0.8,3.75,3.1,0.4,'meta 100% · mínimo 80%',11,MUT)
txt(s,0.8,4.45,3.1,0.7,'Ritmo: '+D['prod']['ritmo']+' '+D['prod']['ritmoUn'],12)
txt(s,0.8,5.35,3.1,0.7,str(D['prod']['concl'])+' itens concluídos no recorte',12)
dot(s,3.6,1.9,FAROL[D['prod']['farol']])
grafico(s,XL_CHART_TYPE.COLUMN_CLUSTERED,4.5,1.6,8.3,5.2,D['prod']['weeks'],[('Itens concluídos',D['prod']['weekly'])],serie_cores=[VERDE])
notas(s,D['leituras'].get('prod',''))

# ---------- Slide 4 — Produtividade por comprador ----------
s = novo_slide(); titulo(s,'Produtividade por comprador','Semana anterior (início '+D['comp']['prevLabel']+') × semana atual (início '+D['comp']['curLabel']+' — parcial)')
if D['comp']['nomes']:
    grafico(s,XL_CHART_TYPE.BAR_CLUSTERED,0.55,1.45,12.2,5.7,D['comp']['nomes'],[('Semana anterior',D['comp']['prev']),('Semana atual (parcial)',D['comp']['cur'])],serie_cores=[CZB,AZUL])
else:
    txt(s,0.55,3.2,12.2,0.6,'Sem conclusões nas duas semanas comparadas.',14,MUT,False,'c')

# ---------- Slide 5 — Material × Serviço ----------
s = novo_slide(); titulo(s,'Material × Serviço','Réguas diferentes — o atingimento ponderado já considera o mix real')
ch = grafico(s,XL_CHART_TYPE.DOUGHNUT,0.55,1.6,5.8,5.2,['Material','Serviço'],[('Itens',[D['ms']['mat'],D['ms']['serv']])],ponto_cores=[STEEL,AZUL2])
ch.has_legend = True; ch.legend.position = XL_LEGEND_POSITION.BOTTOM; ch.legend.include_in_layout = False
card(s,6.9,1.9,5.9,1.6)
txt(s,7.15,2.1,5.4,0.35,'MATERIAL',11,MUT,True)
txt(s,7.15,2.45,5.4,0.7,str(D['ms']['mat'])+' itens ('+str(D['ms']['pMat'])+'%)',22,STEEL,True)
txt(s,7.15,3.1,5.4,0.35,'meta '+str(D['ms']['metaMat'])+' itens/dia/comprador',10,MUT)
card(s,6.9,3.7,5.9,1.6)
txt(s,7.15,3.9,5.4,0.35,'SERVIÇO',11,MUT,True)
txt(s,7.15,4.25,5.4,0.7,str(D['ms']['serv'])+' itens ('+str(D['ms']['pServ'])+'%)',22,AZUL2,True)
txt(s,7.15,4.9,5.4,0.35,'meta '+str(D['ms']['metaServ'])+' itens/dia/comprador',10,MUT)
txt(s,6.9,5.55,5.9,0.9,'Serviço é naturalmente mais lento e complexo que Material — nunca compare as classes contra uma meta única.',10,MUT)

# ---------- Slide 6 — Aging ----------
s = novo_slide(); titulo(s,'Aging — RCs em aberto','Metas distintas por tipo — Contrato e Spot têm prazos-alvo próprios')
bx = 0.55
for item in D['aging']['blocks']:
    nome, openN, avg, meta, farol = item
    card(s,bx,1.5,3.95,1.85)
    txt(s,bx+0.25,1.65,3.4,0.35,nome.upper(),11,MUT,True)
    txt(s,bx+0.25,2.0,3.4,0.85,str(avg)+'d',32,FAROL_TXT[farol],True)
    txt(s,bx+0.25,2.85,3.4,0.4,'meta ≤ '+str(meta)+'d · '+str(openN)+' RCs em aberto',10,MUT)
    dot(s,bx+3.5,1.7,FAROL[farol])
    bx += 4.15
grafico(s,XL_CHART_TYPE.COLUMN_CLUSTERED,0.55,3.6,8.3,3.5,D['aging']['faixaLabels'],[('RCs em aberto',D['aging']['faixaCounts'])],ponto_cores=D['aging']['faixaColors'])
card(s,9.1,3.9,3.65,2.7)
txt(s,9.35,4.15,3.1,0.35,'RCS CRÍTICAS',11,MUT,True)
txt(s,9.35,4.55,3.1,1.05,str(D['aging']['crit']),46,VERM if D['aging']['crit']>0 else VERDE,True)
txt(s,9.35,5.7,3.1,0.5,'ciclo aberto > 30 dias',11,MUT)
notas(s,D['leituras'].get('aging',''))

# ---------- Slide 7 — SLA ----------
s = novo_slide(); titulo(s,'SLA — aderência ao prazo','Indicador único — Contrato e Spot avaliados em conjunto · meta ≥ 90%')
grafico(s,XL_CHART_TYPE.LINE,0.55,1.6,8.6,5.3,D['sla']['weeks'],[('% dentro do SLA',D['sla']['weekly']),('Meta 90%',[90]*len(D['sla']['weeks']))],serie_cores=[AZUL2,VERDE],rotulos=False)
card(s,9.4,2.3,3.35,2.6)
txt(s,9.65,2.55,2.85,0.35,'% DENTRO DO SLA',11,MUT,True)
txt(s,9.65,2.95,2.85,1.1,D['sla']['pctTxt'],42,FAROL_TXT[D['sla']['farol']],True)
txt(s,9.65,4.1,2.85,0.7,D['sla']['baseTxt'],9,MUT)
dot(s,12.35,2.5,FAROL[D['sla']['farol']])
notas(s,D['leituras'].get('sla',''))

# ---------- Slide 8 — Saving ----------
s = novo_slide(); titulo(s,'Saving','Economia capturada sobre a 1ª proposta')
card(s,0.55,1.7,4.1,3.1)
txt(s,0.8,2.0,3.6,0.35,'SAVING TOTAL',11,MUT,True)
txt(s,0.8,2.4,3.6,1.15,D['sav']['totalTxt'],44,VERDE if D['sav']['pos'] else VERM,True)
txt(s,0.8,3.6,3.6,0.9,D['sav']['taxaTxt']+' de economia · '+str(D['sav']['itens'])+' itens com saving apurado',11,MUT)
grafico(s,XL_CHART_TYPE.COLUMN_CLUSTERED,5.0,1.6,7.8,5.3,D['sav']['weeks'],[('Saving (R$)',D['sav']['weekly'])],serie_cores=[VERDE],fmt='#,##0')
notas(s,D['leituras'].get('saving',''))

# ---------- Slide 9 — Contratualização ----------
s = novo_slide(); titulo(s,'Contratualização','Mix de entrada de RCs — Contrato × Spot · '+str(D['contr']['total'])+' RCs no recorte')
ch = grafico(s,XL_CHART_TYPE.DOUGHNUT,0.55,1.6,5.6,5.2,['Contrato','Spot','Outros'],[('RCs',[D['contr']['nCon'],D['contr']['nSpo'],D['contr']['nOut']])],ponto_cores=[AZUL,STEEL,CZB])
ch.has_legend = True; ch.legend.position = XL_LEGEND_POSITION.BOTTOM; ch.legend.include_in_layout = False
if D['contr']['cartNomes']:
    grafico(s,XL_CHART_TYPE.BAR_CLUSTERED,6.5,1.6,6.3,5.2,D['contr']['cartNomes'],[('RCs',D['contr']['cartVals'])],serie_cores=[STEEL])
notas(s,D['leituras'].get('contr',''))

# ---------- Slide 10 — Pontos críticos & recomendações ----------
s = novo_slide(); titulo(s,'Pontos críticos & recomendações','Apenas indicadores fora do limite ou em atenção no recorte')
card(s,0.55,1.5,6.05,5.5)
txt(s,0.8,1.7,5.5,0.35,'PONTOS DE ATENÇÃO',11,MUT,True)
tb = s.shapes.add_textbox(Inches(0.8),Inches(2.15),Inches(5.55),Inches(4.6))
tf = tb.text_frame; tf.word_wrap = True
if D['pontos']:
    for i, item in enumerate(D['pontos']):
        texto, farol = item
        p = tf.paragraphs[0] if i == 0 else tf.add_paragraph()
        r = p.add_run(); r.text = '● '; r.font.size = Pt(12); r.font.name = 'Verdana'; r.font.bold = True; r.font.color.rgb = C(FAROL[farol])
        r2 = p.add_run(); r2.text = texto; r2.font.size = Pt(12); r2.font.name = 'Verdana'; r2.font.color.rgb = C(TXTC)
        p.space_after = Pt(9)
else:
    p = tf.paragraphs[0]; r = p.add_run(); r.text = 'Todos os indicadores dentro da meta no recorte.'
    r.font.size = Pt(12); r.font.name = 'Verdana'; r.font.color.rgb = C(VERDE)
card(s,6.75,1.5,6.05,5.5)
txt(s,7.0,1.7,5.5,0.35,'RECOMENDAÇÕES',11,MUT,True)
tb = s.shapes.add_textbox(Inches(7.0),Inches(2.15),Inches(5.55),Inches(4.6))
tf = tb.text_frame; tf.word_wrap = True
for i, rec in enumerate(D['recs']):
    p = tf.paragraphs[0] if i == 0 else tf.add_paragraph()
    r = p.add_run(); r.text = '→ '; r.font.size = Pt(12); r.font.name = 'Verdana'; r.font.bold = True; r.font.color.rgb = C(AZUL)
    r2 = p.add_run(); r2.text = rec; r2.font.size = Pt(12); r2.font.name = 'Verdana'; r2.font.color.rgb = C(TXTC)
    p.space_after = Pt(9)

prs.save('Gestao_a_Vista_Compras_Ageis.pptx')
print('OK — Gestao_a_Vista_Compras_Ageis.pptx gerado com 10 slides.')
\`\`\``;
}
function copySlidesPrompt(){
 const ta=document.getElementById('slides-ta');ta.select();
 const done=()=>{const b=document.getElementById('slides-copy');b.textContent='✅ Copiado!';setTimeout(()=>{b.textContent='📋 Copiar prompt';},1800);};
 if(navigator.clipboard&&navigator.clipboard.writeText)navigator.clipboard.writeText(ta.value).then(done,()=>{document.execCommand('copy');done();});
 else{document.execCommand('copy');done();}
}
function openSlidesModal(){
 const p=buildSlidesPrompt();
 if(!p){alert('Os dados ainda estão carregando — tente novamente em instantes.');return;}
 document.getElementById('slides-ta').value=p;
 document.getElementById('slides-ov').classList.add('open');
}
(function(){
 const ov=document.createElement('div');ov.className='modal-ov';ov.id='slides-ov';
 ov.innerHTML=`<div class="modal">
  <h3>📋 Apresentação — código pronto para o Copilot</h3>
  <div class="ph">📋 Código Python com todos os números do recorte atual já embutidos. Cole no Copilot (ou outra IA que execute código) e peça para rodar — o .pptx sai idêntico, sem a IA inventar nada.</div>
  <textarea id="slides-ta" spellcheck="false"></textarea>
  <div class="modal-actions"><button class="btn" id="slides-copy">📋 Copiar prompt</button><button class="btn ghost" id="slides-close">Fechar</button></div>
 </div>`;
 document.body.appendChild(ov);
 document.getElementById('slides-copy').onclick=copySlidesPrompt;
 document.getElementById('slides-close').onclick=()=>ov.classList.remove('open');
 ov.addEventListener('click',e=>{if(e.target===ov)ov.classList.remove('open');});
 document.addEventListener('keydown',e=>{if(e.key==='Escape')ov.classList.remove('open');});
 document.getElementById('btn_slides').onclick=openSlidesModal;
})();
