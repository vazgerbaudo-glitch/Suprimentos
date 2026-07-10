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
 const faixas=A.faixaLabels.map((l,i)=>l+' dias: '+A.faixaCounts[i]+' RCs').join(' · ');
 const topCart=(K.top||[]).slice(0,5).map(x=>x.c+' ('+x.tot+' RCs)').join(' · ')||'—';
 return `Você é um especialista em apresentações executivas. Crie uma apresentação de slides do painel "Gestão à Vista — Compras Ágeis (Suprimentos)" com base nos dados abaixo.

## Contexto do recorte analisado
- Gerado em: ${new Date().toLocaleString('pt-BR')}
- Base de dados: ${baseInfo}
- Período: ${periodoLabel()}
- Tipo de compra: ${tipoLabel()}
- Comprador: ${STATE.comp==='GERAL'?'Geral (todos os compradores)':STATE.comp}

## 1. Visão Geral
${leitura('ins-overview')}

## 2. Produtividade & Velocidade
- Atingimento da meta ponderada: ${P.ating.toFixed(0)}% (referência: 100%, mínimo 80%)
- Ritmo médio: ${P.val.toFixed(2)} ${P.ger?'itens/dia/comprador':'itens/dia'}
- Itens concluídos no recorte: ${P.concluidos}
- Metas por classe: Material ${STATE.metaMat} itens/dia · Serviço ${STATE.metaServ} itens/dia
- Leitura do painel: ${leitura('ins-prod')}

## 3. Aging (RCs em aberto)
- RCs em aberto: ${A.open} · aging médio: ${A.avg} dias (meta ≤ ${A.meta} dias)
- RCs críticas (>30 dias): ${A.crit}
- Distribuição por faixa: ${faixas}
- Leitura do painel: ${leitura('ins-aging')}

## 4. SLA (aderência ao prazo)
- % dentro do SLA: ${S.pct.toFixed(1)}% (meta ≥ 90%)
- Base avaliada: ${S.tot} RCs · fora do SLA: ${S.fora} · atraso médio: ${S.atrMed} dias
- Leitura do painel: ${leitura('ins-sla')}

## 5. Saving
- Saving total capturado: ${BRL(V.total)} · taxa de economia: ${V.taxa.toFixed(1)}% sobre a 1ª proposta
- Itens com saving apurado: ${V.itens}
- Leitura do painel: ${leitura('ins-saving')}

## 6. Contratualização (mix Contrato × Spot)
- Contrato: ${K.nCon} RCs (${K.pctCon.toFixed(0)}%) · Spot: ${K.nSpo} RCs (${K.pctSpo.toFixed(0)}%) · Outros: ${K.nOut} · total: ${K.total}
- Top carteiras por volume: ${topCart}
- Leitura do painel: ${leitura('ins-contr')}

## Instruções para os slides
1. Estruture: capa (título + período do recorte), agenda, 1 slide de visão geral com os KPIs principais, 1 slide por módulo (Produtividade, Aging, SLA, Saving, Contratualização) e 1 slide final de conclusões com plano de ação sugerido.
2. Em cada slide, destaque o status vs. meta com semáforo (verde = na meta, amarelo = atenção, vermelho = crítico).
3. Use linguagem executiva, direta e em português do Brasil; números formatados no padrão pt-BR.
4. Sugira um gráfico apropriado para cada slide (barras, linha, rosca etc.) a partir dos dados fornecidos.
5. Feche com 3 a 5 recomendações práticas baseadas nos pontos fora da meta.`;
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
  <div class="ph">Resumo do recorte atual (filtros, KPIs e leituras de todas as abas). Copie e cole em uma IA (Claude, ChatGPT, Copilot, Gamma…) para gerar a apresentação.</div>
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
