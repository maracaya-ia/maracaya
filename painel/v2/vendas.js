/* Painel 2.0 — tela Vendas (antiga Visão geral): sentinela, meta, crescimento, KPIs, gráficos, mês a mês, canais */
(function(){
const R=v=>(+(v??0)).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
const RC=v=>(+v).toLocaleString('pt-BR',{style:'currency',currency:'BRL',maximumFractionDigits:0});
const N=v=>(+(v??0)).toLocaleString('pt-BR');
const esc=t=>String(t??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;');
const post=(url,corpo)=>fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(corpo)}).then(r=>r.json());
const DIAS_SEM=['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];
const MESES=['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];
const MES_AB=['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];
const CANAL={ifood:'iFood',site:'Site próprio',portal:'Portal (balcão)',catalog:'Catálogo/Link',whatsapp:'WhatsApp',chatbot:'Chatbot',app:'App',food99:'99Food','99food':'99Food',rappi:'Rappi',aiqfome:'Aiqfome',keeta:'Keeta'};
const css=n=>getComputedStyle(document.documentElement).getPropertyValue(n).trim();

let el=null,ligado=false,charts={},mensal=null,dados=null,timer=null,ativo=false;
let custom={ini:'',fim:'',cIni:'',cFim:'',comp:false};
let edMeta=false;
const ativoAgora=()=>!!document.getElementById('v-kpis');

function carregarChart(){
  if(window.Chart)return Promise.resolve();
  return new Promise((ok,err)=>{const s=document.createElement('script');s.src='https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js';s.onload=ok;s.onerror=err;document.head.appendChild(s)})}
function tema(){Chart.defaults.color=css('--ink-2');Chart.defaults.borderColor=css('--line');Chart.defaults.font.family='Figtree, system-ui, sans-serif'}
function desenhar(id,cfg){const c=document.getElementById(id);if(!c)return;if(charts[id])charts[id].destroy();charts[id]=new Chart(c,cfg)}
const calor=(v,max)=>{const t=max?v/max:0,m=(a,b)=>Math.round(a+(b-a)*t);return `rgb(${m(232,212)},${m(200,81)},${m(180,28)})`};

function intervalo(){const iv=window.V2.intervalo();
  if(custom.ini&&custom.fim){const d=Math.round((new Date(custom.fim)-new Date(custom.ini))/864e5)+1;return{dias:d,ini:custom.ini,fim:custom.fim}}
  return iv}
function urlDados(){const f=window.V2.filtros,iv=intervalo();
  let u=`/api/dados?dias=${iv.dias}&marca=${encodeURIComponent(f.marca)}&unidade=${encodeURIComponent(f.unidade)}`;
  if(iv.ini)u+=`&inicio=${iv.ini}&fim=${iv.fim}`;
  if(custom.comp&&custom.cIni&&custom.cFim)u+=`&comp_inicio=${custom.cIni}&comp_fim=${custom.cFim}`;
  return u}

/* ---- esqueleto ---- */
function esqueleto(){
  el.innerHTML=`<div class="g">
  <div class="card s12 ctrl-per"><div class="filters"><span class="lbl">Período personalizado</span><input type="date" id="v-ini" value="${custom.ini}" aria-label="De"><span class="mut">→</span><input type="date" id="v-fim" value="${custom.fim}" aria-label="Até">
   <button class="btn ghost" id="v-limpar" ${custom.ini?'':'hidden'}>Voltar ao período do filtro</button>
   <button class="btn ghost" id="v-comp" aria-pressed="${custom.comp}">⇄ Comparar</button>
   <span id="v-compbox" ${custom.comp?'':'hidden'} class="filters"><input type="date" id="v-cini" value="${custom.cIni}" aria-label="Comparar de"><span class="mut">→</span><input type="date" id="v-cfim" value="${custom.cFim}" aria-label="Comparar até"></span></div></div>
  <div class="s12" id="v-sent" hidden></div>
  <div class="card s12" id="v-meta" hidden></div>
  <div class="card s12 hero2" id="v-hero" hidden></div>
  <div class="s12 kpis5" id="v-kpis"></div>
  <div class="sec" id="dia">Por dia</div>
  <div class="card s8"><h3>Faturamento por dia</h3><div class="area"><canvas id="gDia"></canvas></div></div>
  <div class="card s4" id="pico"><h3>Horário de pico</h3><div class="area"><canvas id="gHora"></canvas></div></div>
  <div class="sec" id="campeoes">Campeões e dia da semana</div>
  <div class="card s6"><h3>Campeões de venda</h3><div class="area tall"><canvas id="gProdutos"></canvas></div></div>
  <div class="card s6" id="semana"><h3>Movimento por dia da semana</h3><div class="area tall"><canvas id="gSemana"></canvas></div></div>
  <div class="sec" id="mes">Mês a mês</div>
  <div class="card s12"><div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;align-items:flex-start"><div><h3>Desempenho por mês — marca × unidade</h3><p class="hint" style="margin:0">Faturamento de cada mês por marca e unidade (GC = Colorado).</p></div>
   <div class="filters"><select id="m-met" aria-label="Métrica"><option value="faturamento">Faturamento</option><option value="pedidos">Pedidos</option><option value="ticket">Ticket médio</option></select>
   <select id="m-modo" aria-label="Modo"><option value="empilhado">Empilhado</option><option value="lado">Lado a lado</option></select></div></div>
   <div class="area" style="min-height:300px;margin-top:10px"><canvas id="gMensal"></canvas></div><p class="hint" id="m-nota" style="margin-top:8px"></p>
   <div class="tw" id="m-tab"></div></div>
  <div class="sec" id="canais">Canais</div>
  <div class="card s12"><h3>O pedágio dos marketplaces 💸</h3><p class="hint" id="v-desc">Carregando…</p><div class="tw" id="v-canais"></div></div>
  <div class="card s12"><h3>Resumo das outras abas</h3><p class="hint">Média dos principais indicadores de cada área, numa janela fixa de 90 dias (respeita unidade e marca).</p><div class="resumo" id="v-resumo"></div></div>
  <p class="hint s12" id="v-atual" style="margin:0"></p></div>`;
  window.V2.setJump([['dia','Por dia'],['campeoes','Campeões'],['mes','Por mês'],['canais','Canais']]);
}

/* ---- blocos ---- */
async function vigiar(){
  try{const s=await fetch('/api/sentinela').then(r=>r.json()),b=document.getElementById('v-sent');if(!b)return;
    const hora=new Date().toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'});
    b.className='s12 sent '+s.status;
    b.innerHTML=s.status==='ok'?`<div>🟢 Sentinela: operação dentro do normal · verificada às ${hora}</div>`
      :s.alertas.map(a=>`<div>${a.icone} ${a.texto}</div>${a.dica?`<div class="dica">💡 ${a.dica}</div>`:''}`).join('')+`<div class="dica">🛡️ Sentinela · verificada às ${hora} · compara com o típico das últimas 8 semanas nesse ponto do dia</div>`;
    b.hidden=false}catch(e){}}

async function medirMeta(){
  try{const f=window.V2.filtros,m=await fetch(`/api/meta?marca=${encodeURIComponent(f.marca)}&unidade=${encodeURIComponent(f.unidade)}`).then(r=>r.json()),b=document.getElementById('v-meta');if(!b)return;
    const nome=MESES[new Date().getMonth()],quem=[f.marca!=='todas'?f.marca:'',f.unidade!=='todas'?f.unidade:''].filter(Boolean).join(' · ');
    const tit=`🎯 Meta de ${nome} ${quem?'— '+esc(quem):'do grupo'}`;
    const aviso=m.meta_e_do_grupo_todo?'<p class="hint" style="margin:6px 0 0">⚠️ a meta é do grupo inteiro — só o "realizado" está filtrado pela unidade</p>':'';
    const inp=v=>`<span class="filters">R$ <input class="cin" id="v-inpmeta" type="number" step="500" min="1" value="${v??''}" placeholder="30000" style="width:120px"></span>`;
    if(m.meta===null||edMeta){
      b.innerHTML=`<div class="meta-top"><strong>${m.meta===null?tit:'🎯 Nova meta de '+nome}</strong>${m.meta===null?'<span class="mut">defina e o termômetro acompanha todo dia</span>':''}${inp(m.meta)}</div>
       ${m.meta===null?`<p class="hint" style="margin:8px 0 0">Ritmo atual: <strong style="color:var(--ink)">${RC(m.ritmo_atual)}/dia</strong> · projeção do mês: <strong style="color:var(--ink)">${RC(m.projecao)}</strong></p>`:''}${aviso}`;
    }else{
      const pct=Math.min(m.pct,100),pt=100*(m.dia_hoje-1)/m.dias_no_mes,bateu=m.realizado>=m.meta,cls=m.no_ritmo?'up':'down';
      b.innerHTML=`<div class="meta-top"><strong>${tit}</strong><span class="num"><strong>${RC(m.realizado)}</strong> de ${RC(m.meta)} (${m.pct.toFixed(0)}%)</span><button class="btn ghost" id="v-edmeta" style="margin-left:auto">✏️ editar</button></div>
       <div class="termo"><div class="merc" style="width:${pct}%"></div><div class="hoje" style="left:${pt}%" title="onde o mês está no calendário"></div></div>
       <p class="hint" style="margin:8px 0 0">${bateu?`<span class="up">🏆 Meta batida com ${m.dias_restantes} dia(s) de sobra — bora esticar?</span>`
        :`faltam <strong style="color:var(--ink)">${RC(m.falta)}</strong> · precisa de <strong style="color:var(--ink)">${RC(m.necessario_por_dia)}/dia</strong> · ritmo atual: <strong class="${cls}">${RC(m.ritmo_atual)}/dia ${m.no_ritmo?'✅':'⚠️'}</strong> · projeção: <strong class="${cls}">${RC(m.projecao)}</strong>`} · ${m.dias_restantes} dia(s) restantes</p>${aviso}`}
    b.hidden=false;const i=document.getElementById('v-inpmeta');
    if(i){if(edMeta)i.focus();const salvar=async()=>{const v=parseFloat(i.value);if(isNaN(v)||v<=0){if(edMeta){edMeta=false;medirMeta()}return}
        i.disabled=true;const r=await post('/api/meta',{marca:f.marca,valor:v});if(r.ok){edMeta=false;medirMeta()}else{window.V2.toast('Não salvou: '+(r.erro||'erro'));i.disabled=false}};
      i.addEventListener('keydown',e=>{if(e.key==='Enter')salvar();if(e.key==='Escape'){edMeta=false;medirMeta()}});i.addEventListener('blur',salvar)}
  }catch(e){}}

async function resumo(){
  try{const f=window.V2.filtros,d=await fetch(`/api/resumo_geral?marca=${encodeURIComponent(f.marca)}&unidade=${encodeURIComponent(f.unidade)}`).then(r=>r.json()),b=document.getElementById('v-resumo');if(!b)return;
    const it=(go,aba,rot,v)=>`<a class="ri" href="#${go}" data-go="${go}"><small>${aba}</small><span>${rot}</span><b>${v}</b></a>`;
    b.innerHTML=[it('operacao','Operação','Pedidos por dia (média)',N(d.operacao.pedidos_dia_medio)),it('operacao','Operação','Ticket médio',R(d.operacao.ticket_medio)),
      it('clientes','Clientes','Gasto médio por cliente',R(d.clientes.gasto_medio)),it('clientes','Clientes','% clientes recorrentes',d.clientes.pct_recorrentes.toFixed(0)+'%'),
      it('cardapio','Cardápio','Produto mais vendido',esc(d.cardapio.top_produto??'—')),it('cardapio','Cardápio','Cobertura de CMV',d.cardapio.cobertura_cmv.toFixed(0)+'%'),
      it('bairros','Bairros','Condomínio/quadra campeão',d.bairros.nome?`${esc(d.bairros.nome)} (${d.bairros.pct.toFixed(0)}%)`:'—'),it('resultado','DRE','Margem líquida (90d)',d.dre.margem_pct.toFixed(1)+'%')].join('')}catch(e){}}

function desenharPrincipal(d){
  tema();const brasa=css('--brasa'),sob=css('--c-sob');
  const k=d.kpis,f=window.V2.filtros;
  const delta=(a,b)=>{if(+b===0)return '<span class="up">novo</span>';const p=100*(a-b)/b;return `<span class="${p>=0?'up':'down'}">${p>=0?'▲':'▼'} ${Math.abs(p).toFixed(1)}%</span>`};
  const taxa=k.total_geral>0?(100*k.cancelados/k.total_geral).toFixed(1):0,iv=intervalo();
  const c=d.comparacao;
  const canais=d.canais,pedagio=canais.reduce((s,x)=>s+(+x.pedagio||0),0),liq=canais.reduce((s,x)=>s+(+x.liquido||0),0),bruto=canais.reduce((s,x)=>s+(+x.bruto||0),0);
  const semTaxa=canais.filter(x=>x.comissao_pct===null&&x.origem!=='não informado').length;
  const kp=(l,v,s,cl='')=>`<div class="card kpi ${cl}"><div class="k-l">${l}</div><div class="k-v">${v}</div><div class="k-s">${s||'&nbsp;'}</div></div>`;
  document.getElementById('v-kpis').innerHTML=
    kp('Faturamento',R(+k.faturamento),c?`${delta(+k.faturamento,+c.faturamento)} vs ${R(+c.faturamento)}`:(iv.dias>1?`média de ${R(k.faturamento/iv.dias)}/dia`:''),'destaque')+
    kp('Pedidos (vendas)',N(+k.pedidos),c?`${delta(+k.pedidos,+c.pedidos)} vs ${N(+c.pedidos)}`:(iv.dias>1?`média de ${(k.pedidos/iv.dias).toFixed(1)}/dia`:''))+
    kp('Ticket médio',R(+k.ticket),'')+
    kp('Cancelamentos',N(+k.cancelados),c?`período comparado: ${N(+c.cancelados)} (${c.total_geral>0?(100*c.cancelados/c.total_geral).toFixed(1):0}%)`:`${taxa}% dos pedidos`)+
    kp('Líquido após canais',R(liq),pedagio>0?`canais comem ${R(pedagio)} (${(100*pedagio/Math.max(bruto,1)).toFixed(1)}%)`:(semTaxa>0?'cadastre as comissões abaixo':'sem pedágio no período'));

  const eixoR=v=>'R$ '+N(v);
  desenhar('gDia',{type:'line',data:{labels:d.por_dia.map(x=>x.dia.slice(8,10)+'/'+x.dia.slice(5,7)),datasets:[{data:d.por_dia.map(x=>+x.faturamento),fill:true,borderColor:brasa,backgroundColor:brasa+'22',tension:.3,pointRadius:2,borderWidth:2}]},
    options:{maintainAspectRatio:false,plugins:{legend:{display:false},tooltip:{callbacks:{label:c=>R(c.parsed.y)}}},scales:{y:{ticks:{callback:eixoR}}}}});
  const horas=[...Array(24).keys()],porHora=horas.map(h=>(d.por_hora.find(x=>+x.hora===h)?.pedidos)??0),mx=Math.max(...porHora,1);
  desenhar('gHora',{type:'bar',data:{labels:horas.map(h=>h+'h'),datasets:[{data:porHora,backgroundColor:porHora.map(v=>calor(+v,mx)),borderRadius:3}]},options:{maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{x:{ticks:{maxTicksLimit:12}},y:{ticks:{precision:0}}}}});
  desenhar('gProdutos',{type:'bar',data:{labels:d.top_produtos.map(x=>x.nome.length>26?x.nome.slice(0,25)+'…':x.nome),datasets:[{data:d.top_produtos.map(x=>+x.qtd),backgroundColor:brasa,borderRadius:3}]},
    options:{indexAxis:'y',maintainAspectRatio:false,plugins:{legend:{display:false},tooltip:{callbacks:{afterLabel:c=>'Receita: '+R(+d.top_produtos[c.dataIndex].receita)}}},scales:{x:{ticks:{precision:0}}}}});
  desenhar('gSemana',{type:'bar',data:{labels:DIAS_SEM,datasets:[{data:[...Array(7).keys()].map(i=>(d.dia_semana.find(x=>+x.dow===i)?.pedidos)??0),backgroundColor:sob,borderRadius:3}]},options:{maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{y:{ticks:{precision:0}}}}});

  document.getElementById('v-desc').textContent=semTaxa>0?`${semTaxa} canal(is) sem comissão calculada`:'Comissão automática por canal (iFood 15,2% do subtotal · 99Food 3,2% (Chomp 12,1%) · Balcão/Site 3,99%) — % efetivo sobre o bruto';
  document.getElementById('v-canais').innerHTML=`<table><thead><tr><th>Canal</th><th class="r">Pedidos</th><th class="r">Bruto</th><th class="r">Comissão %</th><th class="r">Pedágio</th><th class="r">Líquido</th></tr></thead><tbody>${canais.map(x=>`<tr><td><strong>${esc(CANAL[x.origem]??x.origem)}</strong></td><td class="r">${N(+x.pedidos)}</td><td class="r">${R(+x.bruto)}</td><td class="r">${x.comissao_pct!==null?(+x.comissao_pct).toLocaleString('pt-BR')+'%':'—'}</td><td class="r down">${x.comissao_pct!==null?'−'+R(+x.pedagio):'—'}</td><td class="r up">${x.comissao_pct!==null?R(+x.liquido):'—'}</td></tr>`).join('')}</tbody></table>`;
  document.getElementById('v-atual').innerHTML='<span class="dot" style="display:inline-block;margin-right:6px"></span>Atualizado às '+new Date().toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})+' · dados sincronizados a cada 15 min';
}

const nomeSerie=s=>`${s.marca.replace(' Burger','')} · ${s.unidade==='Colorado'?'GC':s.unidade}`;
function corSerie(s){const k=s.marca+'|'+s.unidade;return {'Maracayá Burger|Colorado':css('--c-gc'),'Maracayá Burger|Sobradinho':css('--c-sob'),'Chomp Burger|Colorado':css('--c-chomp'),'Chomp Burger|Sobradinho':css('--c-chomp')+'99'}[k]||css('--ink-2')}
function desenharMensal(){
  const d=mensal;if(!d||!document.getElementById('gMensal'))return;tema();
  const met=document.getElementById('m-met').value,modo=met==='ticket'?'lado':document.getElementById('m-modo').value;document.getElementById('m-modo').disabled=met==='ticket';
  const dia=+d.hoje.slice(8,10),rot=d.meses.map(m=>`${MES_AB[+m.mes.slice(5)-1]}/${m.mes.slice(2,4)}${m.parcial?` (até ${dia})`:''}${m.historico?' *':''}`);
  document.getElementById('m-nota').textContent=d.meses.some(m=>m.historico)?'* Meses do histórico: faturamento do grupo (arquivo), com o Sobradinho do sistema e o GC como o restante. Antes do sistema não há pedidos do GC, então pedidos e ticket só aparecem a partir de jul/26.':'';
  const val=(s,i)=>met==='faturamento'?s.faturamento[i]:s.pedidos[i]==null?null:met==='pedidos'?s.pedidos[i]:(s.pedidos[i]?s.faturamento[i]/s.pedidos[i]:0);
  const inc=i=>met!=='faturamento'&&d.series.some(s=>s.pedidos[i]==null);
  const fmt=v=>v==null?'—':met==='pedidos'?N(Math.round(v)):R(v);
  desenhar('gMensal',{type:'bar',data:{labels:rot,datasets:d.series.map(s=>({label:nomeSerie(s),data:d.meses.map((_,i)=>val(s,i)),backgroundColor:corSerie(s),borderRadius:3,stack:modo==='empilhado'?'a':undefined}))},
    options:{maintainAspectRatio:false,interaction:{mode:'index',intersect:false},plugins:{legend:{position:'bottom'},tooltip:{callbacks:{label:c=>`${c.dataset.label}: ${fmt(c.parsed.y)}`,footer:it=>met==='ticket'||inc(it[0].dataIndex)?'':`Total: ${fmt(it.reduce((a,c)=>a+c.parsed.y,0))}`}}},
      scales:{x:{stacked:modo==='empilhado'},y:{stacked:modo==='empilhado',ticks:{callback:v=>met==='pedidos'?N(v):'R$ '+N(v)}}}}});
  const tot=d.meses.map((_,i)=>d.series.reduce((a,s)=>a+(met==='ticket'?0:val(s,i)),0));
  const tkt=i=>{const f=d.series.reduce((a,s)=>a+s.faturamento[i],0),p=d.series.reduce((a,s)=>a+s.pedidos[i],0);return p?f/p:0};
  const linhas=d.meses.map((m,i)=>{const t=inc(i)?null:met==='ticket'?tkt(i):tot[i],ant=i>0&&!inc(i-1)?(met==='ticket'?tkt(i-1):tot[i-1]):null,dl=(t!=null&&ant&&!m.parcial)?100*(t-ant)/ant:null;
    return `<tr><td>${rot[i]}</td>${d.series.map(s=>`<td class="r">${fmt(val(s,i))}</td>`).join('')}<td class="r"><strong>${fmt(t)}</strong></td><td class="r ${dl==null?'':dl>=0?'up':'down'}">${dl==null?'—':(dl>=0?'▲ ':'▼ ')+Math.abs(dl).toFixed(0)+'%'}</td></tr>`}).reverse().join('');
  document.getElementById('m-tab').innerHTML=`<table><thead><tr><th>Mês</th>${d.series.map(s=>`<th class="r">${nomeSerie(s)}</th>`).join('')}<th class="r">${met==='ticket'?'Geral':'Total'}</th><th class="r">vs mês anterior</th></tr></thead><tbody>${linhas}</tbody></table>`;
}
function hero(){
  const d=mensal,b=document.getElementById('v-hero');if(!d||!b)return;
  const tt=d.meses.map((m,i)=>({m,t:d.series.reduce((a,s)=>a+s.faturamento[i],0)})),p=tt[0],fe=tt.filter(x=>!x.m.parcial),u=fe[fe.length-1];
  if(!p||!u||u===p||p.t<=0)return;
  const pct=100*(u.t-p.t)/p.t,nm=x=>`${MES_AB[+x.m.mes.slice(5)-1]}/${x.m.mes.slice(2,4)}`,ac=tt.reduce((a,x)=>a+x.t,0),ano=d.hoje.slice(0,4);
  b.innerHTML=`<div class="h-big">${pct>=0?'+':''}${pct.toFixed(0)}%</div><div><h3 style="font-size:17px">${pct>=0?`A empresa cresceu ${pct.toFixed(0)}% em ${ano}, até o momento`:`A empresa recuou ${Math.abs(pct).toFixed(0)}% em ${ano}, até o momento`}</h3>
   <p class="hint" style="margin:4px 0 0">Faturamento mensal: <b style="color:var(--ink)">${R(p.t)}</b> em ${nm(p)} → <b style="color:var(--ink)">${R(u.t)}</b> em ${nm(u)} (último mês fechado).<br>Acumulado de ${ano} até hoje: <b style="color:var(--ink)">${R(ac)}</b></p></div>
   ${d.funcionarios?`<div class="h-time"><b>${d.funcionarios}</b><small>funcionários hoje</small></div>`:''}`;b.hidden=false}

async function carregarMensal(){try{mensal=await fetch('/api/faturamento_mensal?meses=12').then(r=>r.json());desenharMensal();hero()}catch(e){}}
async function carregar(){
  if(!el||!document.getElementById('v-kpis'))return;
  medirMeta();vigiar();resumo();
  try{dados=await fetch(urlDados()).then(r=>r.json());desenharPrincipal(dados)}
  catch(e){document.getElementById('v-kpis').innerHTML='<div class="card"><h3>Não foi possível carregar</h3><p class="hint">Tente de novo em instantes.</p></div>'}
}

function ligar(){
  document.addEventListener('change',e=>{const t=e.target;if(!ativoAgora())return;
    if(t.id==='v-ini'||t.id==='v-fim'){let i=document.getElementById('v-ini').value,f=document.getElementById('v-fim').value;
      if(i&&!f){f=new Date().toISOString().slice(0,10)}if(f&&!i)i=f;if(!i||!f)return;if(i>f)[i,f]=[f,i];
      custom.ini=i;custom.fim=f;esqueleto();desenharMensalLogo();carregar();return}
    if(t.id==='v-cini'||t.id==='v-cfim'){const i=document.getElementById('v-cini').value,f=document.getElementById('v-cfim').value;if(i&&f){custom.cIni=i;custom.cFim=f;carregar()}return}
    if(t.id==='m-met'||t.id==='m-modo')desenharMensal()});
  document.addEventListener('click',e=>{if(!ativoAgora())return;
    let b;
    if(b=e.target.closest('#v-limpar')){custom.ini=custom.fim='';esqueleto();desenharMensalLogo();carregar();return}
    if(b=e.target.closest('#v-comp')){custom.comp=!custom.comp;if(!custom.comp)custom.cIni=custom.cFim='';esqueleto();desenharMensalLogo();carregar();return}
    if(e.target.closest('#v-edmeta')){edMeta=true;medirMeta()}});
  window.addEventListener('v2tema',()=>{if(ativoAgora()&&dados){desenharPrincipal(dados);desenharMensal()}});
}
function desenharMensalLogo(){hero();if(mensal)desenharMensal()}
window.V2.screens.vendas={
  render(c){el=c;ativo=true;if(!ligado){ligar();ligado=true}clearInterval(timer);esqueleto();
    carregarChart().then(()=>{tema();carregar();carregarMensal()}).catch(()=>{c.innerHTML='<div class="card"><h3>Gráficos indisponíveis</h3><p class="hint">Não foi possível carregar a biblioteca de gráficos.</p></div>'});
    timer=setInterval(()=>{if(ativoAgora())carregar();else clearInterval(timer)},5*60*1000)},
  onFiltros(){carregar()}};
})();
