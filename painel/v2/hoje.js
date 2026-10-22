/* Painel 2.0 — tela Hoje, por perfil: sócio (meta, ações, ontem, semana), gerente (previsão, tempos, pedidos por hora) e cozinha (produção, entregas, hortifrúti) */
(function(){
const R=v=>(+(v??0)).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
const R0=v=>(+(v??0)).toLocaleString('pt-BR',{style:'currency',currency:'BRL',maximumFractionDigits:0});
const N=v=>(+(v??0)).toLocaleString('pt-BR');
const N1=v=>(+(v??0)).toLocaleString('pt-BR',{maximumFractionDigits:1});
const esc=t=>String(t??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;');
const J=u=>fetch(u).then(r=>r.json());
const post=(url,corpo)=>fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(corpo)}).then(r=>r.json());
const DIAS=['domingo','segunda','terça','quarta','quinta','sexta','sábado'],DC=['dom','seg','ter','qua','qui','sex','sáb'];
const MESN=['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];
const fmtDia=iso=>{const d=new Date(iso+'T12:00:00');return `${DC[d.getDay()]} ${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}`};
const iso=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
const ativoAgora=()=>!!document.getElementById('h-root');
const tbl=(head,rows,right=[])=>`<div class="tw"><table><thead><tr>${head.map((h,i)=>`<th class="${right.includes(i)?'r':''}">${h}</th>`).join('')}</tr></thead><tbody>${rows.map(r=>`<tr>${r.map((c,i)=>`<td class="${right.includes(i)?'r':''}">${c}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
const kpi=(l,v,s,cl='s4')=>`<div class="card kpi ${cl}"><div class="k-l">${l}</div><div class="k-v">${v}</div><div class="k-s">${s||'&nbsp;'}</div></div>`;
const fmtQ=(v,u)=>v==null?'—':(u==='kg'?N1(v)+' kg':(u==='g'&&v>=1000?N1(v/1000)+' kg':Math.ceil(v).toLocaleString('pt-BR')+' '+(u==='g'?'g':'un')));
let el=null,ligado=false,timer=null;

/* ---------- blocos reaproveitados ---------- */
function metaCard(m){
  if(!m||m.meta==null)return `<div class="card s12"><h3>🎯 Meta de ${MESN[new Date().getMonth()]}</h3><p class="hint" style="margin:0">Ainda não há meta definida. Defina na tela <a href="#vendas" data-go="vendas" style="color:var(--brasa-ink);font-weight:600">Vendas</a>.</p></div>`;
  const pct=Math.min(m.pct,100),pt=100*(m.dia_hoje-1)/m.dias_no_mes,bateu=m.realizado>=m.meta,cls=m.no_ritmo?'up':'down';
  return `<div class="card s12 goal"><div><div class="lbl">Meta de ${MESN[new Date().getMonth()]} · grupo</div><div class="goal-big">${R0(m.realizado)} <small style="font-size:16px;color:var(--ink-2);font-weight:600">de ${R0(m.meta)} (${m.pct.toFixed(0)}%)</small></div>
   <div class="termo" style="margin-top:8px"><div class="merc" style="width:${pct}%"></div><div class="hoje" style="left:${pt}%"></div></div></div>
   <div style="font-size:13px;color:var(--ink-2)">${bateu?`<span class="up">🏆 Meta batida com ${m.dias_restantes} dia(s) de sobra</span>`:`Faltam <b style="color:var(--ink)">${R0(m.falta)}</b> em ${m.dias_restantes} dias: <b style="color:var(--ink)">${R0(m.necessario_por_dia)}/dia</b>.<br>Ritmo atual <b class="${cls}">${R0(m.ritmo_atual)}/dia ${m.no_ritmo?'✅':'⚠️'}</b> · projeção <b class="${cls}">${R0(m.projecao)}</b>`}</div></div>`;
}
function sentCard(s){
  if(!s)return '';const hora=new Date().toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'});
  return `<div class="sent ${s.status}">${s.status==='ok'?`<div>🟢 <b>Sentinela</b>: operação dentro do normal · verificada às ${hora}</div>`:s.alertas.map(a=>`<div>${a.icone} ${a.texto}</div>${a.dica?`<div class="dica">💡 ${a.dica}</div>`:''}`).join('')}</div>`;
}

function montarAcoes({meta,cli,enc,sug,est}){
  const acts=[];
  if(sug){const h=sug.pedidos.filter(p=>p.pedir_hoje);if(h.length)acts.push(['bad',`Pedir hoje: ${h.map(p=>esc(p.fornecedor)).join(', ')}`,`${h.length} pedido(s) com prazo de hoje, estimados em ${R0(h.reduce((a,p)=>a+p.total_estimado,0))}.${h.some(p=>p.dias_sem_produto)?' Algum item já está sem produto antes da próxima entrega.':''}`,'Ver pedidos','compras'])}
  if(est){const ab=est.itens.filter(x=>x.abaixo_minimo);if(ab.length)acts.push(['',`${ab.length} insumo(s) abaixo do mínimo`,`${ab.slice(0,4).map(x=>esc(x.insumo)).join(', ')}${ab.length>4?` e mais ${ab.length-4}`:''}.`,'Abrir estoque','compras'])}
  if(meta&&meta.meta!=null&&!meta.no_ritmo&&meta.realizado<meta.meta)acts.push(['',`Meta de ${MESN[new Date().getMonth()]} fora do ritmo`,`Projeção de ${R0(meta.projecao)} contra ${R0(meta.meta)}: precisa de ${R0(meta.necessario_por_dia)}/dia nos ${meta.dias_restantes} dias que restam.`,'Ver vendas','vendas'])
  if(cli&&+cli.resgate.clientes>0)acts.push(['',`${N(cli.resgate.clientes)} clientes sumidos`,`Não pedem há mais de 30 dias e já deixaram ${R0(cli.resgate.gasto)}. A lista de resgate tem nome e telefone.`,'Ver clientes','clientes'])
  if(enc&&(enc.parados.length+enc.quedas.length)>0)acts.push(['',`${enc.parados.length+enc.quedas.length} produto(s) encalhando`,`${enc.parados.length} parado(s) e ${enc.quedas.length} em queda no cardápio.`,'Ver cardápio','cardapio'])
  if(sug&&sug.sem_estoque.length)acts.push(['',`Estoque sem preenchimento: ${sug.sem_estoque.length} item(ns)`,`${sug.sem_estoque.slice(0,4).map(esc).join(', ')} ficam fora da sugestão de compra até você contar.`,'Contar estoque','compras'])
  return acts;
}
const acoesHtml=acts=>acts.length?acts.map(a=>`<div class="act ${a[0]}"><div><h4>${a[1]}</h4><p>${a[2]}</p></div><a class="btn" href="#${a[4]}" data-go="${a[4]}">${a[3]}</a></div>`).join(''):'<p class="hint" style="margin:0">Nada pedindo atenção agora 🎉</p>';

/* ---------- sócio ---------- */
async function socio(){
  const ontem=new Date();ontem.setDate(ontem.getDate()-1);const oi=iso(ontem),dowO=ontem.getDay();
  const [meta,sent,op,dOntem,cli,enc,res]=await Promise.all([
    J('/api/meta').catch(()=>null),J('/api/sentinela').catch(()=>null),J('/api/operacao?marca=todas&unidade=todas&periodo=60').catch(()=>null),
    J(`/api/dados?dias=1&inicio=${oi}&fim=${oi}&marca=todas&unidade=todas`).catch(()=>null),
    J('/api/clientes?marca=todas&unidade=todas&sumido_apos=30&canal=todos&so_com_telefone=0').catch(()=>null),J('/api/encalhados?marca=todas&unidade=todas').catch(()=>null),
    J('/api/resumo_geral?marca=todas&unidade=todas').catch(()=>null)]);
  if(!ativoAgora())return;
  const acts=montarAcoes({meta,cli,enc});
  const dw=op&&op.dias_semana.find(x=>+x.dow===dowO),k=dOntem&&dOntem.kpis;
  let pico='—';if(dOntem&&dOntem.por_hora&&dOntem.por_hora.length){const m=dOntem.por_hora.reduce((a,b)=>+a.pedidos>=+b.pedidos?a:b);pico=m.hora+'h'}
  const sv=op&&op.semana_vs,p=sv&&+sv.anterior>0?100*(sv.atual-sv.anterior)/sv.anterior:null;
  const hoje=new Date();
  const after=async()=>{const [sug,est]=await Promise.all([J('/api/sugestao_compra?cobertura_dias=30&seguranca_pct=20').catch(()=>null),J('/api/estoque_plano?cobertura_dias=30&seguranca_pct=20').catch(()=>null)]);
    const l=document.getElementById('acoes-lista');if(!l)return;l.innerHTML=acoesHtml(montarAcoes({meta,cli,enc,sug,est}));const st=document.getElementById('acoes-st');if(st)st.remove()};
  return {after,html:`<div class="g">${metaCard(meta)}
  <div class="card s7" id="acoes"><h3>O que pede sua atenção</h3><p class="hint">Calculado agora a partir de estoque, vendas, clientes e cardápio.</p>
   <div class="actions" id="acoes-lista">${acoesHtml(acts)}</div><p class="hint" id="acoes-st" style="margin:10px 0 0">Conferindo estoque e compras…</p></div>
  <div class="s5" style="display:grid;gap:16px;align-content:start">
   <div class="card" id="ontem"><h3>Ontem, ${DIAS[dowO]} ${fmtDia(oi).slice(4)}</h3><p class="hint">${dw?`Comparado com a média de ${DIAS[dowO]}s (${op?'60 dias':''})`:''}</p>
    <div class="trio"><div class="kpi"><div class="k-l">Pedidos</div><div class="k-v">${k?N(k.pedidos):'—'}</div><div class="k-s">${dw?`média ${N1(dw.media)}`:''}</div></div><div class="kpi"><div class="k-l">Faturado</div><div class="k-v">${k?R0(k.faturamento):'—'}</div><div class="k-s">${k?`ticket ${R0(k.ticket)}`:''}</div></div><div class="kpi"><div class="k-l">Pico</div><div class="k-v">${pico}</div><div class="k-s">${dw?`média ${dw.hora_pico}h`:''}</div></div></div></div>
   <div class="card" id="semana"><h3>Semana até agora</h3><p class="hint">Contra o mesmo ponto da semana passada</p>
    ${sv?`<div class="duas"><div class="kpi"><div class="k-l">Pedidos</div><div class="k-v">${N(sv.atual)} ${p==null?'':`<span class="pill ${p<-10?'p-bad':p<0?'p-warn':'p-ok'}">${p>0?'+':''}${p.toFixed(0)}%</span>`}</div><div class="k-s">semana passada: ${N(sv.anterior)}</div></div><div class="kpi"><div class="k-l">Faturamento</div><div class="k-v">${R0(sv.fat_atual)}</div><div class="k-s">semana passada: ${R0(sv.fat_anterior)}</div></div></div>`:'<p class="hint">Sem dados.</p>'}</div>
   <div class="card" id="sentinela"><h3>Sentinela</h3>${sentCard(sent)}</div></div>
  <div class="sec" id="resumo">Resumo das abas · últimos 90 dias</div>
  ${res?[kpi('Pedidos por dia',N1(res.operacao.pedidos_dia_medio),`ticket ${R(res.operacao.ticket_medio)}`,'s2'),kpi('Gasto por cliente',R(res.clientes.gasto_medio),`${res.clientes.pct_recorrentes.toFixed(0)}% recorrentes`,'s2'),kpi('Mais vendido',esc(res.cardapio.top_produto??'—'),`CMV ${res.cardapio.cobertura_cmv.toFixed(0)}% coberto`,'s2'),kpi('Região campeã',esc(res.bairros.nome??'—'),res.bairros.nome?`${res.bairros.pct.toFixed(0)}% dos pedidos`:'','s2'),kpi('Margem líquida',res.dre.margem_pct.toFixed(1)+'%','DRE 90 dias','s2')].join(''):''}
  <p class="hint s12" style="margin:0">Hoje, ${DIAS[hoje.getDay()]}, ${hoje.getDate()} de ${MESN[hoje.getMonth()]}. Atualizado às ${hoje.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})}.</p></div>`};
}

/* ---------- gerente ---------- */
async function gerente(){
  const dow=new Date().getDay();
  const [op,meta]=await Promise.all([J('/api/operacao?marca=todas&unidade=todas&periodo=60').catch(()=>null),J('/api/meta').catch(()=>null)]);
  if(!ativoAgora())return;
  const dw=op&&op.dias_semana.find(x=>+x.dow===dow),hs={};
  if(op)op.heatmap.forEach(x=>{hs[+x.hora]=(hs[+x.hora]||0)+(+x.pedidos)});
  const horas=Object.keys(hs).map(Number).sort((a,b)=>a-b),mx=Math.max(...Object.values(hs),1),hp=horas.find(h=>hs[h]===mx);
  const NT={delivery:'Delivery',takeout:'Balcão/Retirada',onsite:'No local',closed_table:'Mesa'};
  return `<div class="g">
  ${kpi(`Previsão pra hoje (${DIAS[dow]})`,dw?`${Math.round(dw.media)} pedidos`:'—',dw?`média das ${DIAS[dow]}s · pico às ${dw.pico_inicio}h`:'')}
  ${kpi(`Ticket das ${DIAS[dow]}s`,dw?R(dw.ticket):'—','60 dias')}
  ${kpi('Meta da noite',meta&&meta.meta!=null?R0(meta.necessario_por_dia):'—','pra manter o mês no trilho')}
  <div class="card s12" id="tempos"><h3>Tempos de atendimento</h3><p class="hint">Do pedido entrar até a conclusão · 60 dias</p>${op&&op.tempos_canal.length?tbl(['Tipo','Mediana','Pior 10%','Pedidos'],op.tempos_canal.map(t=>[NT[t.tipo]??t.tipo,t.mediana+' min',+t.p90>90?`<span class="pill p-bad">${t.p90} min</span>`:t.p90+' min',N(t.pedidos)]),[1,2,3]):'<p class="hint">Sem dados.</p>'}
   ${op?`<p class="hint" style="margin:10px 0 0">Cobertura: ${op.cobertura.total>0?Math.round(100*op.cobertura.mediveis/op.cobertura.total):0}% dos pedidos concluídos no portal. Concluir na hora melhora essa métrica.</p>`:''}</div>
  <div class="card s12"><h3>Pedidos por hora</h3><p class="hint">Total em 60 dias · pra planejar a montagem antes do pico</p>
   <div class="vbars">${horas.map(h=>`<div class="vb${h===hp?' hl':''}" title="${h}h: ${N(hs[h])} pedidos"><span class="num">${N(hs[h])}</span><i style="height:${Math.max(3,Math.round(120*hs[h]/mx))}px"></i><small>${h}h</small></div>`).join('')}</div></div></div>`;
}

/* ---------- cozinha ---------- */
async function cozinha(){
  const dow=new Date().getDay();
  const op=await J('/api/operacao?marca=todas&unidade=todas&periodo=60').catch(()=>null);
  if(!ativoAgora())return;
  const dw=op&&op.dias_semana.find(x=>+x.dow===dow),amanha=(dow+1)%7,da=op&&op.dias_semana.find(x=>+x.dow===amanha);
  const mediaDia=op?op.dias_semana.reduce((a,x)=>a+(+x.media),0)/Math.max(op.dias_semana.length,1):0;
  const fator=dw&&mediaDia?(+dw.media)/mediaDia:1;
  function pesado(sug,est,fator,dw){
  const prod=est?est.itens.filter(x=>!x.ciclo&&!x.generico&&x.consumo_dia>0&&x.custo_dia!=null).sort((a,b)=>b.custo_dia-a.custo_dia).slice(0,8):[];
  const ent=sug?[...sug.pedidos.map(p=>({f:p.fornecedor,e:p.entrega,i:p.itens.map(i=>`${esc(i.insumo)}${i.embalagens?` (${i.embalagens} ${esc(i.embalagem_nome)}(s))`:''}`)})),...sug.proximos.map(p=>({f:p.fornecedor,e:p.entrega,i:[]}))].sort((a,b)=>a.e.localeCompare(b.e)).slice(0,4):[];
  return `  <div class="card s12 stock-bar"><div><h3>Próximas entregas</h3><p class="hint" style="margin:0">${ent.length?ent.map(e=>`<strong>${esc(e.f)}</strong> ${fmtDia(e.e)}${e.i.length?` — ${e.i.slice(0,3).join(', ')}`:''}`).join('<br>'):'Nenhuma entrega prevista.'}</p></div>
   <div class="stock-acts"><a class="sa" href="#compras" data-go="compras"><span><b>Receber entrega</b><small>abrir Compras e estoque</small></span></a><a class="sa" href="#compras" data-go="compras"><span><b>Contar a câmara</b><small>acertar o estoque</small></span></a></div></div>
  <div class="card s7"><h3>Produção do dia</h3><p class="hint">Consumo médio por dia ajustado pela previsão de hoje (${fator>=1?'+':''}${Math.round(100*(fator-1))}% sobre a média) · estoque real</p>
   ${prod.length?tbl(['Item','Quantidade','Estoque'],prod.map(x=>[`<strong>${esc(x.insumo)}</strong>`,`<strong>${fmtQ(x.consumo_dia*fator,x.unidade)}</strong>`,`<span class="mut">${x.estoque==null?'—':fmtQ(x.estoque,x.unidade)}</span>`]),[1,2]):'<p class="hint">Sem dados.</p>'}</div>
  <div class="card s5"><h3>Hortifrúti</h3>${sug&&sug.hortifruti.length?`<p class="hint">Troca a cada ${sug.hortifruti[0].dias_ciclo} dia(s) · próxima ${fmtDia(sug.hortifruti[0].proxima_troca)}</p>${tbl(['Insumo','Qtd'],sug.hortifruti.map(h=>[esc(h.insumo),`~${Math.ceil(h.qtd)} ${h.unidade}`]),[1])}`:'<p class="hint">Sem itens por troca.</p>'}</div>`}
  const hoje=new Date();
  const after=async()=>{const [sug,est]=await Promise.all([J('/api/sugestao_compra?cobertura_dias=30&seguranca_pct=20').catch(()=>null),J('/api/estoque_plano?cobertura_dias=30&seguranca_pct=20').catch(()=>null)]);const b=document.getElementById('coz-pesado');if(b)b.innerHTML=pesado(sug,est,fator,dw)};
  return {after,html:`<div class="g">
  <div class="card s12" style="background:var(--side-bg);color:var(--side-fg);border-color:var(--side-bg)"><div class="lbl" style="color:var(--side-dim)">${DIAS[dow][0].toUpperCase()+DIAS[dow].slice(1)}, ${hoje.getDate()} de ${MESN[hoje.getMonth()]}</div>
   <div style="font-family:var(--f-display);font-weight:800;font-size:28px;margin-top:4px">Previsão: ${dw?Math.round(dw.media):'—'} pedidos</div>
   <div style="color:var(--side-dim);font-size:13px">${dw?`Pico às ${dw.pico_inicio}h.`:''} ${da?`${DIAS[amanha][0].toUpperCase()+DIAS[amanha].slice(1)} pede ${Math.round(da.media)}${+da.media>+dw.media*1.3?', então dá pra adiantar porcionamento hoje':''}.`:''}</div></div>
  <div id="coz-pesado" style="display:contents"><div class="card s12"><p class="hint" style="margin:0">Carregando entregas, produção e hortifrúti…</p></div></div>
  </div>`};
}

async function render(c){
  el=c;const role=window.V2.role();
  el.innerHTML='<div id="h-root"><div class="card"><p class="hint" style="margin:0">Carregando o dia…</p></div></div>';window.V2.setJump([]);
  let res=await({socio,gerente,cozinha}[role]||socio)().catch(()=>null);
  if(res===undefined)return;
  if(res===null)res='<div class="card"><h3>Não foi possível carregar</h3><p class="hint">Tente de novo em instantes.</p></div>';
  const html=typeof res==='string'?res:res.html,r=document.getElementById('h-root');if(!r)return;r.innerHTML=html;
  if(res&&res.after)res.after().catch(()=>{});
}
window.V2.screens.hoje={render(c){clearInterval(timer);render(c);timer=setInterval(()=>{if(ativoAgora())render(el);else clearInterval(timer)},5*60*1000)},onFiltros(){}};
})();
