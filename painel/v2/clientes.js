/* Painel 2.0 — tela Clientes: matriz RFV, fidelização, recência, ciclos, novos, top, risco, resgate, retenção e lista completa */
(function(){
const R=v=>(+(v??0)).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
const N=v=>(+(v??0)).toLocaleString('pt-BR');
const esc=t=>String(t??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;');
const css=n=>getComputedStyle(document.documentElement).getPropertyValue(n).trim();
const ativoAgora=()=>!!document.getElementById('c-kpis');
const CANAL={ifood:'iFood',site:'Site',portal:'Portal (balcão)',whatsapp:'WhatsApp',chatbot:'Chatbot',app:'App','99food':'99Food',rappi:'Rappi',aiqfome:'Aiqfome',keeta:'Keeta',import:'Importação'};
const RFV={'Campeões':['ca','#9A3412'],'Fieis':['fi','#FF7A2F'],'Em potenciais':['ep','#FF8A3F'],'Novos':['no','#E8A055'],'Promissores':['pr','#D98A3D'],'Precisam de atenção':['pa','#B5762B'],'Quase dormentes':['qd','#6B4A2A'],'Hibernando':['hi','#4A3625'],'Perdidos':['pe','#2A211C'],'Em risco':['er','#C1462B'],'Não posso perder':['npp','#8C1F1F']};
const fone=t=>{if(!t)return '';const d=t.replace(/\D/g,'');return d.length===11?`(${d.slice(0,2)}) ${d.slice(2,7)}-${d.slice(7)}`:t};
const fmtData=iso=>iso?new Date(iso).toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit',year:'numeric'}):'—';
const cli=c=>`${esc(c.nome??'Sem nome')}<br><small class="mut">${fone(c.telefone)}</small>`;

let el=null,ligado=false,charts={},dados=null,retencao=null,timer=null;
let st={canal:'todos',tel:0,sumido:30,sel:null};
let lista={busca:'',ordenar:'pedidos',pagina:1,porPagina:10},buscaT=null;

function carregarChart(){if(window.Chart)return Promise.resolve();return new Promise((ok,err)=>{const s=document.createElement('script');s.src='https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js';s.onload=ok;s.onerror=err;document.head.appendChild(s)})}
function tema(){Chart.defaults.color=css('--ink-2');Chart.defaults.borderColor=css('--line');Chart.defaults.font.family='Figtree, system-ui, sans-serif'}
function desenhar(id,cfg){const c=document.getElementById(id);if(!c)return;if(charts[id])charts[id].destroy();charts[id]=new Chart(c,cfg)}
const qBase=()=>{const f=window.V2.filtros;return `marca=${encodeURIComponent(f.marca)}&unidade=${encodeURIComponent(f.unidade)}`};
const tbl=(head,rows,right=[],vazio='Sem dados')=>`<div class="tw"><table><thead><tr>${head.map((h,i)=>`<th class="${right.includes(i)?'r':''}">${h}</th>`).join('')}</tr></thead><tbody>${rows.length?rows.map(r=>`<tr>${r.map((c,i)=>`<td class="${right.includes(i)?'r':''}">${c}</td>`).join('')}</tr>`).join(''):`<tr><td colspan="${head.length}" class="mut" style="text-align:center;padding:16px">${vazio}</td></tr>`}</tbody></table></div>`;

function esqueleto(){
  el.innerHTML=`<div class="g">
  <div class="card s12 ctrl-per"><div class="filters"><select id="c-canal" aria-label="Canal"><option value="todos">Todos os canais</option></select>
   <select id="c-tel" aria-label="Telefone"><option value="0">Com e sem telefone</option><option value="1">Só com telefone 📱</option></select>
   <select id="c-sumido" aria-label="Considerar sumido após">${[30,45,60].map(v=>`<option value="${v}"${v===st.sumido?' selected':''}>Sumido há ${v}+ dias</option>`).join('')}</select></div></div>
  <div class="s12" id="c-alerta" hidden></div>
  <div class="s12 kpis5" id="c-kpis"></div>
  <div class="sec" id="rfv">Matriz RFV</div>
  <div class="card s12"><h3>Matriz RFV <span class="info2" title="Recência, Frequência e Valor: separa a base em 11 perfis a partir de 3 quintis. Frequência e ticket médio entram juntos, na média, no eixo vertical. Quem está no canto superior direito é ouro; no inferior esquerdo já era.">?</span></h3>
   <p class="hint">Onde cada cliente está — de quem nunca mais volta a quem não pode perder</p>
   <div class="rfv-wrap"><div class="rfv-y">Frequência e ticket médio (média)</div><div><div class="rfv-grid areas" id="c-grid"></div><div class="rfv-x">Recência (menos recente → mais recente) · toque num segmento pra ver os clientes</div></div></div>
   <div class="rfv-panel" id="c-rfvlista" hidden></div></div>
  <div class="sec" id="base">A base</div>
  <div class="card s6"><h3>Escada da fidelização</h3><p class="hint">Quantos pedidos cada cliente já fez — o objetivo é empurrar todo mundo pra direita</p><div class="area"><canvas id="gFreq"></canvas></div></div>
  <div class="card s6"><h3>Novos clientes por semana</h3><p class="hint">Primeira compra de cada cliente — sua aquisição</p><div class="area"><canvas id="gNovos"></canvas></div></div>
  <div class="card s12"><h3>Recência da base <span class="info2" title="'Nunca compraram' é quem teve TODOS os pedidos cancelados — por isso costuma ser bem pequeno.">?</span></h3><p class="hint">Quando cada cliente pediu pela última vez — quanto mais frio, mais urgente o resgate</p>
   <div class="dois"><div class="area" style="min-height:220px;height:220px"><canvas id="gRecencia"></canvas></div><div id="c-recencia"></div></div></div>
  <div class="card s6"><h3>Tempo entre pedidos</h3><p class="hint" id="c-ciclo">—</p><div class="area"><canvas id="gCiclo"></canvas></div></div>
  <div class="card s6"><h3>Retenção de clientes novos 📈 <span class="info2" title="Pra cada mês, olha a turma que fez a 1ª compra ali e mede quantos % voltaram pra uma 2ª compra em até 30 dias. Turmas com menos de 30 clientes ou com o 1º mês ainda aberto ficam de fora.">?</span></h3><p class="hint" id="c-cohort">Carregando…</p><div class="area"><canvas id="gRet"></canvas></div></div>
  <div class="sec" id="acao">Quem acionar</div>
  <div class="card s6"><h3>Top clientes 👑</h3><p class="hint">Quem mais deixou dinheiro na chapa</p><div id="c-top"></div></div>
  <div class="card s6"><h3>Em risco de sumir ⚠️ <span class="info2" title="Compara os dias sem pedir com o intervalo médio HISTÓRICO de cada cliente. Quem pede a cada 5 dias e já está há 12 aparece aqui bem antes dos 30 dias da lista de resgate.">?</span></h3><p class="hint">Já passou do próprio padrão de compra — ainda não sumiu, mas está atrasado</p><div id="c-risco"></div></div>
  <div class="card s12"><h3>Lista de resgate 🚨</h3><p class="hint">Pediram 2+ vezes e sumiram — os primeiros da fila pra campanha de WhatsApp</p><div id="c-resgate"></div></div>
  <div class="sec" id="lista">Lista completa</div>
  <div class="card s12"><h3>Lista completa de clientes</h3><p class="hint">Todo mundo que já pediu, com a classificação RFV de cada um — busque por nome ou telefone</p>
   <div class="filters" style="margin-bottom:12px"><input type="search" id="l-busca" class="busca" placeholder="🔍 Buscar por nome ou telefone…" value="${esc(lista.busca)}"><select id="l-ord"><option value="pedidos">Mais pedidos</option><option value="gasto">Maior gasto total</option><option value="ticket_medio">Maior ticket médio</option><option value="ultimo">Pedido mais recente</option><option value="primeiro">Cliente mais antigo</option></select></div>
   <div id="c-lista"></div>
   <div class="pag"><span class="mut" id="l-cont"></span><span class="filters"><select id="l-pp"><option value="10">10 por página</option><option value="25">25 por página</option><option value="50">50 por página</option></select><button class="btn ghost" id="l-ant">‹</button><span id="l-pag" style="font-family:var(--f-mono)"></span><button class="btn ghost" id="l-prox">›</button></span></div></div>
  <p class="hint s12" id="c-atual" style="margin:0"></p></div>`;
  document.getElementById('c-tel').value=st.tel;document.getElementById('l-ord').value=lista.ordenar;document.getElementById('l-pp').value=lista.porPagina;
  window.V2.setJump([['rfv','Matriz RFV'],['base','A base'],['acao','Quem acionar'],['lista','Lista']]);
}

function grid(){
  const por=Object.fromEntries((dados.rfv||[]).map(s=>[s.segmento,s])),f=window.V2.filtros;
  document.getElementById('c-grid').innerHTML=Object.entries(RFV).map(([n,[a,cor]])=>{const s=por[n]||{clientes:0,pct:0,por_unidade:{}};
    const pu=f.unidade==='todas'?Object.entries(s.por_unidade||{}).sort((x,y)=>y[1]-x[1]).map(([u,k])=>`${N(k)} ${u}`).join(' · '):'';
    return `<button class="rfv-cell${n===st.sel?' sel':''}" data-seg="${esc(n)}" style="grid-area:${a};background:${cor}"><b>${n}</b><span>${N(s.clientes)} (${s.pct.toFixed(1).replace('.',',')}%)</span>${pu?`<small>${pu}</small>`:''}</button>`}).join('');
  segLista();
}
function segLista(){
  const b=document.getElementById('c-rfvlista');if(!st.sel){b.hidden=true;return}
  const l=(dados.rfv_clientes||{})[st.sel]||[];
  b.innerHTML=`<div style="display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:8px"><strong>${esc(st.sel)} — até 30 clientes, do que mais gastou pro que menos gastou</strong><button class="btn ghost" data-rfvfechar>✕ fechar</button></div>
   ${tbl(['Cliente','Pedidos','Gasto total','Sem pedir há'],l.map(c=>[cli(c),N(c.pedidos),R(c.gasto),`<span class="down">${c.dias} dias</span>`]),[1,2,3],'Ninguém nesse segmento com os filtros atuais')}`;
  b.hidden=false;
}

function pintar(){
  const d=dados;if(!d)return;tema();
  const f=window.V2.filtros,k=d.kpis,brasa=css('--brasa'),sob=css('--c-sob');
  const cs=document.getElementById('c-canal');if(cs.options.length===1){d.canais.forEach(c=>cs.add(new Option(CANAL[c.origem]??c.origem,c.origem)));cs.value=st.canal}
  const al=document.getElementById('c-alerta');al.hidden=false;
  if(+d.resgate.clientes>0){al.className='s12 sent atencao';al.innerHTML=`<div>🚨 <strong>${N(d.resgate.clientes)} clientes</strong> não pedem há mais de <strong>${st.sumido} dias</strong> — juntos já deixaram <strong>${R(d.resgate.gasto)}</strong> na chapa. Um cupom de "sentimos sua falta" pode trazê-los de volta: a lista de resgate tem nome e telefone. 📲</div>`}
  else{al.className='s12 sent ok';al.innerHTML=`<div>✅ Nenhum cliente recorrente sumido há mais de <strong>${st.sumido} dias</strong>. Base quente!</div>`}
  const kp=(l,v,s,cl='')=>`<div class="card kpi ${cl}"><div class="k-l">${l}</div><div class="k-v">${v}</div><div class="k-s">${s||'&nbsp;'}</div></div>`;
  document.getElementById('c-kpis').innerHTML=kp('Clientes',N(k.total),'com pelo menos 1 pedido válido','destaque')+kp('Recorrentes',N(k.recorrentes),`${k.total>0?(100*k.recorrentes/k.total).toFixed(0):0}% voltaram pra pedir de novo`)+kp('Novos (30 dias)',N(k.novos_30d),'')+kp('Gasto médio por cliente',R(k.gasto_medio),'');
  grid();
  desenhar('gFreq',{type:'bar',data:{labels:d.frequencia.map(x=>x.faixa),datasets:[{data:d.frequencia.map(x=>+x.clientes),backgroundColor:[css('--ink-2'),css('--brasa-ink'),brasa,sob],borderRadius:4}]},options:{maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{y:{ticks:{precision:0}}}}});
  desenhar('gNovos',{type:'line',data:{labels:d.novos_semana.map(x=>x.semana),datasets:[{data:d.novos_semana.map(x=>+x.clientes),fill:true,borderColor:brasa,backgroundColor:brasa+'22',tension:.3,pointRadius:2,borderWidth:2}]},options:{maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{y:{ticks:{precision:0}}}}});
  const COR={'Nunca compraram':css('--c-chomp'),'Últimos 30 dias':brasa,'30 a 60 dias':sob,'60 a 90 dias':css('--brasa-ink'),'90 a 180 dias':css('--ink-2'),'Mais de 180 dias':css('--line')};
  const rec=[{faixa:'Nunca compraram',clientes:d.nunca_compraram},...d.recencia.map(x=>({faixa:x.faixa,clientes:+x.clientes}))],tot=rec.reduce((s,x)=>s+x.clientes,0)||1;
  desenhar('gRecencia',{type:'doughnut',data:{labels:rec.map(x=>x.faixa),datasets:[{data:rec.map(x=>x.clientes),backgroundColor:rec.map(x=>COR[x.faixa]),borderColor:css('--surface'),borderWidth:2}]},options:{maintainAspectRatio:false,plugins:{legend:{display:false}}}});
  document.getElementById('c-recencia').innerHTML=tbl(['Grupo de clientes','Qtd de clientes'],rec.map(x=>[`<i class="bol" style="background:${COR[x.faixa]}"></i>${x.faixa}`,`${N(x.clientes)} <span class="mut">(${(100*x.clientes/tot).toFixed(0)}%)</span>`]),[1]);
  document.getElementById('c-ciclo').textContent=`Média geral: ${d.media_entre_pedidos} dias entre um pedido e o próximo`;
  desenhar('gCiclo',{type:'bar',data:{labels:d.ciclos.map(x=>x.ciclo),datasets:[{data:d.ciclos.map(x=>+x.media_dias),backgroundColor:sob,borderRadius:4}]},options:{maintainAspectRatio:false,plugins:{legend:{display:false},tooltip:{callbacks:{label:c=>`${c.parsed.y} dias em média`,afterLabel:c=>`${d.ciclos[c.dataIndex].clientes} clientes chegaram nesse ciclo`}}},scales:{y:{title:{display:true,text:'dias'}}}}});
  document.getElementById('c-top').innerHTML=tbl(['Cliente','Pedidos','Total gasto','Último pedido'],d.top.map(c=>[cli(c),N(c.pedidos),R(c.gasto),c.ultimo_pedido]),[1,2,3],'Sem dados ainda');
  document.getElementById('c-risco').innerHTML=tbl(['Cliente','Costuma pedir a cada','Sem pedir há','Gastava'],d.em_risco.map(c=>[cli(c),`${c.intervalo_medio} dias`,`<span class="down">${c.dias_sem_pedido} dias</span>`,R(c.gasto)]),[1,2,3],'Ninguém em risco agora 👍');
  document.getElementById('c-resgate').innerHTML=tbl(['Cliente','Pedidos','Gastava','Sumido há'],d.sumidos.map(c=>[cli(c),N(c.pedidos),R(c.gasto),`<span class="down">${c.dias_sem_pedido} dias</span>`]),[1,2,3],'Ninguém sumido — ótimo sinal 🎉');
  document.getElementById('c-atual').innerHTML='<span class="dot" style="display:inline-block;margin-right:6px"></span>Atualizado às '+new Date().toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'});
}
function pintarRetencao(){
  const ct=retencao;if(!ct||!document.getElementById('gRet'))return;tema();
  const ML=m=>{const [a,mm]=m.split('-');return ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'][+mm-1]+'/'+a.slice(2)};
  const atual=new Date(ct.mes_atual);
  const q=ct.cohorts.filter(c=>{if(c.tamanho<30)return false;const f=new Date(c.mes);f.setMonth(f.getMonth()+2);return f<=atual&&c.retencao.some(r=>r.m===1)}).map(c=>({mes:c.mes,tamanho:c.tamanho,pct:c.retencao.find(r=>r.m===1).pct}));
  const d=document.getElementById('c-cohort');
  if(q.length<2){d.textContent='Ainda não há turmas suficientes (com volume e mês fechado) pra mostrar uma tendência.';return}
  const p=q[0],u=q[q.length-1],dl=u.pct-p.pct;
  d.innerHTML=`Retenção no 1º mês: turma ${ML(p.mes)} → <strong style="color:var(--ink)">${p.pct.toFixed(0)}%</strong> · turma ${ML(u.mes)} → <strong style="color:var(--ink)">${u.pct.toFixed(0)}%</strong> ${Math.abs(dl)<2?'<span class="mut">(≈ estável)</span>':`<span class="${dl>=0?'up':'down'}">(${dl>=0?'▲ melhorando':'▼ piorando'})</span>`}`;
  const brasa=css('--brasa');
  desenhar('gRet',{type:'line',data:{labels:q.map(c=>ML(c.mes)),datasets:[{data:q.map(c=>c.pct),borderColor:brasa,backgroundColor:brasa+'22',fill:true,tension:.3,pointRadius:4,pointBackgroundColor:brasa,borderWidth:2}]},
    options:{maintainAspectRatio:false,plugins:{legend:{display:false},tooltip:{callbacks:{label:c=>`${c.parsed.y.toFixed(0)}% voltaram (${N(q[c.dataIndex].tamanho)} clientes novos nesse mês)`}}},scales:{y:{title:{display:true,text:'% que voltou em até 30 dias'},min:0}}}});
}

async function carregarLista(){
  const f=window.V2.filtros,q=new URLSearchParams({marca:f.marca,unidade:f.unidade,canal:st.canal,so_com_telefone:st.tel,busca:lista.busca,ordenar_por:lista.ordenar,pagina:lista.pagina,por_pagina:lista.porPagina});
  const d=await fetch('/api/clientes/lista?'+q).then(r=>r.json());if(!ativoAgora())return;
  document.getElementById('c-lista').innerHTML=tbl(['Cliente','Total de pedidos','Ticket médio','Último pedido','Cliente desde','Classificação RFV'],d.clientes.map(c=>[cli(c),N(c.pedidos),R(c.ticket_medio),fmtData(c.ultimo_pedido),fmtData(c.cliente_desde),`<span class="pill" style="background:${(RFV[c.segmento]||[0,'#666'])[1]};color:#fff">${esc(c.segmento)}</span>`]),[1,2],'Nenhum cliente encontrado');
  const tp=Math.max(1,Math.ceil(d.total/d.por_pagina)),ini=d.total===0?0:(d.pagina-1)*d.por_pagina+1,fim=Math.min(d.pagina*d.por_pagina,d.total);
  document.getElementById('l-cont').textContent=`${N(ini)}–${N(fim)} de ${N(d.total)} clientes`;document.getElementById('l-pag').textContent=`${d.pagina} / ${tp}`;
  document.getElementById('l-ant').disabled=d.pagina<=1;document.getElementById('l-prox').disabled=d.pagina>=tp;
}
async function carregar(){
  if(!ativoAgora())return;
  const f=window.V2.filtros;
  carregarLista();
  fetch(`/api/retencao?${qBase()}`).then(r=>r.json()).then(r=>{retencao=r;pintarRetencao()}).catch(()=>{});
  try{dados=await fetch(`/api/clientes?${qBase()}&sumido_apos=${st.sumido}&canal=${encodeURIComponent(st.canal)}&so_com_telefone=${st.tel}`).then(r=>r.json());pintar()}
  catch(e){document.getElementById('c-kpis').innerHTML='<div class="card"><h3>Não foi possível carregar</h3><p class="hint">Tente de novo em instantes.</p></div>'}
}

function ligar(){
  document.addEventListener('click',e=>{if(!ativoAgora())return;let b;
    if(b=e.target.closest('[data-seg]')){st.sel=st.sel===b.dataset.seg?null:b.dataset.seg;grid();return}
    if(e.target.closest('[data-rfvfechar]')){st.sel=null;grid();return}
    if(e.target.closest('#l-ant')&&lista.pagina>1){lista.pagina--;carregarLista();return}
    if(e.target.closest('#l-prox')){lista.pagina++;carregarLista()}});
  document.addEventListener('change',e=>{if(!ativoAgora())return;const t=e.target;
    if(t.id==='c-canal'){st.canal=t.value;lista.pagina=1;carregar()}
    else if(t.id==='c-tel'){st.tel=+t.value;lista.pagina=1;carregar()}
    else if(t.id==='c-sumido'){st.sumido=+t.value;carregar()}
    else if(t.id==='l-ord'){lista.ordenar=t.value;lista.pagina=1;carregarLista()}
    else if(t.id==='l-pp'){lista.porPagina=+t.value;lista.pagina=1;carregarLista()}});
  document.addEventListener('input',e=>{if(!ativoAgora()||e.target.id!=='l-busca')return;clearTimeout(buscaT);buscaT=setTimeout(()=>{lista.busca=e.target.value;lista.pagina=1;carregarLista()},350)});
  window.addEventListener('v2tema',()=>{if(ativoAgora()&&dados){pintar();pintarRetencao()}});
}
window.V2.screens.clientes={
  render(c){el=c;if(!ligado){ligar();ligado=true}clearInterval(timer);esqueleto();
    carregarChart().then(carregar).catch(()=>{});
    timer=setInterval(()=>{if(ativoAgora())carregar();else clearInterval(timer)},5*60*1000)},
  onFiltros(){lista.pagina=1;carregar()}};
})();
