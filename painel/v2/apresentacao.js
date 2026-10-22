/* Painel 2.0 — Modo apresentação (sócio): slides em tela cheia com os principais dados do período escolhido */
(function(){
const R=v=>(+(v??0)).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
const R0=v=>(+(v??0)).toLocaleString('pt-BR',{style:'currency',currency:'BRL',maximumFractionDigits:0});
const N=v=>(+(v??0)).toLocaleString('pt-BR');
const P1=v=>(+(v??0)).toLocaleString('pt-BR',{maximumFractionDigits:1})+'%';
const esc=t=>String(t??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;');
const J=u=>fetch(u).then(r=>{if(!r.ok)throw new Error(r.status);return r.json()});
const MES=['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'],MESN=['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];
const DIAS=['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];
const CANAL={ifood:'iFood',site:'Site próprio',portal:'Portal (balcão)',catalog:'Catálogo/Link',whatsapp:'WhatsApp',chatbot:'Chatbot',app:'App',food99:'99Food','99food':'99Food',rappi:'Rappi',aiqfome:'Aiqfome',keeta:'Keeta'};
const COR={'Maracayá Burger|Colorado':'#F0743E','Maracayá Burger|Sobradinho':'#E9B45A','Chomp Burger|Colorado':'#8EA0B2','Chomp Burger|Sobradinho':'#B7C3CF'};
const nomeOp=(m,u)=>`${m.replace(' Burger','')} · ${u==='Colorado'?'GC':u}`;
let slides=[],idx=0,aberto=false,auto=null,tocando=false,carregando=false,rotulo='';

/* ---------- dados ---------- */
const periodoDados=()=>{const iv=window.V2.intervalo();return `dias=${iv.dias}${iv.ini?`&inicio=${iv.ini}&fim=${iv.fim}`:''}`};
async function numeros(marca,unidade){
  const q=`marca=${encodeURIComponent(marca)}&unidade=${encodeURIComponent(unidade)}`;
  const [d,r]=await Promise.all([J(`/api/dados?${periodoDados()}&${q}`),J(`/api/dre?${q}&periodo=${encodeURIComponent(window.V2.periodoApi())}`)]);
  const k=d.kpis,vendas=r.linhas.find(l=>l.rotulo.startsWith('Vendas cheias'))?.valor??0;
  return {fat:+k.faturamento,ped:+k.pedidos,ticket:+k.ticket,canc:+k.cancelados,tot:+k.total_geral,lucro:+r.resumo.lucro,margem:+r.resumo.margem,cmv:+r.resumo.cmv,vendas,d,r};
}
async function coletar(){
  const f=window.V2.filtros;
  const grupoP=numeros('todas','todas');
  const [marcas,unid]=await Promise.all([J('/api/marcas'),J('/api/unidades')]);
  const grupo=await grupoP,dreC=await J(`/api/dre?marca=todas&unidade=todas&periodo=${encodeURIComponent(window.V2.periodoApi())}&comparar=1`).catch(()=>null);
  let fatAnt=null;const cmp=dreC&&dreC.comparacao;
  if(cmp){const d2=await J(`/api/dados?${periodoDados()}&marca=todas&unidade=todas&comp_inicio=${cmp.inicio}&comp_fim=${cmp.fim}`).catch(()=>null);fatAnt=d2&&d2.comparacao?+d2.comparacao.faturamento:null}
  const porUn=[];for(const u of unid.unidades||[]){const n=await numeros('todas',u);if(n.ped>0)porUn.push({nome:u,n})}
  const porMc=[];for(const m of marcas.marcas||[]){const n=await numeros(m,'todas');if(n.ped>0)porMc.push({nome:m,n})}
  const pa=encodeURIComponent(window.V2.periodoApi()),q0='marca=todas&unidade=todas';
  const [cli,mensal,meta,op,prev,mb,card,bai,enc]=await Promise.all([
    J(`/api/clientes?${q0}&sumido_apos=30&canal=todos&so_com_telefone=0`).catch(()=>null),J('/api/faturamento_mensal?meses=12').catch(()=>null),J('/api/meta').catch(()=>null),
    J(`/api/operacao?${q0}&periodo=${pa}`).catch(()=>null),J(`/api/previsao?${q0}`).catch(()=>null),J(`/api/margem_baixa?${q0}&periodo=${pa}`).catch(()=>null),
    J(`/api/cardapio?${q0}&${periodoDados()}`).catch(()=>null),J(`/api/bairros?${q0}&${periodoDados()}&agrupar=regiao`).catch(()=>null),J(`/api/encalhados?${q0}`).catch(()=>null)]);
  /* estoque e compras: consultas mais pesadas, uma de cada vez */
  const est=await J('/api/estoque_plano?cobertura_dias=30&seguranca_pct=20').catch(()=>null);
  const sug=await J('/api/sugestao_compra?cobertura_dias=30&seguranca_pct=20').catch(()=>null);
  return {grupo,cmp:dreC&&dreC.comparacao,fatAnt,porUn,porMc,cli,mensal,meta,op,prev,mb,card,bai,enc,est,sug,filtros:f};
}

/* ---------- peças visuais ---------- */
const K=v=>(v/1000).toLocaleString('pt-BR',{maximumFractionDigits:1})+'k';
const dl=(a,b,pts)=>{if(b==null||(a===0&&b===0))return '';let c,t;if(pts){const d=a-b;c=d>=0?'up':'down';t=`${d>=0?'+':''}${d.toFixed(1)} p.p.`}else if(!b){c='up';t='novo'}else{const p=100*(a-b)/b;c=p>=0?'up':'down';t=`${p>=0?'+':''}${p.toFixed(0)}%`}return `<span class="ad ${c}">${c==='up'?'▲':'▼'} ${t}</span>`};
const tile=(l,v,s,d='')=>`<div class="at"><div class="al">${l}</div><div class="av">${v}</div><div class="as">${s||''} ${d}</div></div>`;
const hbars=(itens,fmt,cor='var(--brasa)')=>{const m=Math.max(...itens.map(i=>i.v),1);return `<div class="ahb">${itens.map(i=>`<div class="ahr"><span class="ahn">${esc(i.k)}</span><span class="ahbar"><i style="width:${Math.max(2,100*i.v/m)}%;background:${i.c||cor}"></i></span><b>${fmt(i.v)}</b></div>`).join('')}</div>`};
const vbars=(itens,fmt,destaque)=>{const m=Math.max(...itens.map(i=>i.v),1),n=itens.length,passo=n>16?Math.ceil(n/12):1;return `<div class="avb">${itens.map((i,k)=>`<div class="avc${i.k===destaque?' hl':''}"><span>${(k%passo===0||i.k===destaque)?fmt(i.v):''}</span><i style="height:${Math.max(2,100*i.v/m)}%"></i><small>${(k%passo===0)?esc(i.k):''}</small></div>`).join('')}</div>`};
const card=(titulo,cor,n,tot)=>`<div class="aca"><h3><i style="background:${cor}"></i>${esc(titulo)}</h3><div class="acv">${R0(n.fat)}</div><div class="acs">${tot?(100*n.fat/tot).toFixed(0):0}% do grupo · margem ${P1(n.margem)}</div>
  <div class="acg"><div><small>Pedidos</small><b>${N(n.ped)}</b></div><div><small>Ticket</small><b>${R(n.ticket)}</b></div><div><small>Lucro</small><b>${R0(n.lucro)}</b></div><div><small>Cancel.</small><b>${P1(n.tot>0?100*n.canc/n.tot:0)}</b></div></div></div>`;

/* ---------- slides ---------- */
function montar(D){
  const g=D.grupo,d=g.d,r=g.r,cmp=D.cmp,S=[];
  const agora=new Date(),hora=agora.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'});
  S.push({capa:true,html:`<div class="capa"><div class="alogo"></div><h1>Resultados do grupo</h1><p>${esc(rotulo)}</p><small>Maracayá Burger · Chomp Burger · Colorado e Sobradinho</small></div>`});
  S.push({t:'O grupo em números',html:`<div class="agrid3">${tile('Faturamento',R0(g.fat),`${N(g.ped)} pedidos`,dl(g.fat,D.fatAnt))}${tile('Ticket médio',R(g.ticket),'por pedido')}${tile('Lucro',R0(g.lucro),`CMV ${P1(g.vendas?100*g.cmv/g.vendas:0)} das vendas`,dl(g.lucro,cmp&&cmp.lucro))}${tile('Margem',P1(g.margem),'sobre o subtotal',dl(g.margem,cmp&&cmp.margem,true))}${tile('Pedidos',N(g.ped),'no período',dl(g.ped,cmp&&cmp.pedidos))}${tile('Cancelamentos',N(g.canc),`${P1(g.tot>0?100*g.canc/g.tot:0)} dos pedidos`)}</div>${cmp?'<p class="anota">Comparado com o período anterior de mesmo tamanho.</p>':''}`});
  if(d.por_dia.length>1){const dias=d.por_dia.map(x=>({k:x.dia.slice(8,10)+'/'+x.dia.slice(5,7),v:+x.faturamento})),melhor=dias.reduce((a,b)=>b.v>a.v?b:a);
    S.push({t:'Faturamento por dia',html:`${vbars(dias,v=>K(v),melhor.k)}<p class="anota">Melhor dia: <b>${melhor.k}</b> com ${R0(melhor.v)} · média de ${R0(g.fat/dias.length)} por dia</p>`})}
  const tot=g.fat||1;
  if(D.porUn.length)S.push({t:'Por unidade',html:`<div class="agrid2">${D.porUn.map(u=>card(u.nome==='Colorado'?'Colorado (GC)':u.nome,u.nome==='Colorado'?'#F0743E':'#E9B45A',u.n,tot)).join('')}</div>`});
  if(D.porMc.length)S.push({t:'Por marca',html:`<div class="agrid2">${D.porMc.map(m=>card(m.nome,m.nome.startsWith('Chomp')?'#8EA0B2':'#F0743E',m.n,tot)).join('')}</div>`});
  S.push({t:'Do bruto ao lucro',html:`<div class="adre">${r.linhas.filter(l=>/^(Vendas cheias|Descontos|Receita realizada|Comissões|Impostos|CMV|Custo de entrega|Lucro)/.test(l.rotulo)).map(l=>{const fin=l.rotulo.startsWith('Lucro'),sm=l.t==='=';return `<div class="${fin?'fin':sm?'sm':''}"><span>${l.t==='-'&&!fin&&!sm?'(−) ':''}${esc(l.rotulo.replace(/ \(.*/,''))}</span><b>${l.t==='-'?'−':''}${R0(Math.abs(l.valor))}</b></div>`}).join('')}</div>`});
  if(d.canais.length){const mp={};d.canais.forEach(c=>{const k=CANAL[c.origem]??c.origem,o=mp[k]||(mp[k]={k,ped:0,bruto:0,pedagio:0,liquido:0,com:false});o.ped+=+c.pedidos;o.bruto+=+c.bruto;if(c.comissao_pct!==null){o.pedagio+=+c.pedagio;o.liquido+=+c.liquido;o.com=true}});
    const L=Object.values(mp).sort((a,b)=>b.ped-a.ped),totC=L.reduce((a,c)=>a+c.ped,0),mx=Math.max(...L.map(c=>c.ped),1);
    S.push({t:'Canais de venda',html:`<table class="at2 big"><thead><tr><th>Canal</th><th class="barra">Pedidos</th><th>%</th><th>Bruto</th><th>Pedágio</th><th>Líquido</th></tr></thead><tbody>${L.map(c=>`<tr><td>${esc(c.k)}</td><td class="barra"><span class="pb"><i style="width:${Math.max(2,100*c.ped/mx)}%"></i></span><b>${N(c.ped)}</b></td><td>${totC?(100*c.ped/totC).toFixed(0):0}%</td><td>${R0(c.bruto)}</td><td>${c.com?'−'+R0(c.pedagio):'—'}</td><td>${c.com?R0(c.liquido):'—'}</td></tr>`).join('')}</tbody></table>`})}
  if(d.top_produtos.length)S.push({t:'Campeões de venda',html:hbars(d.top_produtos.slice(0,8).map(p=>({k:p.nome.length>42?p.nome.slice(0,41)+'…':p.nome,v:+p.qtd})),v=>N(v)+' un')});
  const horas=d.por_hora.map(x=>({k:x.hora+'h',v:+x.pedidos})),pico=horas.length?horas.reduce((a,b)=>b.v>a.v?b:a).k:'';
  if(horas.length)S.push({t:'Quando o movimento acontece',html:`<div class="agrid2 duas"><div><h4>Pedidos por hora</h4>${vbars(horas,N,pico)}</div><div><h4>Pedidos por dia da semana</h4>${vbars([1,2,3,4,5,6,0].map(i=>({k:DIAS[i],v:+((d.dia_semana.find(x=>+x.dow===i)||{}).pedidos||0)})),N)}</div></div><p class="anota">Horário de pico: <b>${pico}</b></p>`});
  /* ---- cardápio: quadrante mágico, o que fazer e CMV ---- */
  if(D.card&&D.card.produtos.length){
    const med=a=>{const x=[...a].sort((p,q)=>p-q),m=Math.floor(x.length/2);return x.length%2?x[m]:(x[m-1]+x[m])/2};
    const com=D.card.produtos.filter(p=>p.custo!==null).map(p=>({nome:p.nome,qtd:+p.qtd,preco:+p.preco_medio,custo:+p.custo,margem:+p.preco_medio-+p.custo}));
    com.forEach(p=>{p.pct=p.preco>0?100*p.margem/p.preco:0;p.lucro=p.margem*p.qtd});
    if(com.length>=2){const mq=med(com.map(p=>p.qtd)),mm=med(com.map(p=>p.margem));
      com.forEach(p=>{const pop=p.qtd>=mq,mg=p.margem>=mm;p.cl=pop&&mg?'E':pop&&!mg?'B':!pop&&mg?'Q':'A'});
      const CL={E:['⭐ Estrela','#5DBB83','vende muito e deixa boa margem'],B:['🐴 Burro de carga','#E9B45A','vende muito, margem baixa'],Q:['🧩 Quebra-cabeça','#7A8CE8','margem alta, vende pouco'],A:['🍍 Abacaxi','#EE6B5F','vende pouco e margem baixa']};
      const W=620,H=330,pl=48,pb=34,pt=10,pr=14,xs=Math.max(...com.map(p=>p.qtd),1),ys=Math.max(...com.map(p=>p.margem),1),ymin=Math.min(0,...com.map(p=>p.margem));
      const X=v=>pl+(W-pl-pr)*v/xs,Y=v=>pt+(H-pt-pb)*(1-(v-ymin)/(ys-ymin||1));
      const svg=`<svg viewBox="0 0 ${W} ${H}" class="asvg" role="img" aria-label="Quadrante mágico: unidades vendidas por margem unitária"><line x1="${pl}" y1="${H-pb}" x2="${W-pr}" y2="${H-pb}" stroke="#35302B"/><line x1="${pl}" y1="${pt}" x2="${pl}" y2="${H-pb}" stroke="#35302B"/>
        <line x1="${X(mq)}" y1="${pt}" x2="${X(mq)}" y2="${H-pb}" stroke="#A69D93" stroke-dasharray="5 4"/><line x1="${pl}" y1="${Y(mm)}" x2="${W-pr}" y2="${Y(mm)}" stroke="#A69D93" stroke-dasharray="5 4"/>
        ${com.map(p=>`<circle cx="${X(p.qtd).toFixed(1)}" cy="${Y(p.margem).toFixed(1)}" r="7.5" fill="${CL[p.cl][1]}" fill-opacity=".9"/>`).join('')}
        <text x="${(pl+W-pr)/2}" y="${H-6}" fill="#A69D93" font-size="15" text-anchor="middle">unidades vendidas →</text><text x="12" y="${(pt+H-pb)/2}" fill="#A69D93" font-size="15" text-anchor="middle" transform="rotate(-90 12 ${(pt+H-pb)/2})">margem por unidade (R$) →</text></svg>`;
      const cnt=c=>com.filter(p=>p.cl===c).length;
      S.push({t:'Cardápio · quadrante mágico',html:`<div class="aquad">${svg}<div class="aleg2">${Object.entries(CL).map(([k,[n,c,d]])=>`<div><i style="background:${c}"></i><b>${n}</b><span>${cnt(k)} produtos</span><small>${d}</small></div>`).join('')}</div></div>`});
      const top=(c,f,n=5)=>com.filter(p=>p.cl===c).sort(f).slice(0,n);
      const est=top('E',(a,b)=>b.lucro-a.lucro),bur=top('B',(a,b)=>(mm-b.margem)*b.qtd-(mm-a.margem)*a.qtd),aba=top('A',(a,b)=>a.qtd-b.qtd);
      const col=(tit,cor,itens,fmt)=>`<div class="acol"><h4 style="color:${cor}">${tit}</h4>${itens.length?itens.map(p=>`<div><span>${esc(p.nome.length>30?p.nome.slice(0,29)+'…':p.nome)}</span><b>${fmt(p)}</b></div>`).join(''):'<p class="mut">—</p>'}</div>`;
      S.push({t:'Cardápio · o que fazer com cada grupo',html:`<div class="acols">${col('⭐ Manter e destacar','#5DBB83',est,p=>R0(p.lucro)+' de lucro')}${col('🐴 Melhorar preço ou custo','#E9B45A',bur,p=>`${P1(p.pct)} · ${N(p.qtd)} un`)}${col('🍍 Candidatos a sair','#EE6B5F',aba,p=>`${N(p.qtd)} un · ${P1(p.pct)}`)}</div><p class="anota">Mediana: ${N(mq)} unidades vendidas e ${R(mm)} de margem por unidade. Ganho potencial dos burros de carga: subir a margem até a mediana.</p>`});
      const rec=com.reduce((a,p)=>a+p.preco*p.qtd,0),cus=com.reduce((a,p)=>a+p.custo*p.qtd,0),luc=com.reduce((a,p)=>a+p.lucro,0),sem=D.card.produtos.length-com.length;
      S.push({t:'Cardápio · CMV e margem dos produtos',html:`<div class="agrid3 tres">${tile('CMV médio',P1(rec?100*cus/rec:0),'custo dos produtos sobre a venda')}${tile('Margem do produto',P1(rec?100*luc/rec:0),'preço menos CMV, antes de taxas e frete')}${tile('Custos cadastrados',`${com.length}/${D.card.produtos.length}`,sem?`${sem} produto(s) sem custo`:'todos os produtos')}</div>
        <h4 class="asub">Produtos que mais deixam lucro</h4>${hbars([...com].sort((a,b)=>b.lucro-a.lucro).slice(0,6).map(p=>({k:p.nome.length>38?p.nome.slice(0,37)+'…':p.nome,v:p.lucro,c:CL[p.cl][1]})),v=>R0(v))}`})}}
  /* ---- margem por pedido ---- */
  if(D.mb)S.push({t:'Margem por pedido',html:`<div class="agrid3 tres">${tile('Margem média',P1(g.margem),'sobre o subtotal')}${tile(`Abaixo de ${N(D.mb.minimo)}%`,N(D.mb.baixas),`de ${N(D.mb.total)} pedidos (${D.mb.total?(100*D.mb.baixas/D.mb.total).toFixed(0):0}%)`)}${tile('No prejuízo',N(D.mb.prejuizo),D.mb.prejuizo?`perda de ${R(D.mb.perda)}`:'nenhum pedido')}</div>
    ${D.mb.piores.length?`<h4 class="asub">Piores pedidos</h4><table class="at2 pior"><tbody>${D.mb.piores.map(p=>`<tr><td>#${esc(p.numero??p.id)}</td><td>${esc(CANAL[p.origem]??p.origem??'')}</td><td>${R(p.subtotal)}</td><td class="${p.lucro<0?'down':''}">${R(p.lucro)}</td><td class="${p.margem<0?'down':''}">${P1(p.margem)}</td></tr>`).join('')}</tbody></table>`:'<p class="anota">Nenhum pedido abaixo do mínimo no período 🎉</p>'}`});
  /* ---- operação ---- */
  if(D.op&&D.op.tempos_canal&&D.op.tempos_canal.length){const o=D.op,NT={delivery:'Delivery',takeout:'Balcão/Retirada',onsite:'No local',closed_table:'Mesa'},cob=o.cobertura.total>0?Math.round(100*o.cobertura.mediveis/o.cobertura.total):0;
    let gar='';if(o.tempos_hora.length>=3){const mv=Math.max(...o.tempos_hora.map(x=>+x.pedidos)),pico=o.tempos_hora.filter(x=>+x.pedidos>=.6*mv),fora=o.tempos_hora.filter(x=>+x.pedidos<.6*mv),md=a=>a.reduce((s,x)=>s+(+x.mediana)*(+x.pedidos),0)/Math.max(a.reduce((s,x)=>s+(+x.pedidos),0),1);
      if(pico.length&&fora.length){const tp=md(pico),tf=md(fora),dp=100*(tp-tf)/tf;gar=dp>=15?`🍳 Gargalo no pico: <b>${tp.toFixed(0)} min</b> contra ${tf.toFixed(0)} min fora dele (+${dp.toFixed(0)}%).`:`🍳 A cozinha aguenta o pico: ${tp.toFixed(0)} min contra ${tf.toFixed(0)} min fora dele.`}}
    S.push({t:'Operação · tempo de atendimento',html:`<table class="at2 big compacta"><thead><tr><th>Tipo</th><th>Mediana</th><th>Pior 10%</th><th>Pedidos</th></tr></thead><tbody>${o.tempos_canal.map(t=>`<tr><td>${esc(NT[t.tipo]??t.tipo)}</td><td>${t.mediana} min</td><td class="${+t.p90>90?'down':''}">${t.p90} min</td><td>${N(t.pedidos)}</td></tr>`).join('')}</tbody></table><h4 class="asub">Tempo mediano por horário (minutos)</h4>${vbars(o.tempos_hora.map(x=>({k:x.hora+'h',v:+x.mediana})),N)}<p class="anota">${gar} Base: ${cob}% dos pedidos concluídos no portal.</p>`});
    if(o.semanas&&o.semanas.length){const sv=o.semana_vs,p=sv&&+sv.anterior>0?100*(sv.atual-sv.anterior)/sv.anterior:null;
      S.push({t:'Operação · tendência semanal',html:`${vbars(o.semanas.map((x,i)=>({k:x.semana,v:+x.pedidos})),N,o.semanas[o.semanas.length-1].semana)}${p!=null?`<p class="anota">Esta semana até agora: <b>${N(sv.atual)} pedidos</b> ${dl(sv.atual,sv.anterior)} contra ${N(sv.anterior)} no mesmo ponto da semana passada.</p>`:''}`})}}
  if(D.prev&&D.prev.dias&&D.prev.dias.length){const pv=D.prev,t=100*(pv.fator_tendencia-1);
    S.push({t:'Operação · previsão dos próximos 7 dias',html:`${vbars(pv.dias.map(x=>{const dt=new Date(x.data+'T12:00:00');return {k:`${DIAS[dt.getDay()]} ${String(dt.getDate()).padStart(2,'0')}/${String(dt.getMonth()+1).padStart(2,'0')}`,v:+x.pedidos}}),N)}<p class="anota">Semana prevista: <b>${N(pv.total_pedidos)} pedidos</b> · <b>${R0(pv.total_faturamento)}</b> · tendência das últimas 4 semanas ${Math.abs(t)<1?'<b>estável</b>':dl(1+t/100,1)}</p>`})}
  /* ---- bairros ---- */
  if(D.bai&&D.bai.ranking&&D.bai.ranking.length){const rk=D.bai.ranking.slice(0,8),totF=D.bai.ranking.reduce((a,b)=>a+(+b.faturamento),0);
    S.push({t:'De onde vêm os pedidos',html:`${hbars(rk.map(b=>({k:b.bairro,v:+b.pedidos})),v=>N(v)+' pedidos')}<p class="anota"><b>${esc(rk[0].bairro)}</b> responde por ${totF?(100*rk[0].faturamento/totF).toFixed(0):0}% do faturamento de delivery · ${N(D.bai.totais.pedidos)} pedidos entregues</p>`})}
  /* ---- encalhados ---- */
  if(D.enc&&(D.enc.parados.length||D.enc.quedas.length))S.push({t:'Cardápio · produtos que pedem atenção',html:`<div class="acols"><div class="acol"><h4 style="color:#EE6B5F">🛑 Parados</h4>${D.enc.parados.slice(0,6).map(p=>`<div><span>${esc(p.nome)}</span><b>${p.dias} dias</b></div>`).join('')||'<p class="mut">Nenhum</p>'}</div><div class="acol"><h4 style="color:#E9B45A">📉 Em queda</h4>${D.enc.quedas.slice(0,6).map(q=>`<div><span>${esc(q.nome)}</span><b>▼ ${q.queda}%</b></div>`).join('')||'<p class="mut">Nenhum</p>'}</div></div>`});
  /* ---- estoque e compras ---- */
  if(D.est){const z=D.est.itens.filter(x=>!x.ciclo&&!x.generico&&x.estoque===0),ab=D.est.itens.filter(x=>x.abaixo_minimo&&x.estoque!==0),h=D.sug?D.sug.pedidos.filter(p=>p.pedir_hoje):[];
    S.push({t:'Estoque e compras',html:`<div class="agrid3 tres">${tile('Zerados',N(z.length),z.slice(0,4).map(x=>esc(x.insumo)).join(', ')||'nenhum')}${tile('Abaixo do mínimo',N(ab.length),ab.slice(0,4).map(x=>esc(x.insumo)).join(', ')||'nenhum')}${tile('Pedir hoje',N(h.length),h.length?`${h.map(p=>esc(p.fornecedor)).join(', ')} · ${R0(h.reduce((a,p)=>a+p.total_estimado,0))}`:'nenhum pedido com prazo hoje')}</div><p class="anota">Custo de insumos: ${R0(D.est.custo_dia_total)} por dia${D.est.sem_custo?` · ${D.est.sem_custo} insumo(s) sem custo cadastrado`:''}.</p>`})}
  if(D.cli){const k=D.cli.kpis,seg=Object.fromEntries((D.cli.rfv||[]).map(s=>[s.segmento,s]));
    S.push({t:'Clientes',html:`<div class="agrid3">${tile('Clientes',N(k.total),'com pelo menos 1 pedido')}${tile('Recorrentes',N(k.recorrentes),`${k.total>0?(100*k.recorrentes/k.total).toFixed(0):0}% voltaram a pedir`)}${tile('Novos (30 dias)',N(k.novos_30d),'primeira compra')}${tile('Gasto por cliente',R(k.gasto_medio),'média')}${tile('Campeões + Fiéis',N((seg['Campeões']?.clientes||0)+(seg['Fieis']?.clientes||0)),'a base mais valiosa')}${tile('Sumidos (30+ dias)',N(D.cli.resgate.clientes),`já deixaram ${R0(D.cli.resgate.gasto)}`)}</div>`})}
  if(D.mensal){const m=D.mensal,tt=m.meses.map((x,i)=>({x,t:m.series.reduce((a,s)=>a+s.faturamento[i],0)})),p0=tt[0],fe=tt.filter(x=>!x.x.parcial),u=fe[fe.length-1];
    const pct=p0&&u&&p0!==u&&p0.t>0?100*(u.t-p0.t)/p0.t:null,mx=Math.max(...tt.map(x=>x.t),1);
    S.push({t:'Crescimento em '+m.hoje.slice(0,4),html:`${pct!=null?`<div class="ahero"><b>${pct>=0?'+':''}${pct.toFixed(0)}%</b><span>de ${MES[+p0.x.mes.slice(5)-1]} a ${MES[+u.x.mes.slice(5)-1]}${m.funcionarios?` · hoje somos ${m.funcionarios} no time`:''}</span></div>`:''}
     <div class="avb mes">${tt.map((x,i)=>`<div class="avc"><span>${K(x.t)}</span><div class="pilha" style="height:${Math.max(2,100*x.t/mx)}%">${m.series.map(s=>`<i style="height:${x.t?100*s.faturamento[i]/x.t:0}%;background:${COR[s.marca+'|'+s.unidade]||'#888'}"></i>`).join('')}</div><small>${MES[+x.x.mes.slice(5)-1]}${x.x.parcial?'*':''}</small></div>`).join('')}</div>
     <div class="aleg">${m.series.filter(s=>s.faturamento.some(v=>v>0)).map(s=>`<span><i style="background:${COR[s.marca+'|'+s.unidade]||'#888'}"></i>${esc(nomeOp(s.marca,s.unidade))}</span>`).join('')}<span class="mut">* mês em andamento</span></div>`})}
  if(D.meta&&D.meta.meta!=null){const m=D.meta,pct=Math.min(m.pct,100),pt=100*(m.dia_hoje-1)/m.dias_no_mes;
    S.push({t:`Meta de ${MESN[new Date().getMonth()]}`,html:`<div class="ameta"><div class="amv">${R0(m.realizado)} <small>de ${R0(m.meta)} · ${m.pct.toFixed(0)}%</small></div><div class="atermo"><i style="width:${pct}%"></i><u style="left:${pt}%"></u></div>
      <div class="amt">${m.realizado>=m.meta?`🏆 Meta batida com ${m.dias_restantes} dia(s) de sobra`:`Faltam <b>${R0(m.falta)}</b> em ${m.dias_restantes} dias · precisa de <b>${R0(m.necessario_por_dia)}/dia</b><br>Ritmo atual <b class="${m.no_ritmo?'up':'down'}">${R0(m.ritmo_atual)}/dia</b> · projeção <b class="${m.no_ritmo?'up':'down'}">${R0(m.projecao)}</b>`}</div></div>`})}
  S.push({capa:true,html:`<div class="capa"><div class="alogo"></div><h1>Obrigado</h1><p>Dados do painel Maracayá · atualizados às ${hora}</p></div>`});
  return S;
}

/* ---------- tela ---------- */
function css(){if(document.getElementById('apres-css'))return;const st=document.createElement('style');st.id='apres-css';st.textContent=`
.apres{position:fixed;inset:0;z-index:300;background:#0E0C0B;color:#F2ECE5;display:grid;grid-template-rows:auto minmax(0,1fr) auto;font-family:Figtree,system-ui,sans-serif;--brasa:#F0743E;--ok:#5DBB83;--bad:#EE6B5F;--ink-2:#A69D93;--line:#35302B;--surface:#1D1A17;--surface-2:#292521}
.apres *{box-sizing:border-box}.apres .mut{color:#A69D93}
.ap-top{display:flex;align-items:center;gap:16px;padding:12px 20px}.ap-top .lg{height:34px;aspect-ratio:2.7/1;background:url(/static/logo-escura.png) no-repeat center 49.5%/100% auto}
.ap-top .pr{flex:1;text-align:center;color:#A69D93;font-size:14px}.apres button{font:inherit;cursor:pointer}
.ap-btn{border:1px solid #35302B;background:#1D1A17;color:#F2ECE5;border-radius:10px;padding:8px 14px;font-weight:600;font-size:14px}.ap-btn:hover{border-color:#F0743E}.ap-btn[aria-pressed=true]{background:#F0743E;border-color:#F0743E;color:#fff}
.ap-stage{display:grid;place-items:center;padding:0 20px;min-height:0;overflow:hidden}
.sl{width:min(100%,calc((100vh - 150px)*16/9));aspect-ratio:16/9;font-size:min(1.5vw,2.6vh);display:flex;flex-direction:column;padding:2.2em 3em;background:#141210;border:1px solid #35302B;border-radius:1.4em;position:relative;overflow:hidden;animation:apin .35s ease}
@keyframes apin{from{opacity:0;transform:translateX(16px)}to{opacity:1;transform:none}}
@media (prefers-reduced-motion:reduce){.sl{animation:none}}
.sl>h2{font-family:"Bricolage Grotesque",Figtree,sans-serif;font-weight:800;font-size:2.1em;margin:0 0 .6em;letter-spacing:-.02em}.sl>h2::after{content:"";display:block;width:2.4em;height:.16em;background:#F0743E;margin-top:.35em;border-radius:99px}
.sl .corpo{flex:1;min-height:0;display:flex;flex-direction:column;justify-content:center}
.capa{margin:auto;text-align:center;display:grid;gap:.5em;justify-items:center}.capa .alogo{width:min(70%,22em);aspect-ratio:2.7/1;background:url(/static/logo-escura.png) no-repeat center 49.5%/100% auto}.capa h1{font-family:"Bricolage Grotesque",Figtree,sans-serif;font-size:3em;margin:.2em 0 0;letter-spacing:-.02em}.capa p{font-size:1.5em;color:#F0743E;margin:0;font-weight:700}.capa small{color:#A69D93;font-size:1em}
.agrid3{display:grid;grid-template-columns:repeat(3,1fr);gap:1em}.agrid2{display:grid;grid-template-columns:repeat(2,1fr);gap:1.2em}.agrid2.duas{align-items:end}
.at{background:#1D1A17;border:1px solid #35302B;border-radius:1em;padding:1em 1.2em;container-type:inline-size;min-width:0}.at .al{font-size:.8em;text-transform:uppercase;letter-spacing:.1em;color:#A69D93;font-weight:700}.at .av{font-family:"Bricolage Grotesque",Figtree,sans-serif;font-weight:800;font-size:min(2.7em,15cqw);line-height:1.1;margin:.12em 0;font-variant-numeric:tabular-nums;white-space:nowrap}.at .as{font-size:.9em;color:#A69D93;overflow-wrap:anywhere}
.ad{font-weight:700;margin-left:.3em}.ad.up,.up{color:#5DBB83}.ad.down,.down{color:#EE6B5F}
.anota{margin:.9em 0 0;color:#A69D93;font-size:.95em}.anota b{color:#F2ECE5}
.avb{display:flex;align-items:flex-end;gap:.35em;height:15em}.avc{flex:1;min-width:0;height:100%;display:flex;flex-direction:column;justify-content:flex-end;align-items:center;gap:.25em;font-size:.8em}.avc i{display:block;width:100%;background:#E9B45A;border-radius:.3em .3em 0 0}.avc.hl i{background:#F0743E}.avc span{font-family:"IBM Plex Mono",monospace;font-size:.85em;white-space:nowrap;min-height:1.1em}.avc small{color:#A69D93;min-height:1.1em;white-space:nowrap}
.avb.mes .pilha{width:100%;display:flex;flex-direction:column-reverse;border-radius:.3em .3em 0 0;overflow:hidden}.avb.mes .pilha i{border-radius:0;width:100%}
.aleg{display:flex;gap:1.4em;flex-wrap:wrap;margin-top:.8em;font-size:.9em}.aleg i{display:inline-block;width:.8em;height:.8em;border-radius:50%;margin-right:.4em}
.ahb{display:grid;gap:.7em}.ahr{display:grid;grid-template-columns:minmax(0,19em) 1fr 6em;gap:1em;align-items:center;font-size:1.05em}.ahn{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.ahbar{background:#292521;border-radius:.5em;height:1.2em;overflow:hidden}.ahbar i{display:block;height:100%;border-radius:.5em}.ahr b{text-align:right;font-variant-numeric:tabular-nums}
.aca{background:#1D1A17;border:1px solid #35302B;border-radius:1em;padding:1.2em 1.4em;container-type:inline-size;min-width:0}.aca h3{margin:0;font-size:1.3em;display:flex;align-items:center;gap:.5em}.aca h3 i{width:.8em;height:.8em;border-radius:50%}.acv{font-family:"Bricolage Grotesque",Figtree,sans-serif;font-weight:800;font-size:min(3em,13cqw);margin:.2em 0 0;white-space:nowrap}.acs{color:#A69D93;margin-bottom:.8em}
.acg{display:grid;grid-template-columns:repeat(4,1fr);gap:.6em;border-top:1px solid #35302B;padding-top:.8em}.acg small{display:block;font-size:.7em;text-transform:uppercase;letter-spacing:.08em;color:#A69D93}.acg b{font-size:1.1em}
.adre{max-width:38em;margin:auto;width:100%}.adre div{display:flex;justify-content:space-between;padding:.55em 0;border-bottom:1px solid #35302B;font-size:1.25em}.adre .sm{font-weight:800;border-bottom:2px solid #35302B}.adre .fin{font-weight:800;font-size:1.6em;color:#5DBB83;border:0}
.at2.pior td:nth-child(2){text-align:left}.at2.compacta{margin-bottom:.4em}.at2.big{font-size:1.15em}.at2.big td.barra,.at2.big th.barra{width:34%;text-align:left}.at2.big td.barra{display:flex;align-items:center;gap:.8em}.pb{flex:1;background:#292521;border-radius:.5em;height:.9em;overflow:hidden}.pb i{display:block;height:100%;background:#F0743E;border-radius:.5em}.at2{width:100%;border-collapse:collapse;font-size:.95em}.at2 th{text-align:right;font-size:.75em;text-transform:uppercase;letter-spacing:.08em;color:#A69D93;padding:.4em}.at2 th:first-child,.at2 td:first-child{text-align:left}.at2 td{text-align:right;padding:.5em .4em;border-top:1px solid #35302B;font-variant-numeric:tabular-nums}
.agrid2 h4{margin:0 0 .6em;font-size:1em;color:#A69D93;text-transform:uppercase;letter-spacing:.08em}
.ahero{display:flex;align-items:baseline;gap:.7em;margin-bottom:.6em}.ahero b{font-family:"Bricolage Grotesque",Figtree,sans-serif;font-size:4em;color:#F0743E;line-height:1}.ahero span{font-size:1.2em;color:#A69D93}
.ameta{max-width:44em;margin:auto;width:100%;display:grid;gap:1em}.amv{font-family:"Bricolage Grotesque",Figtree,sans-serif;font-weight:800;font-size:3.6em;color:#F0743E}.amv small{font-size:.35em;color:#A69D93;font-weight:600}.atermo{position:relative;height:1.6em;background:#292521;border-radius:99px;overflow:hidden}.atermo i{display:block;height:100%;background:linear-gradient(90deg,#B8410F,#F0743E);border-radius:99px 0 0 99px}.atermo u{position:absolute;top:0;bottom:0;width:3px;background:#F2ECE5;opacity:.7}.amt{font-size:1.2em;color:#A69D93;line-height:1.7}.amt b{color:#F2ECE5}
.ap-bot{display:flex;align-items:center;gap:12px;padding:10px 20px 14px}.ap-dots{flex:1;display:flex;gap:6px;justify-content:center;flex-wrap:wrap}.ap-dots button{width:9px;height:9px;border-radius:50%;border:0;background:#35302B;padding:0}.ap-dots button[aria-current=true]{background:#F0743E;width:22px;border-radius:99px}.ap-cnt{color:#A69D93;font-size:13px;min-width:3.5em;text-align:right}
.ap-load{margin:auto;text-align:center;color:#A69D93}.ap-load b{display:block;color:#F2ECE5;font-size:20px;margin-bottom:6px}
.asvg{width:100%;height:auto;max-height:100%}.aquad{display:grid;grid-template-columns:2.2fr 1fr;gap:1.6em;align-items:center}.aleg2{display:grid;gap:.9em}.aleg2 div{display:grid;grid-template-columns:auto 1fr auto;gap:.1em .6em;align-items:baseline}.aleg2 i{width:.9em;height:.9em;border-radius:50%;grid-row:1/3;align-self:center}.aleg2 span{color:#A69D93;font-size:.9em}.aleg2 small{grid-column:2/4;color:#A69D93;font-size:.8em}
.acols{display:grid;grid-template-columns:repeat(3,1fr);gap:1.4em}.acol h4{margin:0 0 .6em;font-size:1.1em}.acol div{display:flex;justify-content:space-between;gap:.8em;padding:.45em 0;border-top:1px solid #35302B;font-size:.95em}.acol b{white-space:nowrap}
.agrid3.tres{grid-template-columns:repeat(3,1fr)}.asub{margin:1em 0 .5em;color:#A69D93;font-size:.9em;text-transform:uppercase;letter-spacing:.08em}
.ap-prep{width:min(100%,38em);margin:auto;font-size:min(1.5vw,2.4vh,17px);max-height:100%;overflow:auto;padding:1em}.ap-prep h2{font-family:"Bricolage Grotesque",Figtree,sans-serif;font-size:2em;margin:0 0 .3em}.ap-prep p{margin:0 0 1em}
.ap-sets{list-style:none;margin:0;padding:0;display:grid;gap:.5em}.ap-sets li{display:flex;align-items:center;gap:.8em;background:#1D1A17;border:1px solid #35302B;border-radius:.8em;padding:.55em .9em}.ap-sets li.off{opacity:.45}.ap-sets .n{width:1.7em;height:1.7em;border-radius:50%;background:#F0743E;color:#fff;display:grid;place-items:center;font-weight:800;font-size:.9em;flex:none}.ap-sets li.off .n{background:#35302B}
.ap-sets label{flex:1;display:flex;align-items:center;gap:.5em;cursor:pointer;font-size:1.05em}.ap-sets input{accent-color:#F0743E;width:1.1em;height:1.1em}.ap-sets small{color:#A69D93;margin-left:auto}.ap-sets .mv{display:flex;gap:.3em}.ap-sets .mv .ap-btn{padding:.2em .6em}.ap-btn:disabled{opacity:.35;cursor:default}
.ap-prep-btns{display:flex;gap:.7em;align-items:center;margin-top:1.1em;flex-wrap:wrap}.ap-prep-btns .mut{margin-left:auto}.ap-btn.go{background:#F0743E;border-color:#F0743E;color:#fff}.ap-btn.go:disabled{background:#35302B;border-color:#35302B;color:#A69D93}
.apres.preparando .ap-bot,.apres.preparando #ap-ord{display:none}.apres:not(.preparando) #ap-ord{display:inline-block}
@media (max-height:520px){.apres{grid-template-rows:minmax(0,1fr)}.ap-top{position:absolute;top:0;right:0;z-index:3;padding:6px 8px}.ap-top .lg,.ap-top .pr{display:none}.ap-bot{position:absolute;bottom:0;left:0;right:0;z-index:3;padding:4px 10px 6px;background:linear-gradient(transparent,rgba(14,12,11,.92))}.ap-stage{padding:0;grid-row:1}.sl{width:100%;height:100%;aspect-ratio:auto;border-radius:0;border:0;font-size:min(1.7vw,3.3vh);padding:1.6em 2.4em 3.6em}.ap-btn{padding:5px 10px;font-size:12px}.ap-dots button{width:7px;height:7px}}
@media (max-width:760px){.ap-top .pr{display:none}.sl{font-size:min(2.6vw,2vh);padding:1.6em 1.8em}.ap-top{padding:10px 12px}.ap-bot{padding:8px 12px 12px}.ap-btn{padding:8px 10px}}
`;document.head.appendChild(st)}

/* ---------- setores (ordem editável / sorteio) ---------- */
const SETORES=[['fin','💰','Financeiro'],['ven','🛒','Vendas e canais'],['car','🍔','Cardápio'],['ope','⏱️','Operação e estoque'],['cli','👥','Clientes'],['cre','📈','Crescimento e meta']];
const setorDe=t=>/^(O grupo em números|Faturamento por dia|Por unidade|Por marca|Do bruto ao lucro|Margem por pedido)/.test(t)?'fin':/^(Canais|Campeões|Quando o movimento|De onde vêm)/.test(t)?'ven':/^Cardápio/.test(t)?'car':/^(Operação|Estoque)/.test(t)?'ope':/^Clientes/.test(t)?'cli':'cre';
let fase='preparar',capaIni=null,capaFim=null,sets=[];   // sets: [{id,ico,nome,slides,on}] na ordem atual
function prepararSetores(todos){
  capaIni=todos[0];capaFim=todos[todos.length-1];const meio=todos.slice(1,-1);
  sets=SETORES.map(([id,ico,nome])=>({id,ico,nome,slides:meio.filter(x=>setorDe(x.t)===id),on:true})).filter(x=>x.slides.length);
}
function sortear(){
  const antes=sets.map(x=>x.id).join();let n=0;
  do{for(let i=sets.length-1;i>0;i--){const j=Number(crypto.getRandomValues(new Uint32Array(1))[0]%(i+1));[sets[i],sets[j]]=[sets[j],sets[i]]}}while(sets.map(x=>x.id).join()===antes&&sets.length>1&&++n<8);
}
function ordemPadrao(){sets.sort((a,b)=>SETORES.findIndex(x=>x[0]===a.id)-SETORES.findIndex(x=>x[0]===b.id))}
function montarLista(){slides=[capaIni,...sets.filter(x=>x.on).flatMap(x=>x.slides),capaFim]}

function painel(){
  const total=sets.filter(x=>x.on).reduce((a,x)=>a+x.slides.length,0)+2;
  return `<div class="ap-prep"><h2>Montar a apresentação</h2><p class="mut">Escolha a ordem dos setores. Sortear evita começar sempre pelo mesmo assunto. A capa fica no início e o encerramento no fim.</p>
   <ol class="ap-sets">${sets.map((x,i)=>`<li class="${x.on?'':'off'}"><span class="n">${i+1}</span><label><input type="checkbox" data-on="${x.id}" ${x.on?'checked':''}> <span class="ic">${x.ico}</span> <b>${esc(x.nome)}</b> <small>${x.slides.length} slide${x.slides.length>1?'s':''}</small></label><span class="mv"><button class="ap-btn" data-up="${i}" aria-label="Subir ${esc(x.nome)}" ${i===0?'disabled':''}>▲</button><button class="ap-btn" data-down="${i}" aria-label="Descer ${esc(x.nome)}" ${i===sets.length-1?'disabled':''}>▼</button></span></li>`).join('')}</ol>
   <div class="ap-prep-btns"><button class="ap-btn" id="ap-sort">🎲 Sortear ordem</button><button class="ap-btn" id="ap-pad">↺ Ordem padrão</button><span class="mut">${total} slides</span><button class="ap-btn go" id="ap-go" ${carregando?'disabled':''}>${carregando?'Carregando os dados…':'▶ Começar'}</button></div></div>`}
function pintar(){
  const st=document.getElementById('ap-stage');if(!st)return;const ap=document.getElementById('apres');
  if(ap)ap.classList.toggle('preparando',fase==='preparar');
  if(fase==='preparar'){st.innerHTML=painel();return}
  const s=slides[idx];
  st.innerHTML=`<div class="sl" role="group" aria-roledescription="slide" aria-label="Slide ${idx+1} de ${slides.length}">${s.capa?s.html:`<h2>${esc(s.t)}</h2><div class="corpo">${s.html}</div>`}</div>`;
  document.getElementById('ap-cnt').textContent=`${idx+1}/${slides.length}`;
  document.getElementById('ap-dots').innerHTML=slides.map((x,i)=>`<button data-i="${i}" aria-label="Ir para o slide ${i+1}" aria-current="${i===idx}"></button>`).join('');
}
function comecar(){if(carregando||!sets.length)return;montarLista();idx=0;fase='apresentar';pintar()}
function voltarPainel(){parar();fase='preparar';pintar()}
function ir(i){if(fase!=='apresentar'||!slides.length)return;idx=Math.max(0,Math.min(slides.length-1,i));pintar();if(tocando)reiniciarAuto()}
function reiniciarAuto(){clearInterval(auto);if(tocando)auto=setInterval(()=>{if(idx>=slides.length-1){parar()}else ir(idx+1)},9000)}
function parar(){tocando=false;clearInterval(auto);const b=document.getElementById('ap-play');if(b){b.setAttribute('aria-pressed','false');b.textContent='▶ Automático'}}
function tecla(e){if(!aberto)return;
  if(e.key==='Escape'){e.preventDefault();fechar();return}
  if(fase==='preparar'){if(e.key==='Enter'&&!/BUTTON|INPUT/.test(document.activeElement.tagName)){e.preventDefault();comecar()}return}
  if(e.key==='ArrowRight'||e.key==='PageDown'||e.key===' '){e.preventDefault();ir(idx+1)}
  else if(e.key==='ArrowLeft'||e.key==='PageUp'){e.preventDefault();ir(idx-1)}
  else if(e.key==='Home')ir(0);else if(e.key==='End')ir(slides.length-1);else if(e.key==='f'||e.key==='F')tela();else if(e.key==='o'||e.key==='O')voltarPainel()}
function tela(){const el=document.getElementById('apres');if(document.fullscreenElement)document.exitFullscreen();else if(el&&el.requestFullscreen)el.requestFullscreen().catch(()=>{})}
function fechar(){aberto=false;parar();if(document.fullscreenElement)document.exitFullscreen().catch(()=>{});const a=document.getElementById('apres');if(a)a.remove();document.removeEventListener('keydown',tecla,true);document.body.style.overflow=''}
async function abrir(){
  if(aberto)return;aberto=true;css();carregando=true;idx=0;slides=[];sets=[];fase='preparar';rotulo=window.V2.periodoLabel();
  const a=document.createElement('div');a.id='apres';a.className='apres preparando';a.setAttribute('role','dialog');a.setAttribute('aria-label','Apresentação');
  a.innerHTML=`<div class="ap-top"><div class="lg" role="img" aria-label="Maracayá"></div><div class="pr">${esc(rotulo)}</div><button class="ap-btn" id="ap-ord" title="Reordenar os setores (O)">⇅ Ordem</button><button class="ap-btn" id="ap-fs" title="Tela cheia (F)">⛶ Tela cheia</button><button class="ap-btn" id="ap-x" title="Sair (Esc)">✕ Sair</button></div>
   <div class="ap-stage" id="ap-stage"></div>
   <div class="ap-bot"><button class="ap-btn" id="ap-prev" aria-label="Anterior">‹</button><button class="ap-btn" id="ap-play" aria-pressed="false">▶ Automático</button><div class="ap-dots" id="ap-dots"></div><span class="ap-cnt" id="ap-cnt"></span><button class="ap-btn" id="ap-next" aria-label="Próximo">›</button></div>`;
  document.body.appendChild(a);document.body.style.overflow='hidden';document.addEventListener('keydown',tecla,true);
  a.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;
    if(b.id==='ap-x')fechar();else if(b.id==='ap-fs')tela();else if(b.id==='ap-ord')voltarPainel();
    else if(b.id==='ap-prev')ir(idx-1);else if(b.id==='ap-next')ir(idx+1);
    else if(b.id==='ap-play'){tocando=!tocando;b.setAttribute('aria-pressed',tocando);b.textContent=tocando?'❚❚ Pausar':'▶ Automático';reiniciarAuto()}
    else if(b.id==='ap-sort'){sortear();pintar()}else if(b.id==='ap-pad'){ordemPadrao();pintar()}else if(b.id==='ap-go')comecar();
    else if(b.dataset.up!==undefined){const i=+b.dataset.up;if(i>0){[sets[i-1],sets[i]]=[sets[i],sets[i-1]];pintar()}}
    else if(b.dataset.down!==undefined){const i=+b.dataset.down;if(i<sets.length-1){[sets[i+1],sets[i]]=[sets[i],sets[i+1]];pintar()}}
    else if(b.dataset.i!==undefined)ir(+b.dataset.i)});
  a.addEventListener('change',e=>{const c=e.target.closest('[data-on]');if(!c)return;const x=sets.find(y=>y.id===c.dataset.on);if(x){x.on=c.checked;if(!sets.some(y=>y.on)){x.on=true}pintar()}});
  let x0=null;a.addEventListener('touchstart',e=>{x0=e.touches[0].clientX},{passive:true});a.addEventListener('touchend',e=>{if(x0==null||fase!=='apresentar')return;const dx=e.changedTouches[0].clientX-x0;if(Math.abs(dx)>50)ir(idx+(dx<0?1:-1));x0=null});
  const st=document.getElementById('ap-stage');st.innerHTML='<div class="ap-load"><b>Preparando a apresentação…</b>Buscando os números do período</div>';
  try{const D=await coletar();if(!aberto)return;prepararSetores(montar(D));carregando=false;pintar()}
  catch(e){carregando=false;if(st)st.innerHTML='<div class="ap-load"><b>Não foi possível montar a apresentação</b>Feche e tente de novo em instantes.</div>'}
}
window.V2.apresentar=abrir;
})();
