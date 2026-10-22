/* Painel 2.0 — tela Resultado (DRE): junta Performance + DRE + cancelamentos + detalhe por pedido + despesas fixas */
(function(){
const R=v=>(+(v??0)).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
const R0=v=>(+(v??0)).toLocaleString('pt-BR',{style:'currency',currency:'BRL',maximumFractionDigits:0});
const N=v=>(+(v??0)).toLocaleString('pt-BR');
const esc=t=>String(t??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;');
const post=(url,corpo)=>fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(corpo)}).then(r=>r.json());
const css=n=>getComputedStyle(document.documentElement).getPropertyValue(n).trim();
const ativoAgora=()=>!!document.getElementById('r-kpis');
const CANAIS=[['todos','Todos os canais'],['ifood','iFood'],['99food','99 Food'],['balcao','Balcão'],['site','Site']];
const fmtData=iso=>new Date(iso).toLocaleString('pt-BR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'});
const fmtCurta=iso=>new Date(iso+'T00:00:00').toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit'});
const TIPO_FRETE={gratis:'Frete grátis — repasse integral ao motoboy',tabela:'Custo de entrega (repasse − frete pago)',site:'Motoboy do Site',chomp:'Logística da plataforma',estimado:'Custo de entrega (estimado pela média)'};

let el=null,ligado=false,canal='todos',comparar=false,dre=null,pedidos=[],gCanc=null,fixas=null,timer=null;

const periodo=()=>{const p=window.V2.filtros.periodo;return p==='1'?'hoje':p};
const q=()=>{const f=window.V2.filtros;return `marca=${encodeURIComponent(f.marca)}&unidade=${encodeURIComponent(f.unidade)}&periodo=${periodo()}&canal=${canal}`};
const linha=(L,pre)=>L.find(l=>l.rotulo.startsWith(pre))?.valor??0;
const mesRef=()=>{const h=new Date(),p=periodo(),d=p==='mes_passado'?new Date(h.getFullYear(),h.getMonth()-1,1):new Date(h.getFullYear(),h.getMonth(),1);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`};
const mesNome=m=>{const [a,n]=m.split('-');return new Date(+a,+n-1,1).toLocaleDateString('pt-BR',{month:'long',year:'numeric'})};
function carregarChart(){if(window.Chart)return Promise.resolve();return new Promise((ok,err)=>{const s=document.createElement('script');s.src='https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js';s.onload=ok;s.onerror=err;document.head.appendChild(s)})}

function delta(a,b,pontos){
  if(!comparar||(a===0&&b===0))return '';
  let cls,txt;
  if(pontos){const d=a-b;cls=d>=0?'up':'down';txt=`${d>=0?'+':''}${d.toFixed(1)} p.p.`}
  else if(b===0){cls='up';txt='novo'}else{const p=100*(a-b)/b;cls=p>=0?'up':'down';txt=`${p>=0?'+':''}${p.toFixed(0)}%`}
  return `<span class="${cls}"><b>${cls==='up'?'▲':'▼'} ${txt}</b> <small class="mut">vs período anterior</small></span>`;
}

function esqueleto(){
  el.innerHTML=`<div class="g">
  <div class="card s12 ctrl-per"><div class="filters"><span class="lbl">Canal</span><div class="seg" id="r-canal" style="width:auto;flex-wrap:wrap">${CANAIS.map(([v,l])=>`<button data-canal="${v}" aria-pressed="${v===canal}">${l}</button>`).join('')}</div>
   <label class="chk2" style="margin-left:auto"><input type="checkbox" id="r-comp" ${comparar?'checked':''}> Comparar com período anterior</label></div><p class="hint" id="r-faixa" style="margin:8px 0 0"></p></div>
  <div class="s12 kpis5" id="r-kpis"></div>
  <div class="card s12" id="r-resumo"></div>
  <div class="card s7" id="dre"><h3>Demonstrativo do resultado <span class="info2" title="Do bruto ao que sobra, linha a linha. CMV vem dos custos cadastrados no Cardápio; a fatia sem custo é estimada pela média dos mapeados. Comissões vêm do pedágio da Vendas. Impostos e custo de entrega são os parâmetros ao lado.">?</span></h3><p class="hint" id="r-desc"></p><div id="r-dre"></div></div>
  <div class="s5" style="display:grid;gap:16px;align-content:start">
   <div class="card kpi destaque" id="r-lucro"></div>
   <div class="card" id="parametros"><h3>Parâmetros</h3><p class="hint">Digite e tecle Enter — o DRE recalcula na hora.</p><div class="params" id="r-params"></div></div>
  </div>
  <div class="sec" id="custos">Custos e despesas</div>
  <div class="card s6"><h3>Custos e promoções</h3><div id="r-bars"></div><p class="hint" style="margin:10px 0 0">Promoção da loja: desconto custeado pela Maracayá (já descontado no lucro). Promoção do iFood: investimento do iFood — informativo, não afeta o lucro.</p></div>
  <div class="card s6" id="fixas"><h3>Despesas fixas do mês <span class="ex">novo</span></h3><p class="hint" id="r-fixas-hint"></p><div id="r-fixas"></div></div>
  <div class="sec" id="cancel">Cancelamentos</div>
  <div class="card s12"><h3>Análise dos cancelamentos por motivo</h3><p class="hint" id="r-canc-res">Carregando…</p>
   <div class="canc-grid"><div class="area"><canvas id="gCanc"></canvas></div><div class="tw"><table><thead><tr><th>Motivo</th><th class="r">Faturamento</th><th class="r">Pedidos</th><th class="r">Ticket médio</th></tr></thead><tbody id="r-canc"></tbody></table></div></div></div>
  <div class="sec" id="pedidos">Pedidos</div>
  <div class="card s12"><h3>Detalhamento dos pedidos</h3><p class="hint">Margem líquida por pedido (mesmas regras do DRE). Toque numa linha pra abrir a conta do pedido.</p>
   <div class="tw"><table><thead><tr><th>Pedido</th><th class="hide-m">Data</th><th>Canal</th><th class="r hide-m">Subtotal</th><th class="r hide-m">Desc. loja</th><th class="r hide-m">Comissão + taxa</th><th class="r hide-m">CMV</th><th class="r hide-m">Frete</th><th class="r">Lucro</th><th class="r">Margem</th></tr></thead><tbody id="r-ped"><tr><td colspan="10" class="mut">Carregando…</td></tr></tbody></table></div></div>
  <p class="hint s12" id="r-atual" style="margin:0"></p></div>`;
  window.V2.setJump([['dre','DRE'],['custos','Custos'],['cancel','Cancelamentos'],['pedidos','Pedidos']]);
}

async function carregarDre(){
  const d=await fetch(`/api/dre?${q()}&comparar=${comparar?1:0}`).then(r=>r.json());dre=d;
  const L=d.linhas,res=d.resumo,cmp=d.comparacao,vendas=linha(L,'Vendas cheias'),cmv=linha(L,'CMV'),ped=res.pedidos||0,rr=res.repasse_real;
  const per=document.querySelector('#filters #f-per option:checked')?.textContent||'';
  document.getElementById('r-faixa').textContent=`${per}${canal!=='todos'?' · '+CANAIS.find(c=>c[0]===canal)[1]:''}${window.V2.filtros.marca!=='todas'?' · '+window.V2.filtros.marca:''}${cmp?` · vs ${fmtCurta(cmp.inicio)}–${fmtCurta(cmp.fim)}`:''}`;
  const kp=(l,v,dl,subs)=>`<div class="card kpi"><div class="k-l">${l}</div><div class="k-v">${v}</div><div class="k-s">${dl||'&nbsp;'}</div>${subs.map(s=>`<div class="k-s">${s[0]}: <b style="color:var(--ink)">${s[1]}</b></div>`).join('')}</div>`;
  document.getElementById('r-kpis').innerHTML=
    kp('Repasse real',R(rr),cmp?delta(rr,cmp.repasse_real):'',[['Repasse por pedido',R(ped?rr/ped:0)]])+
    kp('Lucro total',R(res.lucro),cmp?delta(res.lucro,cmp.lucro):'',[['Margem s/ subtotal',res.margem.toFixed(1)+'%'],['Lucro médio/pedido',R(ped?res.lucro/ped:0)]])+
    kp('Margem média',res.margem.toFixed(1)+'%',cmp?delta(res.margem,cmp.margem,true):'',[['Ticket médio',R(ped?vendas/ped:0)],['Pedidos',N(ped)]])+
    kp('Pedidos',N(ped),cmp?delta(ped,cmp.pedidos):'',[['Valor bruto total',R(vendas)],['CMV',R(cmv)]]);
  const canalTxt=canal==='ifood'?'iFood':canal==='99food'?'99Food':'dos canais';
  document.getElementById('r-resumo').innerHTML=`<div class="tres"><div><h3>Repasse e lucro</h3><p>O período fechou com <b>${R(rr)}</b> de repasse real ${canal==='todos'?'dos canais':'do '+canalTxt} (já com descontos da loja) e <b>${R(res.lucro)}</b> de lucro líquido.</p></div>
   <div><h3>Custos e comissões</h3><p>Comissão de marketplace somou <b>${R(res.comissao)}</b> e taxa de transação/adquirência <b>${R(res.taxa_transacao)}</b>. Custo de frete ficou em <b>${R(res.custo_frete)}</b> no período.</p></div>
   <div><h3>Promoções</h3><p>A loja custeou <b>${R(res.promo_loja)}</b> em descontos, enquanto o iFood investiu <b>${R(res.promo_ifood)}</b> em promoções próprias — valor que não afeta o lucro da Maracayá.</p></div></div>`;
  const avisos=[];
  if(res.cobertura_cmv<90)avisos.push(`CMV com ${res.cobertura_cmv.toFixed(0)}% de cobertura — cadastre os custos que faltam no Cardápio`);
  if(+res.bruto_sem_taxa>0)avisos.push('há canais sem comissão cadastrada (Vendas → pedágio)');
  if((d.config.imposto_pct??0)===0)avisos.push('imposto está em 0% — configure ao lado');
  document.getElementById('r-desc').textContent=avisos.length?'⚠️ Pra ficar fiel: '+avisos.join(' · '):'Lucro bruto estimado — antes das despesas fixas. DRE gerencial simplificado, não substitui a contabilidade oficial.';
  desenharDre();
  const params=document.getElementById('r-params');
  if(!params.contains(document.activeElement))params.innerHTML=`<label>Imposto sobre receita <small>ex: Simples Nacional</small><span><input class="cin" data-cfg="imposto_pct" type="number" step="0.1" min="0" max="40" value="${d.config.imposto_pct??''}"> %</span></label>
    <label>Custo por entrega <small>motoboy, por pedido delivery</small><span>R$ <input class="cin" data-cfg="custo_entrega" type="number" step="0.5" min="0" value="${d.config.custo_entrega??''}"></span></label>`;
  const bars=[['CMV',res.cmv],['Custo de frete',res.custo_frete],['Taxa de transação',res.taxa_transacao],['Comissão marketplace',res.comissao],['Promoção da loja',res.promo_loja],['Promoção do iFood',res.promo_ifood,1]];
  const mx=Math.max(...bars.map(b=>b[1]),1);
  document.getElementById('r-bars').innerHTML=bars.map(b=>`<div class="hbar"><span>${b[0]}</span><span class="hb"><i style="width:${Math.max(2,100*b[1]/mx)}%;${b[2]?'background:var(--ink-2)':''}"></i></span><b>${R0(b[1])}</b></div>`).join('');
  document.getElementById('r-atual').innerHTML='<span class="dot" style="display:inline-block;margin-right:6px"></span>Atualizado às '+new Date().toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})+' · DRE gerencial simplificado — não substitui a contabilidade oficial';
}

function desenharDre(){
  const d=dre;if(!d||!document.getElementById('r-dre'))return;
  const p=periodo(),mes=(p==='mes_atual'||p==='mes_passado')?mesRef():null;
  let extra='',fx=null;
  if(mes&&fixas&&fixas.mes.startsWith(mes)&&fixas.total>0){
    let tot=fixas.total,nota=`Despesas cadastradas pra ${mesNome(mes)}`;
    if(p==='mes_atual'){const h=new Date(),dm=new Date(h.getFullYear(),h.getMonth()+1,0).getDate();tot=fixas.total*h.getDate()/dm;nota+=` · proporcional aos ${h.getDate()} de ${dm} dias do mês`}
    fx=tot;
  }
  const lucro=d.resumo.lucro;
  const rows=d.linhas.map(l=>{const fin=l.rotulo.startsWith('Lucro'),tot=l.t==='=';
    return `<div class="dre-l ${fin||tot?'soma':''}"><div><span>${l.t==='-'&&!fin&&!tot?'(−) ':''}${esc(l.rotulo)}</span>${l.nota?`<small>${esc(l.nota)}</small>`:''}</div><b>${l.t==='-'?'−':''}${R(Math.abs(l.valor))}</b></div>`}).join('');
  const fixasRows=fx!=null?`<div class="dre-l"><div><span>(−) Despesas fixas</span><small>${esc(`Despesas cadastradas pra ${mesNome(mes)}${p==='mes_atual'?' · proporcional aos dias do mês':''}`)}</small></div><b>−${R(fx)}</b></div>
    <div class="dre-l soma final"><div><span>= Lucro líquido real</span></div><b class="${lucro-fx>=0?'up':'down'}">${R(lucro-fx)}</b></div>`
    :(mes?`<p class="hint" style="margin:8px 0 0">Cadastre as despesas fixas do mês (card <b>Despesas fixas</b>, abaixo) pra ver o lucro líquido real aqui.</p>`:`<p class="hint" style="margin:8px 0 0">Pra ver o lucro líquido real (com despesas fixas), escolha <b>Este mês</b> ou <b>Mês passado</b> no filtro de período.</p>`);
  document.getElementById('r-dre').innerHTML=rows+fixasRows;
  const L=document.getElementById('r-lucro'),real=fx!=null?lucro-fx:null;
  L.innerHTML=`<div class="k-l">Sobrou na chapa</div><div class="k-v ${lucro>=0?'up':'down'}">${R(lucro)}</div><div class="k-s">margem de <b style="color:var(--ink)">${d.resumo.margem.toFixed(1)}%</b> · ${N(d.resumo.pedidos)} pedidos</div>${real!=null?`<div class="k-s" style="margin-top:6px">Lucro líquido real: <b class="${real>=0?'up':'down'}">${R(real)}</b></div>`:''}`;
}

async function carregarFixas(){
  const mes=mesRef();
  try{fixas=await fetch('/api/despesas_fixas?mes='+mes).then(r=>r.json())}catch(e){return}
  const b=document.getElementById('r-fixas');if(!b)return;
  document.getElementById('r-fixas-hint').textContent=`${mesNome(mes)} · aluguel, folha, contas — pra fechar o lucro real no DRE`;
  b.innerHTML=`${fixas.itens.length?`<div class="tw"><table><tbody>${fixas.itens.map(i=>`<tr><td>${esc(i.descricao)}</td><td class="r"><input class="cin" data-fx="${esc(i.descricao)}" type="number" step="50" min="0" value="${i.valor}" aria-label="Valor de ${esc(i.descricao)}"></td><td class="r"><button class="ib" data-fxdel="${i.id}" aria-label="Remover ${esc(i.descricao)}">✕</button></td></tr>`).join('')}<tr><td><strong>Total</strong></td><td class="r"><strong>${R(fixas.total)}</strong></td><td></td></tr></tbody></table></div>`:'<p class="hint">Nenhuma despesa cadastrada neste mês ainda.</p>'}
   <form class="filters" id="r-fxform" style="margin-top:10px"><input id="fx-d" maxlength="60" placeholder="ex: Aluguel" required style="flex:1;min-width:120px"><input id="fx-v" class="cin" type="number" step="50" min="0" placeholder="R$" required style="width:110px"><button class="btn brasa">Adicionar</button></form>`;
  desenharDre();
}

async function carregarCanc(){
  const d=await fetch(`/api/cancelamentos?${q()}`).then(r=>r.json()),m=d.motivos,res=d.resumo;
  const taxa=res.total_pedidos?100*res.cancelados/res.total_pedidos:0;
  document.getElementById('r-canc-res').innerHTML=m.length?`<b style="color:var(--ink)">${N(res.cancelados)}</b> pedidos cancelados no período (<b style="color:var(--ink)">${taxa.toFixed(1)}%</b> do total) · <b style="color:var(--ink)">${R(res.perdido)}</b> em faturamento perdido`:'Nenhum cancelamento no período 🎉';
  const cores=[css('--c-gc'),css('--c-chomp'),css('--brasa-ink'),css('--ok'),'#9B6EF3','#E85D75',css('--c-sob'),css('--ink-2')];
  if(gCanc)gCanc.destroy();
  gCanc=new Chart(document.getElementById('gCanc'),{type:'doughnut',data:{labels:m.map(x=>x.motivo),datasets:[{data:m.map(x=>+x.faturamento),backgroundColor:m.map((_,i)=>cores[i%cores.length]),borderColor:css('--surface'),borderWidth:2}]},
    options:{maintainAspectRatio:false,plugins:{legend:{display:false},tooltip:{callbacks:{label:c=>`${c.label}: ${R(c.raw)}`}}}}});
  document.getElementById('r-canc').innerHTML=m.length?m.map((x,i)=>`<tr><td class="wrap"><i class="bol" style="background:${cores[i%cores.length]}"></i><span class="trunc" title="${esc(x.motivo)}">${esc(x.motivo)}</span></td><td class="r">${R(x.faturamento)}</td><td class="r">${N(x.pedidos)}</td><td class="r">${R(x.ticket)}</td></tr>`).join(''):'<tr><td colspan="4" class="mut">Sem cancelamentos no período.</td></tr>';
}

async function carregarPedidos(){
  const d=await fetch(`/api/pedidos_lucro?${q()}`).then(r=>r.json());pedidos=d.pedidos;
  document.getElementById('r-ped').innerHTML=pedidos.length?pedidos.map((p,i)=>`<tr class="clk" data-ped="${i}"><td>#${p.numero??p.id}</td><td class="hide-m">${fmtData(p.data)}</td><td>${esc(p.origem??'—')}</td><td class="r hide-m">${R(p.subtotal)}</td><td class="r hide-m">${R(p.desconto_loja)}</td><td class="r hide-m">${R(p.comissao+p.taxa_transacao)}</td><td class="r hide-m">${R(p.cmv)}</td><td class="r hide-m">${R(p.frete)}</td><td class="r"><strong class="${p.lucro<0?'down':''}">${R(p.lucro)}</strong></td><td class="r"><span class="pill ${p.margem<0?'p-bad':p.margem<30?'p-warn':'p-ok'}">${p.margem.toFixed(1)}%</span></td></tr>`).join(''):'<tr><td colspan="10" class="mut">Sem pedidos no período.</td></tr>';
}

async function abrirPedido(tr){
  const nx=tr.nextElementSibling;if(nx&&nx.classList.contains('det')){nx.remove();return}
  document.querySelectorAll('#r-ped tr.det').forEach(x=>x.remove());
  const p=pedidos[+tr.dataset.ped],ln=(r,v,c='')=>`<div class="dre-l ${c}"><div><span>${r}</span></div><b>${v}</b></div>`;
  const row=document.createElement('tr');row.className='det';
  row.innerHTML=`<td colspan="10" class="wrap"><div class="det-grid"><div><p class="hint" style="margin:0 0 6px">#${p.numero??p.id} · ${fmtData(p.data)} · ${esc(p.origem??'—')} · ${esc(p.marca??'')} · ${esc(p.tipo)}</p>
   ${ln('Subtotal',R(p.subtotal))}${ln(p.marca==='Chomp Burger'?'Entrega cobrada (fica com a plataforma)':'(+) Entrega cobrada',R(p.entrega_cobrada))}${ln('(−) Desconto da loja','−'+R(p.desconto_loja))}
   ${p.desconto_ifood>0?ln('Promoção do iFood (paga pelo iFood — não afeta)',R(p.desconto_ifood)):''}${ln('= Receita realizada',R(p.receita),'soma')}
   ${ln('(−) Comissão do marketplace','−'+R(p.comissao))}${ln('(−) Taxa de transação / adquirência','−'+R(p.taxa_transacao))}${ln('(−) Impostos','−'+R(p.imposto))}${ln('(−) CMV','−'+R(p.cmv))}
   ${ln('(−) '+(TIPO_FRETE[p.tipo_frete]||'Custo de entrega'),'−'+R(p.frete))}${ln(`= Lucro · margem ${p.margem.toFixed(1)}% s/ subtotal`,R(p.lucro),'soma')}</div>
   <div><table><thead><tr><th>Item</th><th class="r">Qtd</th><th class="r">Venda</th><th class="r">Custo</th></tr></thead><tbody id="det-itens"><tr><td colspan="4" class="mut">Carregando…</td></tr></tbody></table></div></div></td>`;
  tr.after(row);
  const it=await fetch('/api/pedido_itens?pedido_id='+p.id).then(r=>r.json());
  const b=row.querySelector('#det-itens');if(b)b.innerHTML=it.map(i=>`<tr><td class="wrap">${esc(i.nome)}</td><td class="r">${N(i.quantidade)}</td><td class="r">${R(i.total)}</td><td class="r">${i.custo_total!=null?R(i.custo_total):'<span class="pill p-warn">sem custo</span>'}</td></tr>`).join('');
}

async function carregar(){
  if(!ativoAgora())return;
  try{await Promise.all([carregarDre(),carregarFixas(),carregarCanc(),carregarPedidos()]);desenharDre()}
  catch(e){const k=document.getElementById('r-kpis');if(k)k.innerHTML='<div class="card"><h3>Não foi possível carregar</h3><p class="hint">Tente de novo em instantes.</p></div>'}
}

function ligar(){
  document.addEventListener('click',async e=>{if(!ativoAgora())return;let b;
    if(b=e.target.closest('[data-canal]')){canal=b.dataset.canal;document.querySelectorAll('#r-canal button').forEach(x=>x.setAttribute('aria-pressed',x===b));carregar();return}
    if(b=e.target.closest('[data-fxdel]')){if(!confirm('Remover esta despesa?'))return;await post('/api/despesas_fixas_delete',{id:+b.dataset.fxdel});carregarFixas();return}
    if(b=e.target.closest('tr[data-ped]')){abrirPedido(b)}});
  document.addEventListener('change',async e=>{if(!ativoAgora())return;const t=e.target;
    if(t.id==='r-comp'){comparar=t.checked;carregarDre();return}
    if(t.dataset.cfg){const v=parseFloat(t.value);if(isNaN(v)||v<0)return;const r=await post('/api/dre_config',{chave:t.dataset.cfg,valor:v});if(r.ok){t.style.borderColor='var(--ok)';setTimeout(()=>{carregarDre().then(carregarPedidos)},300)}return}
    if(t.dataset.fx!==undefined){const v=parseFloat(t.value);if(isNaN(v)||v<0)return;const r=await post('/api/despesas_fixas',{mes:mesRef(),descricao:t.dataset.fx,valor:v});if(r.ok)carregarFixas();return}});
  document.addEventListener('keydown',e=>{if(ativoAgora()&&e.key==='Enter'&&e.target.matches('#r-params input,[data-fx]'))e.target.blur()});
  document.addEventListener('submit',async e=>{if(e.target.id!=='r-fxform')return;e.preventDefault();
    const r=await post('/api/despesas_fixas',{mes:mesRef(),descricao:document.getElementById('fx-d').value,valor:document.getElementById('fx-v').value});
    if(r.ok){window.V2.toast('Despesa salva');carregarFixas()}else window.V2.toast(r.erro||'Não foi possível salvar')});
  window.addEventListener('v2tema',()=>{if(ativoAgora())carregarCanc()});
}
window.V2.screens.resultado={
  render(c){el=c;if(!ligado){ligar();ligado=true}clearInterval(timer);esqueleto();
    carregarChart().then(carregar).catch(()=>{});
    timer=setInterval(()=>{if(ativoAgora())carregar();else clearInterval(timer)},5*60*1000)},
  onFiltros(){carregar()}};
})();
