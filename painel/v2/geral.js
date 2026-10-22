/* Painel 2.0 — tela Visão geral (sócio): principais números do período + alertas calculados na hora */
(function(){
const R=v=>(+(v??0)).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
const R0=v=>(+(v??0)).toLocaleString('pt-BR',{style:'currency',currency:'BRL',maximumFractionDigits:0});
const N=v=>(+(v??0)).toLocaleString('pt-BR');
const N1=v=>(+(v??0)).toLocaleString('pt-BR',{maximumFractionDigits:1});
const esc=t=>String(t??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;');
const J=u=>fetch(u).then(r=>r.json());
const CANAL={ifood:'iFood',site:'Site próprio',portal:'Portal (balcão)',catalog:'Catálogo/Link',whatsapp:'WhatsApp',chatbot:'Chatbot',app:'App',food99:'99Food','99food':'99Food',rappi:'Rappi',aiqfome:'Aiqfome',keeta:'Keeta'};
const MESN=['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];
const ativoAgora=()=>!!document.getElementById('g-root');
const SEV={bad:0,warn:1,ok:2};
let el=null,timer=null,seq=0,alertas=[];

const periodoDre=()=>{const p=window.V2.filtros.periodo;return p==='1'?'hoje':p};
const qDre=()=>{const f=window.V2.filtros;return `marca=${encodeURIComponent(f.marca)}&unidade=${encodeURIComponent(f.unidade)}&periodo=${periodoDre()}`};
const alerta=(sev,titulo,texto,botao,go)=>({sev,titulo,texto,botao,go});
function pintarAlertas(){
  const b=document.getElementById('g-alertas');if(!b)return;
  const lista=[...alertas].sort((a,c)=>SEV[a.sev]-SEV[c.sev]);
  const n=lista.filter(a=>a.sev!=='ok').length;
  document.getElementById('g-alertas-t').textContent=carregandoLento?`${n} alerta(s) até agora · conferindo estoque e clientes…`:(n?`${n} ponto(s) pedindo atenção`:'Nenhum alerta agora 🎉');
  b.innerHTML=lista.map(a=>`<div class="act ${a.sev==='ok'?'ok':a.sev}"><div><h4>${a.titulo}</h4><p>${a.texto}</p></div>${a.go?`<a class="btn" href="#${a.go}" data-go="${a.go}">${a.botao}</a>`:''}</div>`).join('');
}
let carregandoLento=false;

async function render(c){
  el=c;const meu=++seq,f=window.V2.filtros;alertas=[];carregandoLento=true;
  el.innerHTML='<div id="g-root"><div class="card"><p class="hint" style="margin:0">Montando a visão geral…</p></div></div>';window.V2.setJump([]);
  const [dre,mb,dados,meta,sent,op]=await Promise.all([
    J(`/api/dre?${qDre()}&comparar=1`).catch(()=>null),J(`/api/margem_baixa?${qDre()}`).catch(()=>null),
    J('/api/dados?'+window.V2.qs()).catch(()=>null),J('/api/meta').catch(()=>null),J('/api/sentinela').catch(()=>null),
    J(`/api/operacao?marca=${encodeURIComponent(f.marca)}&unidade=${encodeURIComponent(f.unidade)}&periodo=60`).catch(()=>null)]);
  if(meu!==seq||!ativoAgora()&&!el)return;
  const per=document.querySelector('#filters #f-per option:checked')?.textContent||'período';
  const res=dre&&dre.resumo,cmp=dre&&dre.comparacao,k=dados&&dados.kpis,L=dre?dre.linhas:[];
  const linha=p=>L.find(l=>l.rotulo.startsWith(p))?.valor??0;
  const vendas=linha('Vendas cheias'),desc=linha('Descontos');
  /* ---- alertas rápidos ---- */
  if(mb&&mb.baixas>0)alertas.push(alerta(mb.prejuizo>0?'bad':'warn',`${mb.baixas} pedido(s) com margem abaixo de ${N1(mb.minimo)}%`,
    `${mb.prejuizo>0?`<b>${mb.prejuizo} no prejuízo</b> (perda de ${R(mb.perda)}). `:''}De ${N(mb.total)} pedidos no período. Piores: ${mb.piores.map(p=>`#${esc(p.numero??p.id)} ${esc(CANAL[p.origem]??p.origem??'')} ${N1(p.margem)}%`).join(' · ')}.`,'Ver pedidos','resultado'));
  else if(mb)alertas.push(alerta('ok','Margem em dia',`Nenhum pedido abaixo de ${N1(mb.minimo)}% de margem no período (${N(mb.total)} pedidos).`));
  if(k&&k.total_geral>0){const t=100*k.cancelados/k.total_geral;if(t>3)alertas.push(alerta(t>6?'bad':'warn',`Cancelamentos em ${t.toFixed(1)}%`,`${N(k.cancelados)} de ${N(k.total_geral)} pedidos cancelados no período.`,'Ver motivos','resultado'))}
  if(res){
    if(res.cobertura_cmv<90)alertas.push(alerta('warn','CMV com cobertura baixa',`Só ${res.cobertura_cmv.toFixed(0)}% da receita tem custo cadastrado; o resto é estimado pela média. Cadastre os custos que faltam.`,'Abrir cardápio','cardapio'));
    if(+res.bruto_sem_taxa>0)alertas.push(alerta('warn','Canal sem comissão cadastrada',`Há vendas em canais sem comissão cadastrada, o lucro desses pedidos está superestimado.`,'Ver vendas','vendas'));
    if((dre.config.imposto_pct??0)===0)alertas.push(alerta('warn','Imposto em 0%','O DRE está sem imposto configurado, então o lucro fica maior do que o real.','Abrir DRE','resultado'));
    if(vendas>0&&desc/vendas>0.1)alertas.push(alerta('warn',`Descontos da loja em ${(100*desc/vendas).toFixed(0)}% das vendas`,`A loja bancou ${R0(desc)} em descontos no período.`,'Ver resultado','resultado'));
  }
  const sv=op&&op.semana_vs;if(sv&&+sv.anterior>0){const p=100*(sv.atual-sv.anterior)/sv.anterior;
    if(p<=-15)alertas.push(alerta(p<=-30?'bad':'warn',`Semana ${Math.abs(p).toFixed(0)}% abaixo da anterior`,`${N(sv.atual)} pedidos até agora contra ${N(sv.anterior)} no mesmo ponto da semana passada.`,'Ver operação','operacao'))}
  if(meta&&meta.meta!=null&&!meta.no_ritmo&&meta.realizado<meta.meta)alertas.push(alerta('warn',`Meta de ${MESN[new Date().getMonth()]} fora do ritmo`,`Projeção de ${R0(meta.projecao)} contra ${R0(meta.meta)}; precisa de ${R0(meta.necessario_por_dia)}/dia nos ${meta.dias_restantes} dias que restam.`,'Ver vendas','vendas'));
  if(sent&&sent.status!=='ok')sent.alertas.forEach(a=>alertas.push(alerta(sent.status==='critico'?'bad':'warn',`${a.icone} Sentinela`,a.texto+(a.dica?` <span class="mut">· ${a.dica}</span>`:''))));
  /* ---- números ---- */
  const dl=(a,b,pts)=>{if(!cmp||(a===0&&b===0))return '';let c,t;if(pts){const d=a-b;c=d>=0?'up':'down';t=`${d>=0?'+':''}${d.toFixed(1)} p.p.`}else if(!b){c='up';t='novo'}else{const p=100*(a-b)/b;c=p>=0?'up':'down';t=`${p>=0?'+':''}${p.toFixed(0)}%`}return `<span class="${c}"><b>${c==='up'?'▲':'▼'} ${t}</b> <small class="mut">vs período anterior</small></span>`};
  const kp=(l,v,s,cl='')=>`<div class="card kpi ${cl}"><div class="k-l">${l}</div><div class="k-v">${v}</div><div class="k-s">${s||'&nbsp;'}</div></div>`;
  const nomeUn=f.unidade==='todas'?'todas as unidades':f.unidade,nomeMc=f.marca==='todas'?'todas as marcas':f.marca;
  const dias=dados?dados.por_dia:[];const mx=Math.max(...dias.map(x=>+x.faturamento),1);
  const totC=dados?dados.canais.reduce((a,c)=>a+(+c.pedidos),0):0;
  const html=`<div id="g-root" class="g">
  <div class="s12" style="font-size:12.5px;color:var(--ink-2)">Visão geral · <b style="color:var(--ink)">${esc(per)}</b> · ${esc(nomeUn)} · ${esc(nomeMc)}</div>
  <div class="card s12" id="alertas"><h3>Alertas</h3><p class="hint" id="g-alertas-t">Calculando…</p><div class="actions" id="g-alertas"></div></div>
  <div class="s12 kpis5">
   ${kp('Faturamento',k?R0(k.faturamento):'—',k&&dias.length>1?`média de ${R0(k.faturamento/dias.length)}/dia`:'','destaque')}
   ${kp('Pedidos',k?N(k.pedidos):'—',cmp&&res?dl(res.pedidos,cmp.pedidos):(k&&dias.length>1?`média de ${N1(k.pedidos/dias.length)}/dia`:''))}
   ${kp('Ticket médio',k?R(k.ticket):'—','')}
   ${kp('Lucro',res?R0(res.lucro):'—',cmp&&res?dl(res.lucro,cmp.lucro):'')}
   ${kp('Margem',res?res.margem.toFixed(1)+'%':'—',cmp&&res?dl(res.margem,cmp.margem,true):'sobre o subtotal')}
  </div>
  <div class="card s7"><h3>Faturamento por dia</h3><p class="hint">${esc(per)}</p>${dias.length?`<div class="vbars">${dias.map(x=>`<div class="vb" title="${x.dia.slice(8,10)}/${x.dia.slice(5,7)}: ${R0(x.faturamento)}"><span class="num">${R0(x.faturamento/1000)}k</span><i style="height:${Math.max(3,Math.round(120*x.faturamento/mx))}px"></i><small>${x.dia.slice(8,10)}/${x.dia.slice(5,7)}</small></div>`).join('')}</div>`:'<p class="hint">Sem vendas no período.</p>'}</div>
  <div class="card s5"><h3>Do bruto ao lucro</h3><p class="hint">DRE simplificado do período</p>${L.length?L.filter(l=>/^(Vendas cheias|Descontos|Receita realizada|Comissões|Impostos|CMV|Custo de entrega|Lucro)/.test(l.rotulo)).map(l=>{const fin=l.rotulo.startsWith('Lucro'),tot=l.t==='=';return `<div class="dre-l ${fin||tot?'soma':''}"><div><span>${l.t==='-'&&!fin&&!tot?'(−) ':''}${esc(l.rotulo.replace(/ \(.*/,''))}</span></div><b>${l.t==='-'?'−':''}${R0(Math.abs(l.valor))}</b></div>`}).join(''):'<p class="hint">Sem dados.</p>'}</div>
  <div class="card s6"><h3>Canais</h3><p class="hint">${esc(per)}</p>${dados&&dados.canais.length?`<div class="tw"><table><thead><tr><th>Canal</th><th class="r">Pedidos</th><th class="r">%</th><th class="r">Bruto</th></tr></thead><tbody>${dados.canais.map(c=>`<tr><td><strong>${esc(CANAL[c.origem]??c.origem)}</strong></td><td class="r">${N(c.pedidos)}</td><td class="r">${totC?(100*c.pedidos/totC).toFixed(0)+'%':'—'}</td><td class="r">${R0(c.bruto)}</td></tr>`).join('')}</tbody></table></div>`:'<p class="hint">Sem pedidos no período.</p>'}</div>
  <div class="card s6"><h3>Campeões de venda</h3><p class="hint">${esc(per)}</p>${dados&&dados.top_produtos.length?(()=>{const m=Math.max(...dados.top_produtos.map(p=>+p.qtd));return dados.top_produtos.slice(0,6).map(p=>`<div class="hbar" style="grid-template-columns:minmax(0,1fr) 80px 40px"><span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${esc(p.nome)}">${esc(p.nome)}</span><span class="hb"><i style="width:${Math.max(3,100*p.qtd/m)}%"></i></span><b>${N(p.qtd)}</b></div>`).join('')})():'<p class="hint">Sem vendas no período.</p>'}</div>
  <p class="hint s12" style="margin:0">Alertas de margem usam o mesmo mínimo do aviso que chega no WhatsApp. Os detalhes estão em Vendas, Resultado, Compras e Clientes.</p></div>`;
  document.getElementById('g-root')&&(document.getElementById('g-root').outerHTML=html);
  pintarAlertas();
  /* ---- alertas lentos: estoque, compras, clientes, cardápio ---- */
  const [cli,enc,sug,est]=await Promise.all([J(`/api/clientes?marca=${encodeURIComponent(f.marca)}&unidade=${encodeURIComponent(f.unidade)}&sumido_apos=30&canal=todos&so_com_telefone=0`).catch(()=>null),
    J(`/api/encalhados?marca=${encodeURIComponent(f.marca)}&unidade=${encodeURIComponent(f.unidade)}`).catch(()=>null),
    J('/api/sugestao_compra?cobertura_dias=30&seguranca_pct=20').catch(()=>null),J('/api/estoque_plano?cobertura_dias=30&seguranca_pct=20').catch(()=>null)]);
  if(meu!==seq||!ativoAgora())return;
  if(est){const z=est.itens.filter(x=>!x.ciclo&&!x.generico&&x.estoque===0),ab=est.itens.filter(x=>x.abaixo_minimo&&x.estoque!==0);
    if(z.length)alertas.push(alerta('bad',`${z.length} insumo(s) zerado(s)`,`${z.slice(0,5).map(x=>esc(x.insumo)).join(', ')}${z.length>5?` e mais ${z.length-5}`:''}.`,'Abrir estoque','compras'));
    if(ab.length)alertas.push(alerta('warn',`${ab.length} insumo(s) abaixo do mínimo`,`${ab.slice(0,5).map(x=>esc(x.insumo)).join(', ')}.`,'Abrir estoque','compras'))}
  if(sug){const h=sug.pedidos.filter(p=>p.pedir_hoje);if(h.length)alertas.push(alerta('bad',`Pedir hoje: ${h.map(p=>esc(p.fornecedor)).join(', ')}`,`${h.length} pedido(s) com prazo de hoje, estimados em ${R0(h.reduce((a,p)=>a+p.total_estimado,0))}.${h.some(p=>p.dias_sem_produto)?' Algum item fica sem produto antes da próxima entrega.':''}`,'Ver pedidos','compras'));
    if(sug.sem_estoque.length)alertas.push(alerta('warn',`Estoque sem preenchimento: ${sug.sem_estoque.length} item(ns)`,`${sug.sem_estoque.slice(0,4).map(esc).join(', ')} ficam fora da sugestão de compra até você contar.`,'Contar estoque','compras'))}
  if(cli&&+cli.resgate.clientes>0)alertas.push(alerta('warn',`${N(cli.resgate.clientes)} clientes sumidos`,`Não pedem há mais de 30 dias e já deixaram ${R0(cli.resgate.gasto)}.`,'Ver clientes','clientes'));
  if(enc&&(enc.parados.length+enc.quedas.length)>0)alertas.push(alerta('warn',`${enc.parados.length+enc.quedas.length} produto(s) encalhando`,`${enc.parados.length} parado(s) e ${enc.quedas.length} em queda no cardápio.`,'Ver cardápio','cardapio'));
  carregandoLento=false;pintarAlertas();
}
window.V2.screens.geral={render(c){clearInterval(timer);render(c);timer=setInterval(()=>{if(ativoAgora())render(el);else clearInterval(timer)},5*60*1000)},onFiltros(){if(el&&ativoAgora())render(el)}};
})();
