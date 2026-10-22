/* Painel 2.0 — tela Operação: manual da semana, leituras, tempos de atendimento, semana a semana, previsão, compras da semana, mapa de calor */
(function(){
const R=v=>(+(v??0)).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
const N=v=>(+(v??0)).toLocaleString('pt-BR');
const esc=t=>String(t??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;');
const css=n=>getComputedStyle(document.documentElement).getPropertyValue(n).trim();
const ativoAgora=()=>!!document.getElementById('o-sem');
const DIAS=['Domingo','Segunda','Terça','Quarta','Quinta','Sexta','Sábado'],DC=['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];
let el=null,ligado=false,charts={},dados=null,timer=null,st={periodo:'60'};

function carregarChart(){if(window.Chart)return Promise.resolve();return new Promise((ok,err)=>{const s=document.createElement('script');s.src='https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js';s.onload=ok;s.onerror=err;document.head.appendChild(s)})}
function desenhar(id,cfg){const c=document.getElementById(id);if(!c)return;if(charts[id])charts[id].destroy();charts[id]=new Chart(c,cfg)}
const qBase=()=>{const f=window.V2.filtros;return `marca=${encodeURIComponent(f.marca)}&unidade=${encodeURIComponent(f.unidade)}`};
const calor=(v,max)=>`color-mix(in srgb, var(--brasa) ${Math.round(100*(max?Math.min(v/max,1):0))}%, var(--surface-2))`;
const tip=t=>`<span class="info2" title="${esc(t)}">?</span>`;

function esqueleto(){
  el.innerHTML=`<div class="g">
  <div class="card s12 ctrl-per"><div class="filters"><span class="lbl">Período</span><select id="o-per" aria-label="Período">${[['semana_atual','Semana atual'],['mes_atual','Este mês'],['mes_passado','Mês passado'],['30','Últimos 30 dias'],['60','Últimos 60 dias'],['90','Últimos 90 dias']].map(([v,l])=>`<option value="${v}"${v===st.periodo?' selected':''}>${l}</option>`).join('')}</select></div></div>
  <div class="sec" id="manual">Escala e leituras</div>
  <div class="card s7" id="o-sem"><h3>Manual da semana ${tip('Pedidos/dia: média de pedidos por dia daquele dia da semana no período. Pico começa: primeira hora em que o movimento atinge 60% da hora mais forte do dia — é quando a equipe precisa estar pronta. Hora mais quente: a hora com mais pedidos.')}</h3><p class="hint">Recalculado com a demanda do período — sua escala baseada em dados</p><div class="tw" id="o-tsem"></div></div>
  <div class="card s5"><h3>Leituras da MIA 🤖 ${tip('Conclusões geradas dos números do período: dia mais forte e mais fraco, diferença de ticket e diagnóstico de gargalo. Mudam sozinhas conforme a demanda muda.')}</h3><p class="hint">Insights gerados dos números do período</p><div id="o-ins" style="display:grid;gap:10px"></div></div>
  <div class="sec" id="tempos">Tempo de atendimento</div>
  <div class="card s5"><h3>Tempo de atendimento por canal ⏱️ ${tip('Tempo entre o pedido entrar e ser concluído no portal. Mediana: o tempo típico. P90: 9 em cada 10 pedidos saem em até esse tempo — o número certo pra prometer prazo ao cliente. Só entram pedidos concluídos com tempo entre 1 e 180 min.')}</h3><p class="hint" id="o-dcanal">Mediana criado → concluído</p><div class="area" style="height:210px;min-height:0"><canvas id="gCanal"></canvas></div></div>
  <div class="card s7"><h3>Tempo de atendimento por horário ${tip('Mediana do tempo de atendimento em cada hora. Horários com menos de 5 pedidos ficam de fora. Linha subindo junto com o pico = cozinha saturando.')}</h3><p class="hint">Se a linha sobe junto com o pico, o gargalo é capacidade de cozinha</p><div class="area" style="height:210px;min-height:0"><canvas id="gHora"></canvas></div></div>
  <div class="sec" id="semanas">Tendência e previsão</div>
  <div class="card s12"><h3>Comparativo semana a semana ${tip('Pedidos por semana nas últimas 12 semanas. O resumo compara esta semana com o MESMO ponto da semana passada. Ignora o filtro de período de propósito: é o termômetro fixo de tendência.')}</h3><p class="hint" id="o-dsem">Pedidos por semana nas últimas 12 semanas</p><div class="area" style="height:230px;min-height:0"><canvas id="gSem"></canvas></div></div>
  <div class="card s12"><h3>Previsão dos próximos 7 dias 🔮 ${tip('Mediana de pedidos e faturamento das últimas 8 semanas daquele dia da semana, ajustada pela tendência recente. A faixa embaixo é o intervalo típico (semana fraca–forte).')}</h3><p class="hint" id="o-dprev">Base pra compras e escala da semana</p><div class="prev" id="o-prev"></div></div>
  <div class="sec" id="compras">Compras da semana</div>
  <div class="card s12"><h3>Lista de compras da semana 🛒 ${tip("Necessidade de cada insumo pros próximos 7 dias: venda média semanal de cada produto (últimas 4 semanas × tendência) explodida pela ficha técnica. A coluna 'com folga' adiciona 15% de segurança.")}</h3><p class="hint" id="o-dcomp">Do padrão de vendas direto pro fornecedor</p><div class="tw" id="o-comp"></div>
   <p class="hint" style="margin:10px 0 0">Pra pedir de verdade, use <a href="#compras" data-go="compras" style="color:var(--brasa-ink);font-weight:600">Compras e estoque</a>, que já desconta o estoque atual.</p></div>
  <div class="sec" id="calor">Mapa de calor</div>
  <div class="card s12"><h3>Mapa de calor — dia × hora ${tip('Total de pedidos em cada combinação de dia da semana e hora, no período. Do claro (parado) à brasa (lotado), na mesma escala pra grade toda.')}</h3><p class="hint">Cada célula é uma combinação dia/horário. Sua escala de equipe desenhada.</p><div class="heat" id="o-heat"></div></div>
  <p class="hint s12" id="o-atual" style="margin:0"></p></div>`;
  window.V2.setJump([['manual','Escala'],['tempos','Tempos'],['semanas','Tendência'],['compras','Compras'],['calor','Mapa de calor']]);
}

function pintar(){
  const d=dados;if(!d||!document.getElementById('o-sem'))return;
  Chart.defaults.color=css('--ink-2');Chart.defaults.borderColor=css('--line');Chart.defaults.font.family='Figtree, system-ui, sans-serif';
  const brasa=css('--brasa'),sob=css('--c-sob'),ordem=[1,2,3,4,5,6,0],por=Object.fromEntries(d.dias_semana.map(x=>[x.dow,x])),meds=d.dias_semana.map(x=>+x.media),mx=Math.max(...meds),mn=Math.min(...meds);
  document.getElementById('o-tsem').innerHTML=`<table><thead><tr><th>Dia</th><th class="r">Pedidos/dia</th><th class="r">Pico começa</th><th class="r">Hora mais quente</th><th class="r">Ticket</th></tr></thead><tbody>${ordem.map(dw=>{const x=por[dw];if(!x)return '';
    return `<tr><td><strong class="${+x.media===mx?'up':''}">${DIAS[dw]}${+x.media===mx?' 🥇':''}${+x.media===mn?' 📉':''}</strong></td><td class="r">${x.media}</td><td class="r">${x.pico_inicio}h</td><td class="r">${x.hora_pico}h</td><td class="r">${R(x.ticket)}</td></tr>`}).join('')}</tbody></table>`;
  const forte=d.dias_semana.reduce((a,b)=>+a.media>=+b.media?a:b),fraco=d.dias_semana.reduce((a,b)=>+a.media<=+b.media?a:b),fds=d.grupos.find(g=>g.grupo==='fds'),meio=d.grupos.find(g=>g.grupo==='meio'),ins=[];
  ins.push(['🥇',`<strong>${DIAS[forte.dow]}</strong> é seu dia mais forte (${forte.media} pedidos/dia), com pico já às <strong>${forte.pico_inicio}h</strong> — equipe 100% pronta com antecedência: chapa quente, praça montada, insumo porcionado.`]);
  ins.push(['📉',`<strong>${DIAS[fraco.dow]}</strong> é o vale (${fraco.media}/dia — ${Math.round(100*fraco.media/forte.media)}% do dia forte). Candidato natural a promoção de recorrência; meça o efeito com a comparação de datas.`]);
  if(fds&&meio){const dt=100*(fds.ticket-meio.ticket)/meio.ticket;
    if(Math.abs(dt)>=3)ins.push(['💳',dt>0?`Ticket do fim de semana é <strong>${dt.toFixed(0)}% maior</strong> (${R(fds.ticket)} vs ${R(meio.ticket)}): cliente vem disposto — hora de sugerir combo maior, adicional e sobremesa.`:`Ticket do meio de semana está <strong>${Math.abs(dt).toFixed(0)}% maior</strong> que o do fim de semana — padrão invertido, vale investigar o mix.`]);
    ins.push(['📦',`Volume: fim de semana faz <strong>${fds.pedidos_dia}/dia</strong> vs ${meio.pedidos_dia} no meio — use as médias pra dimensionar compra de insumo por dia da semana.`])}
  const mp=Math.min(...d.dias_semana.map(y=>+y.pico_inicio)),cedo=d.dias_semana.filter(x=>x.pico_inicio<=mp);
  ins.push(['⏰',`Pico mais cedo: <strong>${cedo.map(x=>DIAS[x.dow]).join(' e ')}</strong> (${cedo[0].pico_inicio}h) — nesses dias, escala completa desde a abertura.`]);
  if(d.tempos_hora.length>=3){const mv=Math.max(...d.tempos_hora.map(x=>+x.pedidos)),pico=d.tempos_hora.filter(x=>+x.pedidos>=.6*mv),fora=d.tempos_hora.filter(x=>+x.pedidos<.6*mv);
    const med=a=>a.reduce((s,x)=>s+(+x.mediana)*(+x.pedidos),0)/Math.max(a.reduce((s,x)=>s+(+x.pedidos),0),1);
    if(pico.length&&fora.length){const tp=med(pico),tf=med(fora),dp=100*(tp-tf)/tf;
      ins.push(['🍳',dp>=15?`Gargalo confirmado: no pico o atendimento leva <strong>${tp.toFixed(0)} min</strong> vs ${tf.toFixed(0)} min fora dele (<strong>+${dp.toFixed(0)}%</strong>) — a cozinha satura no volume. Reforço de equipe ou pré-preparo no pico.`:`Cozinha aguenta o tranco: tempo no pico (${tp.toFixed(0)} min) fica próximo do fora de pico (${tf.toFixed(0)} min) — capacidade bem dimensionada.`])}}
  document.getElementById('o-ins').innerHTML=ins.map(i=>`<div class="ins"><span>${i[0]}</span><span>${i[1]}</span></div>`).join('');
  const NT={delivery:'Delivery',takeout:'Balcão/Retirada',onsite:'No local',closed_table:'Mesa'},cob=d.cobertura,pc=cob.total>0?Math.round(100*cob.mediveis/cob.total):0;
  document.getElementById('o-dcanal').innerHTML=`Mediana criado → concluído · baseado em <strong style="color:var(--ink)">${pc}%</strong> dos pedidos`+(pc<70?' — <span class="down">equipe concluindo os pedidos no portal, esse número sobe e a métrica fica fiel</span>':'');
  desenhar('gCanal',{type:'bar',data:{labels:d.tempos_canal.map(x=>NT[x.tipo]??x.tipo),datasets:[{data:d.tempos_canal.map(x=>+x.mediana),backgroundColor:brasa,borderRadius:4}]},options:{indexAxis:'y',maintainAspectRatio:false,plugins:{legend:{display:false},tooltip:{callbacks:{label:c=>`mediana: ${c.parsed.x} min`,afterLabel:c=>`P90: ${d.tempos_canal[c.dataIndex].p90} min · ${N(d.tempos_canal[c.dataIndex].pedidos)} pedidos`}}},scales:{x:{title:{display:true,text:'minutos'}}}}});
  desenhar('gHora',{type:'line',data:{labels:d.tempos_hora.map(x=>x.hora+'h'),datasets:[{data:d.tempos_hora.map(x=>+x.mediana),fill:true,borderColor:brasa,backgroundColor:brasa+'22',tension:.3,pointRadius:3,borderWidth:2}]},options:{maintainAspectRatio:false,plugins:{legend:{display:false},tooltip:{callbacks:{label:c=>`mediana: ${c.parsed.y} min`,afterLabel:c=>`${N(d.tempos_hora[c.dataIndex].pedidos)} pedidos nesse horário`}}},scales:{y:{title:{display:true,text:'minutos'}}}}});
  desenhar('gSem',{type:'bar',data:{labels:d.semanas.map((x,i)=>i===d.semanas.length-1?`${x.semana} (atual)`:x.semana),datasets:[{data:d.semanas.map(x=>+x.pedidos),backgroundColor:d.semanas.map((_,i)=>i===d.semanas.length-1?sob:brasa),borderRadius:4}]},options:{maintainAspectRatio:false,plugins:{legend:{display:false},tooltip:{callbacks:{label:c=>`${N(c.parsed.y)} pedidos`,afterLabel:c=>`Faturamento: ${R(+d.semanas[c.dataIndex].faturamento)}`}}},scales:{y:{ticks:{precision:0}}}}});
  const sv=d.semana_vs;
  if(+sv.anterior>0){const p=100*(sv.atual-sv.anterior)/sv.anterior;document.getElementById('o-dsem').innerHTML=`Esta semana até agora: <strong style="color:var(--ink)">${N(sv.atual)} pedidos</strong> (${R(+sv.fat_atual)}) <span class="${p>=0?'up':'down'}">${p>=0?'▲':'▼'} ${Math.abs(p).toFixed(0)}%</span> vs o mesmo ponto da semana passada (${N(sv.anterior)} pedidos, ${R(+sv.fat_anterior)}) — comparação justa, mesmo dia e hora`}
  const hm={};d.heatmap.forEach(x=>hm[`${x.dow}-${x.hora}`]=+x.pedidos);
  const hs=[...new Set(d.heatmap.map(x=>+x.hora))].sort((a,b)=>a-b),hi=Math.max(Math.min(...hs)-1,0),hf=Math.min(Math.max(...hs)+1,23),horas=[];for(let h=hi;h<=hf;h++)horas.push(h);
  const mc=Math.max(...Object.values(hm),1),box=document.getElementById('o-heat');box.style.gridTemplateColumns=`44px repeat(${horas.length},minmax(22px,1fr))`;
  box.innerHTML='<div></div>'+horas.map(h=>`<div class="hl">${h}h</div>`).join('')+ordem.map(dw=>`<div class="hd">${DC[dw]}</div>`+horas.map(h=>{const v=hm[`${dw}-${h}`]??0;return `<div class="cel" style="background:${calor(v,mc)}" title="${DC[dw]} ${h}h — ${N(v)} pedidos"></div>`}).join('')).join('');
  {const soma=horas.map(h=>ordem.reduce((a,dw)=>a+(hm[`${dw}-${h}`]??0),0)),ip=soma.indexOf(Math.max(...soma));requestAnimationFrame(()=>{const c=box.querySelector('.hl');if(c&&box.scrollWidth>box.clientWidth)box.scrollLeft=Math.max(0,(ip-1)*(c.offsetWidth+3))})}
  document.getElementById('o-atual').innerHTML='<span class="dot" style="display:inline-block;margin-right:6px"></span>Atualizado às '+new Date().toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})+' · recalculado conforme o período selecionado';
}
async function carregar(){
  if(!ativoAgora())return;
  fetch(`/api/previsao?${qBase()}`).then(r=>r.json()).then(pv=>{if(!document.getElementById('o-prev'))return;const t=100*(pv.fator_tendencia-1);
    document.getElementById('o-dprev').innerHTML=`Semana prevista: <strong style="color:var(--ink)">${N(pv.total_pedidos)} pedidos</strong> · <strong style="color:var(--ink)">${R(pv.total_faturamento)}</strong> · tendência das últimas 4 semanas: <span class="${t>=0?'up':'down'}">${t>=0?'▲':'▼'} ${Math.abs(t).toFixed(0)}%</span>`;
    document.getElementById('o-prev').innerHTML=pv.dias.map(x=>{const dt=new Date(x.data+'T12:00:00');return `<div class="pd ${[0,5,6].includes(x.dow)?'fds':''}"><div class="mut">${DC[x.dow]} ${String(dt.getDate()).padStart(2,'0')}/${String(dt.getMonth()+1).padStart(2,'0')}</div><b>~${N(x.pedidos)}</b><div>${R(x.faturamento)}</div><small class="mut">${N(x.pedidos_min)}–${N(x.pedidos_max)} pedidos</small></div>`}).join('')}).catch(()=>{});
  fetch(`/api/compras?${qBase()}`).then(r=>r.json()).then(lc=>{if(!document.getElementById('o-comp'))return;
    const fq=(v,u)=>u==='kg'?(+v).toLocaleString('pt-BR',{maximumFractionDigits:1})+' kg':Math.ceil(+v).toLocaleString('pt-BR')+' un';
    document.getElementById('o-comp').innerHTML=`<table><thead><tr><th>Insumo</th><th class="r">Necessidade (7 dias)</th><th class="r">Com folga de 15%</th></tr></thead><tbody>${lc.insumos.map(x=>`<tr><td>${esc(x.insumo)}</td><td class="r">${fq(x.necessidade,x.unidade)}</td><td class="r"><strong class="down">${fq(x.necessidade*1.15,x.unidade)}</strong></td></tr>`).join('')||'<tr><td colspan="3" class="mut">Sem fichas técnicas cadastradas ainda</td></tr>'}</tbody></table>`;
    document.getElementById('o-dcomp').innerHTML=`Cobre <strong style="color:var(--ink)">${lc.cobertura_pct.toFixed(0)}%</strong> das unidades vendidas${lc.sem_ficha?` · sem ficha: ${esc(lc.sem_ficha)}`:''}`}).catch(()=>{});
  try{dados=await fetch(`/api/operacao?${qBase()}&periodo=${st.periodo}`).then(r=>r.json());pintar()}
  catch(e){document.getElementById('o-tsem').innerHTML='<p class="hint">Não foi possível carregar.</p>'}
}
function ligar(){
  document.addEventListener('change',e=>{if(ativoAgora()&&e.target.id==='o-per'){st.periodo=e.target.value;carregar()}});
  window.addEventListener('v2tema',()=>{if(ativoAgora()&&dados)pintar()});
}
window.V2.screens.operacao={render(c){el=c;if(!ligado){ligar();ligado=true}clearInterval(timer);esqueleto();carregarChart().then(carregar).catch(()=>{});timer=setInterval(()=>{if(ativoAgora())carregar();else clearInterval(timer)},10*60*1000)},onFiltros(){carregar()}};
})();
