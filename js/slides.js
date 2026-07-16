function periodoLabel(){
 if(STATE.modo==='mes')return 'Mês de '+mLabel(STATE.mes);
 if(STATE.modo==='atual')return 'Semana atual (início '+wkLabelFull(isoWeek(HOJE))+')';
 if(STATE.modo==='semana')return 'Semana de '+wkLabelFull(STATE.sem);
 return 'Geral (2026)';
}
function tipoLabel(){return STATE.tp==='GERAL'?'Geral (todos os tipos)':STATE.tp==='CS'?'Contrato e Spot':STATE.tp;}
function leitura(id){const el=document.getElementById(id);return el?el.textContent.replace(/^Leitura:\s*/,'').trim():'';}
function buildSlidesPrompt(){
 const P=SUM.prod,A=SUM.aging,S=SUM.sla,V=SUM.saving,K=SUM.contr;
 if(!P||!A||!S||!V||!K)return null;
 const baseInfo=(document.getElementById('srcdot').title||'Base não identificada');
 const faixas=A.faixaLabels.map((l,i)=>A.faixaLabels[i]+' dias: '+A.faixaCounts[i]+' RCs (cor '+A.faixaColors[i]+')').join(' · ');
 const topCart=(K.top||[]).slice(0,6).map(x=>x.c+': '+x.tot+' RCs').join(' · ')||'—';
 const serie=(ws,vs,fmt)=>ws&&ws.length?ws.map((w,i)=>w+': '+(fmt?fmt(vs[i]):vs[i])).join(' · '):'sem série no recorte';
 // Comparativo por comprador — semana anterior → semana atual (equipe toda, independe do filtro de comprador)
 const wCur=isoWeek(HOJE),wPrev=isoWeek(new Date(HOJE.getTime()-7*86400000));
 const bwC={};ALL.forEach(r=>{if(r.st!=='C'||!r.dc||r.dc<DATA_INI||!tpHit(r))return;const w=isoWeek(r.dc);if(w!==wCur&&w!==wPrev)return;const o=bwC[r.cp]=bwC[r.cp]||{p:0,c:0};if(w===wPrev)o.p++;else o.c++;});
 const wkRows=Object.entries(bwC).map(([cp,o])=>({cp,p:o.p,c:o.c})).sort((a,b)=>(b.p+b.c)-(a.p+a.c));
 const wkTable=wkRows.length?wkRows.map(r=>r.cp+': '+r.p+' → '+r.c).join(' · '):'sem conclusões nas duas semanas';
 // Concluídos por comprador no recorte (top 10)
 const pcb=ALL.filter(r=>r.st==='C'&&r.dc&&r.dc>=DATA_INI&&periodHit(r.dc)&&tpHit(r));
 const pc={};pcb.forEach(r=>{pc[r.cp]=(pc[r.cp]||0)+1;});
 const topComp=Object.entries(pc).sort((a,b)=>b[1]-a[1]).slice(0,10).map(x=>x[0]+': '+x[1]+' itens').join(' · ')||'—';
 // Material × Serviço concluídos no recorte
 const msB=pcb.filter(r=>compHit(r));
 const nMat=msB.filter(r=>r.cl==='Material').length,nServ=msB.filter(r=>r.cl==='Serviço').length,totMS=nMat+nServ;
 const pMat=totMS?Math.round(nMat/totMS*100):0,pServ=totMS?100-pMat:0;
 return `Você é um designer de apresentações executivas especialista em visualização de dados corporativos. Crie uma apresentação de EXATAMENTE 10 slides do painel "Gestão à Vista — Compras Ágeis (Suprimentos)" da Rumo Logística.

REGRAS INEGOCIÁVEIS (leia antes de tudo):
1. Use SOMENTE os números da seção DADOS. Não invente, não recalcule, não extrapole, não crie dados de exemplo.
2. Cada slide é VISUAL: o gráfico ou o número grande ocupa no mínimo 60% da área. Texto corrido é proibido — apenas título, rótulos e 1 linha de leitura por slide.
3. Siga a ESTRUTURA DOS 10 SLIDES exatamente como especificada, inclusive o tipo de gráfico de cada slide. Não substitua tipos de gráfico.
4. Siga a IDENTIDADE VISUAL RUMO à risca e rode o checklist final antes de entregar.

# CONTEXTO DO RECORTE
- Gerado em: ${new Date().toLocaleString('pt-BR')}
- Base de dados: ${baseInfo}
- Período: ${periodoLabel()}
- Tipo de compra: ${tipoLabel()}
- Comprador: ${STATE.comp==='GERAL'?'Geral (todos os compradores)':STATE.comp}

# DADOS (fonte única da verdade)

## Produtividade & Velocidade
- Atingimento da meta ponderada: ${P.ating.toFixed(0)}% — meta 100%, mínimo aceitável 80%. Status: ${P.ating>=100?'NA META (verde)':P.ating>=80?'ATENÇÃO (amarelo)':'CRÍTICO (vermelho)'}
- Ritmo médio: ${P.val.toFixed(2)} ${P.ger?'itens/dia/comprador':'itens/dia'}
- Itens concluídos no recorte: ${P.concluidos}
- Série semanal de itens concluídos (equipe): ${serie(P.weeks,P.weekly)}
- Concluídos por comprador no recorte (top 10): ${topComp}
- Comparativo individual — semana anterior (início ${wkLabelFull(wPrev)}) → semana atual (início ${wkLabelFull(wCur)}, parcial): ${wkTable}

## Material × Serviço (classes com METAS DIFERENTES — nunca compare contra uma meta única)
- Material: ${nMat} itens concluídos (${pMat}%) — meta ${STATE.metaMat} itens/dia/comprador
- Serviço: ${nServ} itens concluídos (${pServ}%) — meta ${STATE.metaServ} itens/dia/comprador
- Serviço é naturalmente mais lento e complexo que Material; o atingimento ponderado acima já considera o mix real.

## Aging — RCs em aberto (METAS DIFERENTES por tipo — cada tipo tem a própria régua)
- Geral: ${A.open} RCs em aberto · aging médio ${A.avg}d · meta ≤ ${A.meta}d · ${A.gpct<=0?'DENTRO da meta (verde)':'ACIMA da meta em '+A.gpct.toFixed(0)+'% (vermelho)'}
- Contrato: ${A.con.open} RCs em aberto · aging médio ${A.con.avg}d · meta ≤ ${A.con.meta}d (ciclo de contrato é naturalmente mais longo) · ${A.con.pct<=0?'DENTRO da meta (verde)':'ACIMA da meta em '+A.con.pct.toFixed(0)+'% (vermelho)'}
- Spot: ${A.spo.open} RCs em aberto · aging médio ${A.spo.avg}d · meta ≤ ${A.spo.meta}d · ${A.spo.pct<=0?'DENTRO da meta (verde)':'ACIMA da meta em '+A.spo.pct.toFixed(0)+'% (vermelho)'}
- RCs críticas (>30 dias em aberto): ${A.crit}
- Distribuição por faixa (use EXATAMENTE estas cores nas barras): ${faixas}
- REGRA: jamais avalie Contrato pela meta de Spot ou vice-versa — são processos com prazos-alvo distintos.

## SLA — aderência ao prazo (indicador ÚNICO: Contrato + Spot avaliados em conjunto)
- % dentro do SLA: ${S.pct.toFixed(1)}% — meta ≥ 90%. Status: ${S.pct>=90?'NA META (verde)':S.pct>=80?'ATENÇÃO (amarelo)':'CRÍTICO (vermelho)'}
- Base avaliada: ${S.tot} RCs · fora do SLA: ${S.fora} · atraso médio quando fura: ${S.atrMed} dias
- Série semanal do % dentro do SLA: ${serie(S.weeks,S.weekly,v=>v+'%')}
- REGRA: diferente do Aging, o SLA NÃO abre por tipo — é um único número contra a meta de 90%.

## Saving
- Saving total capturado: ${BRL(V.total)} · taxa de economia: ${V.taxa.toFixed(1)}% sobre a 1ª proposta
- Itens com saving apurado: ${V.itens}
- Série semanal de saving (R$): ${serie(V.weeks,V.weekly,v=>BRL(v))}

## Contratualização (mix de ENTRADA de RCs — Contrato × Spot)
- Contrato: ${K.nCon} RCs (${K.pctCon.toFixed(0)}%) · Spot: ${K.nSpo} RCs (${K.pctSpo.toFixed(0)}%) · Outros tipos: ${K.nOut} · total: ${K.total}
- Top carteiras por volume: ${topCart}

## Leituras do painel (use como notas do apresentador, NÃO como texto no slide)
- Visão geral: ${leitura('ins-overview')}
- Produtividade: ${leitura('ins-prod')}
- Aging: ${leitura('ins-aging')}
- SLA: ${leitura('ins-sla')}
- Saving: ${leitura('ins-saving')}
- Contratualização: ${leitura('ins-contr')}

# ESTRUTURA DOS 10 SLIDES (1 conceito por slide; tipo de gráfico é obrigatório)
1. CAPA — título "Gestão à Vista — Compras Ágeis", subtítulo com período e data. Fundo branco ou #F2F5F6, faixa/chanfro azul #003865. Sem dados.
2. SCORECARD EXECUTIVO — grade de 6 cards de KPI: Atingimento da meta, Aging médio geral, % SLA, Saving total, RCs críticas, Mix Contrato/Spot. Cada card: rótulo pequeno, valor GRANDE (mín. 60pt), meta ao lado e farol de status (verde/amarelo/vermelho conforme os status informados em DADOS). Sem gráfico, sem bullets.
3. PRODUTIVIDADE DA EQUIPE — meio-círculo (gauge) ou número gigante com o atingimento de ${P.ating.toFixed(0)}% vs meta 100% + gráfico de BARRAS VERTICAIS da série semanal de itens concluídos, com o valor rotulado sobre cada barra e a semana no eixo.
4. PRODUTIVIDADE POR COMPRADOR — gráfico de BARRAS HORIZONTAIS AGRUPADAS (2 barras por pessoa): semana anterior × semana atual, usando o comparativo individual dos DADOS, ordenado do maior para o menor, valor rotulado na ponta de cada barra. Semana anterior em cinza #CAD6DD, semana atual em azul #003865. Deixe claro no subtítulo que a semana atual é parcial.
5. MATERIAL × SERVIÇO — ROSCA (donut) com o mix ${pMat}% Material / ${pServ}% Serviço (Material #5A8CAE, Serviço #0E538C) + dois cards lado a lado deixando as metas distintas explícitas: "Material: meta ${STATE.metaMat} itens/dia" e "Serviço: meta ${STATE.metaServ} itens/dia". Uma linha explicando que são réguas diferentes.
6. AGING — 3 blocos horizontais (Geral / Contrato / Spot), cada um com o aging médio GRANDE, a SUA meta ao lado (≤${A.meta}d / ≤${A.con.meta}d / ≤${A.spo.meta}d) e farol individual + gráfico de BARRAS VERTICAIS da distribuição por faixa com as cores exatas informadas. Subtítulo obrigatório: "Metas distintas por tipo — Contrato e Spot têm prazos-alvo próprios".
7. SLA — gráfico de LINHA da série semanal do % dentro do SLA com linha tracejada horizontal na meta de 90%, + o número atual GRANDE (${S.pct.toFixed(1)}%) com farol. Pontos abaixo de 90% podem ser marcados em vermelho; acima, em verde. Subtítulo obrigatório: "Indicador único — Contrato e Spot avaliados em conjunto".
8. SAVING — número gigante ${BRL(V.total)} (${V.taxa.toFixed(1)}% de economia) em verde #1E9F7F + gráfico de BARRAS VERTICAIS do saving semanal em R$ com valores rotulados abreviados (ex.: 1,2M, 350k).
9. CONTRATUALIZAÇÃO — ROSCA do mix Contrato (#003865) × Spot (#5A8CAE) × Outros (#CAD6DD) com % rotulados + BARRAS HORIZONTAIS das top carteiras por volume, valor na ponta.
10. PONTOS CRÍTICOS & RECOMENDAÇÕES — liste APENAS o que está com status vermelho/amarelo nos DADOS, cada item com o número que comprova; vermelho somente nos itens realmente críticos. Feche com 3 a 5 recomendações práticas de 1 linha, ligadas a esses pontos.

# IDENTIDADE VISUAL RUMO — INEGOCIÁVEL
Paleta (use SOMENTE estes hex):
| Uso | Cor |
|---|---|
| Azul institucional — títulos, estrutura, barras principais | #003865 |
| Azul de dados secundário | #0E538C |
| Azul acinzentado de apoio (séries secundárias) | #5A8CAE |
| Verde — positivo / dentro da meta | #1E9F7F (apoio claro #7FE06C) |
| Amarelo — atenção PONTUAL | #FBD300 (tom escuro p/ texto: #C79100) |
| Vermelho — SOMENTE criticidade real | #D2373C |
| Cinzas de fundo/divisórias | #F2F5F6, #E5EBEE, #D7E0E5, #CAD6DD |
| Texto principal | #13303F ou #003865 |

Regras:
- Fonte: Verdana (font-family: Verdana, sans-serif) em tudo — pesos 400 e 700 apenas.
- Fundo dos slides sempre claro (branco ou #F2F5F6). Nunca fundo escuro, nunca gradiente.
- PROIBIDO laranja e roxo em qualquer elemento (laranja se confunde com o vermelho de criticidade; roxo é associado à concorrente Raízen).
- Vermelho #D2373C EXCLUSIVAMENTE para indicador estourado / RC crítica / fora do SLA. Nunca como decoração, destaque neutro ou cor de série comum.
- Amarelo #FBD300 no máximo ~10% da área do slide: um selo, um número, um farol. Nunca fundo, faixa larga ou série inteira de gráfico.
- Chanfro Rumo (corte de 45° num canto): apenas na capa e no slide 10. Nunca em todos os elementos.
- Números em formato pt-BR (1.234,5 · R$ 1,2M) com dígitos tabulares; KPIs sempre maiores que o texto ao redor.

# REGRAS DE DATAVIZ
- Todo gráfico com valores rotulados diretamente nas barras/pontos; sem gridlines pesadas, sem 3D, sem sombra, sem legenda redundante quando o rótulo já identifica a série.
- Barras com cantos levemente arredondados; máx. 3 cores de dados por gráfico (+ farol quando aplicável).
- Eixos com o mínimo de tinta: sem bordas de caixa, ticks discretos, fonte pequena #46606F.
- Todo KPI acompanhado da meta e do farol — nunca um número solto sem referência.

# CHECKLIST FINAL (verifique slide a slide antes de entregar; corrija o que falhar)
[ ] São exatamente 10 slides na ordem definida, com os tipos de gráfico especificados?
[ ] Nenhum laranja, nenhum roxo, nenhum fundo escuro em nenhum slide?
[ ] Vermelho aparece apenas nos itens marcados como críticos nos DADOS?
[ ] Amarelo ocupa menos de 10% de cada slide?
[ ] Aging mostra as 3 metas distintas (Geral ≤${A.meta}d, Contrato ≤${A.con.meta}d, Spot ≤${A.spo.meta}d) e o SLA aparece como indicador único com meta 90%?
[ ] Material e Serviço aparecem com metas separadas (${STATE.metaMat} vs ${STATE.metaServ} itens/dia)?
[ ] Todos os números batem com a seção DADOS e estão em formato pt-BR?
[ ] Cada slide tem no máximo 1 linha de leitura além de título e rótulos?

# FORMATO DE SAÍDA
- Se a entrega for PowerPoint: gere .pptx via python-pptx (nunca converta de HTML), 16:9 (13,33 × 7,5 pol).
- Se a entrega for HTML: um único arquivo autocontido (CSS inline, sem CDN), 1 seção por slide em 16:9.
- Se a ferramenta gerar slides nativamente (Gamma, Canva, Copilot), aplique as mesmas regras acima.`;
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
  <h3>🎞 Prompt para criação de slides</h3>
  <div class="ph">Resumo do recorte atual (filtros, KPIs e leituras de todas as abas). Copie e cole em uma IA para gerar a apresentação.</div>
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
