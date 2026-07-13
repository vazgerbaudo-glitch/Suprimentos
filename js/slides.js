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
 return `Você é um especialista em apresentações executivas corporativas. Crie uma apresentação de slides do painel "Gestão à Vista — Compras Ágeis (Suprimentos)" com base nos dados abaixo, seguindo rigorosamente a identidade visual e as regras de design da Rumo Logística descritas ao final.

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

## Estrutura do deck (siga esta ordem)
1. Capa: título do painel + período do recorte + data de geração. Comece pela mensagem principal, não pelo dado bruto.
2. Agenda / sumário executivo: os 3 a 4 pontos que a diretoria precisa reter.
3. Visão geral: os KPIs principais lado a lado (atingimento de meta, SLA, aging médio, saving), cada um com seu status vs. meta.
4. Um slide por módulo, nesta ordem: Produtividade & Velocidade, Aging, SLA, Saving, Contratualização.
5. Slide de pontos críticos: o que está fora da meta e exige decisão.
6. Slide final de conclusões com 3 a 5 recomendações práticas ligadas aos pontos fora da meta.

## Identidade visual — Rumo Logística (obrigatória)
- Fonte: "Cera Pro" como primeira opção e Verdana como fallback obrigatório (ex.: font-family: 'Cera Pro', Verdana, sans-serif). Não presuma que Cera Pro está instalada.
- Cor base: azul institucional #003865 (títulos, textos principais, elementos estruturais, faixas de cabeçalho).
- Positivo / dentro da meta: verde #1E9F7F e verde-claro #7FE06C.
- Cinzas de apoio para fundos e divisórias: #F2F5F6, #E5EBEE, #D7E0E5, #CAD6DD. Fundo dos slides claro (branco ou #F2F5F6).
- Amarelo #FBD300: apenas destaque pontual (um número ou um selo de atenção), no máximo ~10% do slide. Nunca como fundo ou área grande.
- Vermelho: EXCLUSIVAMENTE para criticidade real (meta estourada, RC crítica, SLA fora do limite). No contexto do agronegócio o vermelho significa "problema" — nunca use como decoração, destaque neutro ou cor de apoio.
- NÃO use laranja nem roxo (laranja se confunde com o vermelho de criticidade; roxo é associado à Raízen).
- Grafismo de chanfro Rumo (corte de 45° em um canto): use como assinatura visual pontual, apenas na capa e/ou nas divisórias de seção, com parcimônia. Nunca aplique o chanfro em todos os elementos e não deixe que ele atrapalhe a leitura dos dados.

## Regras de design e narrativa
- Um conceito por slide. Título forte, subtítulo de apoio e no máximo 3 a 5 bullets curtos. Evite slide com excesso de texto.
- Margens generosas e respiro (inspirados no grid Rumo, ~10% de margem). Alinhamento consistente entre blocos.
- Status vs. meta: sinalize com verde (na meta), atenção pontual em amarelo e vermelho apenas quando realmente crítico — não transforme tudo em "semáforo" colorido.
- Números com destaque tipográfico (KPIs em tamanho maior) e formatação pt-BR. Em tabelas, alinhe os dígitos (tabular).
- Gráficos com propósito, escolhidos pelo tipo de dado:
  · Tendência ao longo do tempo → linha.
  · Comparação entre categorias, compradores ou carteiras → barras.
  · Composição / mix (ex.: Contrato × Spot) → rosca ou barra 100% empilhada.
  · Distribuição por faixa (ex.: aging) → barras ordenadas por faixa.
  Rotule os valores diretamente, evite 3D e evite excesso de cores no mesmo gráfico.
- Linguagem executiva, direta, em português do Brasil: comece pela conclusão e pelo impacto, depois mostre a evidência.

## Formato de saída
- Especifique se a entrega é PowerPoint (.pptx, via python-pptx) ou HTML (reveal.js) e gere de acordo. Se .pptx, gere via python-pptx — não converta HTML.`;
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
