/* Painel 2.0 — tela Gastos por fornecedor: gasto mensal por fornecedor (estimado ou documentado), preço por unidade, pontos de atenção */
(function(){
const R=v=>(+(v??0)).toLocaleString('pt-BR',{style:'currency',currency:'BRL',maximumFractionDigits:0});
const R2=v=>(+(v??0)).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
const N=v=>(+(v??0)).toLocaleString('pt-BR');
const esc=t=>String(t??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;');
const post=(url,corpo)=>fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(corpo)}).then(r=>r.json());
const toast=t=>window.V2.toast(t);
const css=n=>getComputedStyle(document.documentElement).getPropertyValue(n).trim();
const MES_AB=['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
const ORIGEM={estimado:['p-warn','estimado'],nota:['p-ok','nota fiscal'],pago:['p-ok','pago']};
let el=null,ligado=false,dados=null,itens=[],ano=null,forn='todos',charts={},modal=null;
const kpi=(l,v,s,x='')=>`<div class="card kpi s3"><div class="k-l">${l}</div><div class="k-v ${x}">${v}</div>${s?`<div class="k-s">${s}</div>`:''}</div>`;
const mesIdx=iso=>+iso.slice(5,7)-1;

function carregarChart(){if(window.Chart)return Promise.resolve();return new Promise((ok,err)=>{const s=document.createElement('script');s.src='https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js';s.onload=ok;s.onerror=err;document.head.appendChild(s)})}
function desenhar(id,cfg){const c=document.getElementById(id);if(!c)return;if(charts[id])charts[id].destroy();charts[id]=new Chart(c,cfg)}


const GRUPO_COR={'Molhos e sachês':'--brasa','Batata':'#d9a21b','Queijos':'#e0873a','Óleo':'#5b8def','Descartáveis e limpeza':'#2e9e6b','Proteínas':'#a855a7','Temperos':'#7c6f64','Embalagens':'#4a8f9a','Frete e ajustes':'#9a9a9a','Refrigerantes':'#5b8def','Sucos':'#a855a7','Águas':'#4a8f9a','Cervejas':'#d9a21b','Energéticos':'#2e9e6b','Discos de hambúrguer':'--brasa','Pães':'#e0873a','Batata palha':'#d9a21b','Sem detalhe':'#9a9a9a'};
const PAL=['--brasa','#5b8def','#2e9e6b','#d9a21b','#a855a7','#4a8f9a','#e0873a','#7c6f64'];
const corForn=(f,lista)=>{const c=PAL[lista.indexOf(f)%PAL.length];return c.startsWith('--')?css(c):c};
const UNID={'Discos de hambúrguer':'un','Batata palha':'cx'};
const pct=(a,b)=>b>0?(a/b*100).toFixed(1).replace('.',',')+'%':'—';
const R2p=v=>'R$ '+(+v).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});

/* ---------- dados ---------- */
function modelo(){
  const ls=dados.linhas.filter(l=>forn==='todos'||l.fornecedor===forn);
  const todos=[...new Set(dados.linhas.map(l=>l.fornecedor))];
  const forns=[...new Set(ls.map(l=>l.fornecedor))].sort((a,b)=>ls.filter(l=>l.fornecedor===b).reduce((x,l)=>x+l.valor,0)-ls.filter(l=>l.fornecedor===a).reduce((x,l)=>x+l.valor,0));
  const meses=[...new Set(ls.map(l=>mesIdx(l.mes)))].sort((a,b)=>a-b);
  const idx={};ls.forEach(l=>{const k=l.fornecedor+'|'+mesIdx(l.mes);(idx[k]=idx[k]||[]).push(l)});
  const val=(f,m)=>(idx[f+'|'+m]||[]).reduce((a,l)=>a+l.valor,0);
  const qtd=(f,m)=>(idx[f+'|'+m]||[]).reduce((a,l)=>a+(l.quantidade||0),0);
  const totMes=meses.map(m=>forns.reduce((a,f)=>a+val(f,m),0));
  const qtdMes=meses.map(m=>forns.reduce((a,f)=>a+qtd(f,m),0));
  const total=totMes.reduce((a,b)=>a+b,0),qtdTot=qtdMes.reduce((a,b)=>a+b,0);
  const totalGeral=dados.linhas.reduce((a,l)=>a+l.valor,0);
  const preco=f=>meses.map(m=>qtd(f,m)>0?val(f,m)/qtd(f,m):null);
  const temQtd=ls.length>0&&ls.every(l=>l.quantidade>0);
  return {temQtd,ls,todos,forns,meses,val,qtd,totMes,qtdMes,total,qtdTot,totalGeral,preco};
}

/* itens comprados: os detalhados (gastos_itens) + o que falta de cada mês, para o total fechar com o lançamento */
function itensEscopo(){
  const out=[];const det={};
  itens.forEach(i=>{const k=i.fornecedor+'|'+i.mes;det[k]=(det[k]||0)+i.valor;if(forn==='todos'||i.fornecedor===forn)out.push(i)});
  dados.linhas.filter(l=>forn==='todos'||l.fornecedor===forn).forEach(l=>{
    const k=l.fornecedor+'|'+l.mes,jaTem=det[k]||0;
    if(!jaTem)out.push({fornecedor:l.fornecedor,mes:l.mes,item:l.categoria,grupo:l.categoria,quantidade:l.quantidade,unidade:l.quantidade?(UNID[l.categoria]||'un'):null,preco_unit:l.quantidade?l.valor/l.quantidade:null,valor:l.valor,origem:l.origem,detalhe:null,sintetico:true});
    else if(l.valor-jaTem>1)out.push({fornecedor:l.fornecedor,mes:l.mes,item:'Sem detalhe',grupo:'Sem detalhe',quantidade:null,unidade:null,preco_unit:null,valor:l.valor-jaTem,origem:l.origem,detalhe:'nota não encontrada nas conversas',sintetico:true})});
  return out;
}
function itensModelo(lista){
  const por={};
  lista.forEach(l=>{const o=por[l.item]=por[l.item]||{item:l.item,grupo:l.grupo,un:l.unidade,qtd:0,valor:0,forn:{},pts:[]};
    o.qtd+=l.quantidade||0;o.valor+=l.valor;
    const f=o.forn[l.fornecedor]=o.forn[l.fornecedor]||{qtd:0,valor:0,det:new Set()};
    f.qtd+=l.quantidade||0;f.valor+=l.valor;if(l.detalhe&&!l.sintetico)f.det.add(l.detalhe);
    if(l.preco_unit!=null&&l.quantidade)o.pts.push({mes:l.mes,p:l.preco_unit,f:l.fornecedor})});
  Object.values(por).forEach(o=>o.pts.sort((a,b)=>a.mes<b.mes?-1:1));
  const arr=Object.values(por).sort((a,b)=>(a.item==='Sem detalhe')-(b.item==='Sem detalhe')||b.valor-a.valor);
  const grupos={};lista.forEach(l=>{grupos[l.grupo||'Outros']=(grupos[l.grupo||'Outros']||0)+l.valor});
  return {arr,grupos};
}
/* mesmo item comprado de 2+ fornecedores (usa todos os itens do ano, não só o escopo) */
function comparacao(){
  const todos=itensEscopoTodos(),por={};
  todos.forEach(l=>{if(l.sintetico||l.grupo==='Frete e ajustes'||!l.quantidade)return;const o=por[l.item]=por[l.item]||{item:l.item,un:l.unidade,f:{}};const f=o.f[l.fornecedor]=o.f[l.fornecedor]||{q:0,v:0,det:new Set()};f.q+=l.quantidade;f.v+=l.valor;if(l.detalhe)f.det.add(l.detalhe)});
  return Object.values(por).filter(o=>Object.keys(o.f).length>=2).map(o=>{
    const fs=Object.entries(o.f).map(([n,f])=>({n,p:f.v/f.q,q:f.q,det:[...f.det].join(', ')})).sort((a,b)=>a.p-b.p);
    const bar=fs[0],car=fs[fs.length-1];return {item:o.item,un:o.un,fs,dif:(car.p/bar.p-1)*100,eco:(car.p-bar.p)*car.q}}).sort((a,b)=>b.eco-a.eco);
}
function itensEscopoTodos(){const f=forn;forn='todos';const r=itensEscopo();forn=f;return r}

function spark(vals,cor){const mx=Math.max(...vals,1),w=7,g=2;return `<svg width="${vals.length*(w+g)}" height="26" viewBox="0 0 ${vals.length*(w+g)} 26" aria-hidden="true">${vals.map((v,i)=>{const h=Math.max(v/mx*24,v>0?2:0);return `<rect x="${i*(w+g)}" y="${26-h}" width="${w}" height="${h}" rx="1.5" fill="${cor}"/>`}).join('')}</svg>`}

function atencao(M){
  const out=[];
  M.forns.forEach(f=>{
    const p=M.preco(f),pts=M.meses.map((m,i)=>[m,p[i]]).filter(x=>x[1]!=null);
    if(pts.length>=2){
      const [,ant]=pts[pts.length-2],[mu,ult]=pts[pts.length-1],d=(ult/ant-1)*100;
      if(Math.abs(d)>=3){const imp=(ult-ant)*M.qtd(f,mu);
        out.push(`<div><span class="pill ${d>0?'p-bad':'p-ok'}">Preço</span> ${esc(f)}: ${d>0?'subiu':'caiu'} <b>${Math.abs(d).toFixed(0)}%</b> de ${MES_AB[pts[pts.length-2][0]].toLowerCase()} para ${MES_AB[mu].toLowerCase()} (${R2p(ant)} → ${R2p(ult)}). Impacto no mês: <b>${R(Math.abs(imp))}</b>.</div>`)}}});
  const est=M.ls.filter(l=>l.origem==='estimado');
  if(est.length)out.push(`<div><span class="pill p-warn">Estimado</span> <b>${est.length}</b> de ${M.ls.length} lançamentos ainda são estimativa (${R(est.reduce((a,l)=>a+l.valor,0))}). Troque pelo valor da nota ou do comprovante no lápis da tabela.</div>`);
  if(forn==='todos'){const top=M.forns[0];if(top&&M.total>0){const t=M.ls.filter(l=>l.fornecedor===top).reduce((a,l)=>a+l.valor,0);out.push(`<div><span class="pill p-n">Concentração</span> ${esc(top)} responde por <b>${Math.round(t/M.total*100)}%</b> do gasto do ano.</div>`)}}
  return out.join('')||'<p class="hint">Nada fora do normal.</p>';
}

/* ---------- telas ---------- */
function topo(M){
  const anos=dados.anos.length>1?`<select id="gAno" class="busca" style="width:auto">${dados.anos.map(a=>`<option ${a===dados.ano?'selected':''}>${a}</option>`).join('')}</select>`:'';
  const sel=`<select id="gFornSel" class="busca" style="width:auto"><option value="todos"${forn==='todos'?' selected':''}>Todos os fornecedores</option>${M.todos.map(f=>`<option value="${esc(f)}"${f===forn?' selected':''}>${esc(f)}</option>`).join('')}</select>`;
  const cats=[...new Set(M.ls.map(l=>l.categoria))];
  return `<div class="card s12" style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap"><div><h3 style="margin:0">${forn==='todos'?'Visão geral por fornecedor':esc(forn)}</h3><p class="hint" style="margin:0">${forn==='todos'?'Quanto cada fornecedor custou por mês. Valores "estimado" vêm das conversas com os fornecedores; troque pelo real quando tiver a nota ou o comprovante.':esc(cats.join(' · '))+' · valores "estimado" vêm das conversas; troque pelo real quando tiver a nota ou o comprovante.'}</p></div><div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">${sel}${anos}<button class="btn brasa" data-do="novo">➕ Lançar gasto</button></div></div>`;
}
function tabelaMes(M){
  const mostraF=M.forns.length>1||forn==='todos';
  const linhas=M.meses.map((m,i)=>{
    const ls=M.ls.filter(l=>mesIdx(l.mes)===m),origs=[...new Set(ls.map(l=>l.origem))];
    const pill=origs.length===1&&origs[0]!=='estimado'?`<span class="pill ${ORIGEM[origs[0]][0]}">${ORIGEM[origs[0]][1]}</span>`:origs.every(o=>o==='estimado')?'<span class="pill p-warn">estimado</span>':'<span class="pill p-n">misto</span>';
    const preco=M.qtdMes[i]>0?R2p(M.totMes[i]/M.qtdMes[i]):'—';
    return `<tr><td><b>${MES_AB[m]}/${dados.ano}</b></td>${M.temQtd?`<td class="r">${M.qtdMes[i]?N(Math.round(M.qtdMes[i])):'—'}</td>`:''}${mostraF?M.forns.map(f=>`<td class="r">${M.val(f,m)?R(M.val(f,m)):'<span class="mut">—</span>'}</td>`).join(''):''}<td class="r"><b>${R(M.totMes[i])}</b></td>${M.temQtd?`<td class="r hide-m">${preco}</td>`:''}<td>${pill}</td><td class="r"><button class="ib" data-mes="${m}" title="Ver e editar lançamentos do mês" aria-label="Editar ${MES_AB[m]}">✎</button></td></tr>`}).join('');
  const nc=(mostraF?M.forns.length:0)+(M.temQtd?2:0)+4;
  return `<div class="card s12"><h3>Mês a mês</h3><div class="tw"><table><thead><tr><th>Mês</th>${M.temQtd?'<th class="r">Qtd</th>':''}${mostraF?M.forns.map(f=>`<th class="r">${esc(f)}</th>`).join(''):''}<th class="r">Total</th>${M.temQtd?'<th class="r hide-m">Preço</th>':''}<th>Origem</th><th></th></tr></thead><tbody>${linhas||`<tr><td colspan="${nc}" class="mut">Nenhum lançamento neste ano.</td></tr>`}</tbody>
   <tfoot><tr><td><b>Total</b></td>${M.temQtd?`<td class="r"><b>${N(Math.round(M.qtdTot))}</b></td>`:''}${mostraF?M.forns.map(f=>`<td class="r"><b>${R(M.meses.reduce((a,m)=>a+M.val(f,m),0))}</b></td>`).join(''):''}<td class="r"><b>${R(M.total)}</b></td>${M.temQtd?'<td></td>':''}<td></td><td></td></tr></tfoot></table></div></div>`;
}
function htmlGeral(M){
  const media=M.meses.length?M.total/M.meses.length:0,mx=M.totMes.length?M.totMes.indexOf(Math.max(...M.totMes)):-1;
  const top=M.forns[0],topV=top?M.ls.filter(l=>l.fornecedor===top).reduce((a,l)=>a+l.valor,0):0;
  const linhas=M.forns.map((f,i)=>{
    const lf=M.ls.filter(l=>l.fornecedor===f),tot=lf.reduce((a,l)=>a+l.valor,0),ativos=new Set(lf.map(l=>mesIdx(l.mes))).size;
    const cats=[...new Set(lf.map(l=>l.categoria))].join(', ');
    const doc=lf.filter(l=>l.origem!=='estimado').reduce((a,l)=>a+l.valor,0);
    const serie=M.meses.map(m=>M.val(f,m)),u3=serie.slice(-3).reduce((a,b)=>a+b,0)/Math.max(serie.slice(-3).length,1),a3=serie.slice(-6,-3).reduce((a,b)=>a+b,0)/Math.max(serie.slice(-6,-3).length,1);
    const tend=a3>0?(u3/a3-1)*100:null,cor=corForn(f,M.forns);
    return `<tr><td><span style="display:inline-block;width:10px;height:10px;border-radius:3px;background:${cor};margin-right:8px"></span><b>${esc(f)}</b><br><small class="mut">${esc(cats)}</small></td><td class="r"><b>${R(tot)}</b><br><small class="mut">${pct(tot,M.total)}</small></td><td class="r hide-m">${R(tot/Math.max(ativos,1))}<br><small class="mut">${ativos} mês(es)</small></td><td class="hide-m">${spark(serie,cor)}</td><td class="r hide-m">${tend==null?'<span class="mut">—</span>':`<span class="${tend>5?'down':tend<-5?'up':'mut'}">${tend>0?'+':''}${tend.toFixed(0)}%</span>`}</td><td>${doc/tot>=0.99?'<span class="pill p-ok">documentado</span>':doc/tot>0.01?`<span class="pill p-n">${Math.round(doc/tot*100)}% doc.</span>`:'<span class="pill p-warn">estimado</span>'}</td><td class="r"><button class="btn ghost" data-forn="${esc(f)}">Ver itens</button></td></tr>`}).join('');
  return `<div class="grid">${topo(M)}
  ${kpi('Gasto no ano',R(M.total),M.meses.length?`${MES_AB[M.meses[0]].toLowerCase()} a ${MES_AB[M.meses[M.meses.length-1]].toLowerCase()}`:'')}
  ${kpi('Média mensal',R(media),M.meses.length+' mês(es)')}
  ${kpi('Fornecedores',M.forns.length,'com gasto lançado')}
  ${kpi('Maior fornecedor',top?esc(top):'—',top?`${R(topV)} · ${pct(topV,M.total)}`:'')}
  <div class="card s12"><h3>Gasto por mês e fornecedor</h3><div style="position:relative;height:280px"><canvas id="gF"></canvas></div></div>
  <div class="card s12"><h3>Fornecedores</h3><div class="tw"><table><thead><tr><th>Fornecedor</th><th class="r">Gasto no ano</th><th class="r hide-m">Média por mês</th><th class="hide-m">Evolução</th><th class="r hide-m">Últimos 3 meses</th><th>Origem</th><th></th></tr></thead><tbody>${linhas}</tbody></table></div><p class="hint" style="margin:8px 0 0">“Últimos 3 meses” compara com os 3 anteriores. Clique em <b>Ver itens</b> para o detalhe do que cada fornecedor vende.</p></div>
  <div class="card s12"><h3>Pontos de atenção</h3><div style="display:grid;gap:10px;margin-top:8px">${atencao(M)}</div></div>
  ${tabelaMes(M)}</div>`;
}
function htmlForn(M){
  const f=forn,media=M.meses.length?M.total/M.meses.length:0,part=pct(M.total,M.totalGeral);
  const lista=itensEscopo(),I=itensModelo(lista),detalhado=lista.filter(l=>!l.sintetico).reduce((a,l)=>a+l.valor,0);
  const qtds=M.temQtd?kpi('Quantidade comprada','~'+N(Math.round(M.qtdTot)),'custo médio '+R2p(M.total/M.qtdTot)):kpi('Itens diferentes',I.arr.filter(o=>o.item!=='Sem detalhe').length,detalhado>0?`${pct(detalhado,M.total)} do gasto detalhado`:'sem detalhe por item');
  const linhas=I.arr.map(o=>{
    const pts=o.pts,primeiro=pts[0],ultimo=pts[pts.length-1];
    const var_=pts.length>=2?(ultimo.p/primeiro.p-1)*100:null;
    const fs=Object.entries(o.forn).map(([n,x])=>x.qtd?`${R2p(x.valor/x.qtd)}<small class="mut">/${esc(o.un||'un')}${x.det.size?' · '+esc([...x.det].join(', ')):''}</small>`:'<span class="mut">—</span>').join('<br>');
    return `<tr${o.item==='Sem detalhe'?' style="opacity:.75"':''}><td><b>${esc(o.item)}</b><br><span class="pill p-n">${esc(o.grupo||'Outros')}</span></td><td class="r">${o.qtd?N(+o.qtd.toFixed(2))+' '+esc(o.un||''):'—'}</td><td class="r"><b>${R(o.valor)}</b></td><td class="r hide-m">${pct(o.valor,M.total)}</td><td class="r">${fs}</td><td class="r hide-m">${var_==null?'<span class="mut">—</span>':`<span class="${var_>3?'down':var_<-3?'up':'mut'}">${var_>0?'+':''}${var_.toFixed(0)}%</span><br><small class="mut">${R2p(primeiro.p)} → ${R2p(ultimo.p)}</small>`}</td></tr>`}).join('');
  const comp=comparacao().filter(c=>c.fs.some(x=>x.n===f)).map(c=>{
    const eu=c.fs.find(x=>x.n===f),bar=c.fs[0],maisBarato=bar.n===f;
    return `<div style="padding:10px 0;border-top:1px solid var(--line)"><div style="display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap"><b>${esc(c.item)}</b><span class="pill ${maisBarato?'p-ok':'p-bad'}">${maisBarato?'o mais barato':`${((eu.p/bar.p-1)*100).toFixed(0)}% mais caro`}</span></div><div class="hint" style="margin:4px 0 0">${c.fs.map(x=>`${esc(x.n)} <b>${R2p(x.p)}</b>/${esc(c.un||'un')}${x.det?` <span class="mut">(${esc(x.det)})</span>`:''}`).join(' · ')}</div>${maisBarato?'':`<div class="hint" style="margin:2px 0 0">Comprando o que ${esc(f)} vendeu no mais barato, a diferença seria de cerca de <b class="up">${R((eu.p-bar.p)*eu.q)}</b>.</div>`}</div>`}).join('');
  const nGr=Object.keys(I.grupos).length;
  return `<div class="grid">${topo(M)}
  ${kpi('Gasto no ano',R(M.total),`${part} do total geral`)}
  ${kpi('Média mensal',R(media),M.meses.length+' mês(es)')}
  ${qtds}
  ${kpi('Último mês',M.totMes.length?R(M.totMes[M.totMes.length-1]):'—',M.meses.length?MES_AB[M.meses[M.meses.length-1]]+'/'+dados.ano:'')}
  <div class="card ${M.temQtd?'s6':'s12'}"><h3>Gasto por mês</h3><div style="position:relative;height:230px"><canvas id="gF"></canvas></div></div>
  ${M.temQtd?'<div class="card s6"><h3>Preço por unidade</h3><p class="hint" style="margin:0 0 8px">Valor ÷ quantidade, mês a mês</p><div style="position:relative;height:200px"><canvas id="gP"></canvas></div></div>':''}
  <div class="card s12"><h3>O que ${esc(f)} vende para a gente</h3><p class="hint" style="margin:0 0 8px">${detalhado>0?`${R(detalhado)} detalhados item a item (${pct(detalhado,M.total)} do gasto).`:'Sem detalhe por item nas conversas; mostrando o total do que foi lançado.'}${lista.some(l=>l.item==='Sem detalhe')?' Linhas “Sem detalhe” são notas que não estavam nas conversas.':''}</p>
   <div class="tw"><table><thead><tr><th>Item</th><th class="r">Quantidade</th><th class="r">Gasto</th><th class="r hide-m">% do fornecedor</th><th class="r">Preço médio</th><th class="r hide-m">Variação</th></tr></thead><tbody>${linhas}</tbody></table></div></div>
  ${nGr>1?`<div class="card s6"><h3>Gasto por grupo de item</h3><div style="position:relative;height:${Math.max(190,nGr*38)}px;margin-top:6px"><canvas id="gG"></canvas></div></div>`:''}
  <div class="card ${nGr>1?'s6':'s12'}"><h3>Comparação com outros fornecedores</h3><p class="hint" style="margin:0 0 4px">Itens de ${esc(f)} que também compramos em outro lugar</p>${comp||'<p class="hint">Nenhum item deste fornecedor foi comprado de outro.</p>'}</div>
  <div class="card s12"><h3>Pontos de atenção</h3><div style="display:grid;gap:10px;margin-top:8px">${atencao(M)}</div></div>
  ${tabelaMes(M)}</div>`;
}
function html(){const M=modelo();return forn==='todos'?htmlGeral(M):htmlForn(M)}

/* ---------- gráficos ---------- */
function graf(){
  if(!window.Chart)return;const M=modelo();if(!M.meses.length)return;
  Chart.defaults.color=css('--ink-2');Chart.defaults.borderColor=css('--line');Chart.defaults.font.family='Figtree, system-ui, sans-serif';
  const line=css('--line'),labels=M.meses.map(m=>MES_AB[m]);
  desenhar('gF',{type:'bar',data:{labels,datasets:M.forns.map((f,i)=>({label:f,data:M.meses.map(m=>M.val(f,m)),backgroundColor:corForn(f,M.forns),borderRadius:5,maxBarThickness:34}))},
    options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:M.forns.length>1,position:'bottom',labels:{boxWidth:10,boxHeight:10,usePointStyle:true}},tooltip:{callbacks:{label:c=>c.dataset.label+': '+R(c.parsed.y),footer:i=>M.forns.length>1?'Total: '+R(i.reduce((a,b)=>a+b.parsed.y,0)):''}}},
    scales:{x:{stacked:true,grid:{display:false}},y:{stacked:true,grid:{color:line},ticks:{callback:v=>R(v)}}}}});
  if(M.temQtd){
    const ds=M.forns.map((f,i)=>({label:f,data:M.preco(f),stepped:true,borderColor:corForn(f,M.forns),backgroundColor:corForn(f,M.forns),borderWidth:2.5,pointRadius:4})).filter(d=>d.data.some(v=>v!=null));
    desenhar('gP',{type:'line',data:{labels,datasets:ds},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:ds.length>1,position:'bottom',labels:{boxWidth:10,boxHeight:10,usePointStyle:true}},tooltip:{callbacks:{label:c=>c.dataset.label+': '+R2p(c.parsed.y??0)}}},
      scales:{x:{grid:{display:false}},y:{grid:{color:line},ticks:{callback:v=>R2p(v)}}}}});
  }
  if(forn!=='todos'&&document.getElementById('gG')){
    const gs=Object.entries(itensModelo(itensEscopo()).grupos).sort((a,b)=>b[1]-a[1]),cor=n=>{const c=GRUPO_COR[n]||'#9a9a9a';return c.startsWith('--')?css(c):c};
    desenhar('gG',{type:'bar',data:{labels:gs.map(g=>g[0]),datasets:[{data:gs.map(g=>g[1]),backgroundColor:gs.map(g=>cor(g[0])),borderRadius:5,maxBarThickness:22}]},options:{indexAxis:'y',responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false},tooltip:{callbacks:{label:c=>R(c.parsed.x)}}},scales:{x:{grid:{color:line},ticks:{callback:v=>R(v)}},y:{grid:{display:false}}}}});
  }
}

function fechar(){if(modal){modal.remove();modal=null}}
function abrir(h){fechar();modal=document.createElement('div');modal.className='modal-bg';modal.innerHTML=`<div class="modal" role="dialog" aria-modal="true">${h}</div>`;
  modal.addEventListener('click',e=>{if(e.target===modal||e.target.closest('[data-cx]'))fechar()});document.getElementById('app').appendChild(modal)}
const mhead=(l,t)=>`<div class="m-head"><div><div class="lbl">${l}</div><h3>${esc(t)}</h3></div><button class="ib" data-cx="fechar" aria-label="Fechar">✕</button></div>`;

const catPadrao=()=>{const l=dados.linhas.filter(x=>forn==='todos'||x.fornecedor===forn).slice(-1)[0];return l?l.categoria:'Discos de hambúrguer'};
function dlgLancar(l){
  const novo=!l,hoje=new Date(),mesAtual=l?l.mes.slice(0,7):`${dados.ano}-${String(hoje.getMonth()+1).padStart(2,'0')}`;
  const forns=[...new Set([...dados.linhas.map(x=>x.fornecedor),...(dados.fornecedores_cadastrados||[])])];
  abrir(`${mhead(novo?'Novo lançamento':'Editar lançamento',novo?'Lançar gasto':l.fornecedor+' · '+MES_AB[mesIdx(l.mes)]+'/'+l.mes.slice(0,4))}
  <form class="mform" id="fGasto">
   <label>Fornecedor<input id="gForn" list="gFornL" maxlength="60" required value="${esc(l?l.fornecedor:(forn==='todos'?'':forn))}" placeholder="ex: Ki Karnes"${l?' readonly':''}><datalist id="gFornL">${forns.map(f=>`<option value="${esc(f)}">`).join('')}</datalist></label>
   <label>Mês<input id="gMes" type="month" required value="${mesAtual}"${l?' readonly':''}></label>
   <label>Categoria<input id="gCat" maxlength="60" value="${esc(l?l.categoria:catPadrao())}"${l?' readonly':''}></label>
   <label>Valor (R$)<input id="gVal" type="number" min="0" step="0.01" inputmode="decimal" required value="${l?l.valor:''}"></label>
   <label>Quantidade <small>(discos, opcional)</small><input id="gQtd" type="number" min="0" step="any" inputmode="decimal" value="${l&&l.quantidade!=null?l.quantidade:''}"></label>
   <label>Origem do valor<select id="gOri"><option value="estimado"${!l||l.origem==='estimado'?' selected':''}>Estimado</option><option value="nota"${l&&l.origem==='nota'?' selected':''}>Nota fiscal</option><option value="pago"${l&&l.origem==='pago'?' selected':''}>Pago (comprovante)</option></select></label>
   <label>Observação (opcional)<input id="gObs" maxlength="200" value="${esc(l?l.obs||'':'')}" placeholder="ex: NF 556, 300 discos a R$ 5,50"></label>
   <div class="m-foot">${l?'<button type="button" class="btn ghost" data-del style="margin-right:auto;color:var(--bad)">Excluir</button>':''}<button type="button" class="btn ghost" data-cx="fechar">Cancelar</button><button class="btn brasa">Salvar</button></div></form>`);
  const g=id=>document.getElementById(id);
  g('fGasto').addEventListener('submit',async ev=>{ev.preventDefault();
    const r=await post('/api/gastos_fornecedor',{fornecedor:g('gForn').value,mes:g('gMes').value,categoria:g('gCat').value,valor:g('gVal').value,quantidade:g('gQtd').value,origem:g('gOri').value,obs:g('gObs').value});
    if(!r.ok){toast(r.erro||'Não foi possível salvar');return}fechar();toast('Lançamento salvo');carregar()});
  const d=modal.querySelector('[data-del]');if(d)d.addEventListener('click',async()=>{if(!confirm('Excluir este lançamento?'))return;const r=await post('/api/gastos_fornecedor_delete',{id:l.id});if(r.ok){fechar();toast('Lançamento excluído');carregar()}});
}

function dlgMes(m){
  const ls=dados.linhas.filter(l=>mesIdx(l.mes)===m);
  abrir(`${mhead('Lançamentos',MES_AB[m]+'/'+dados.ano)}<div class="tw"><table><thead><tr><th>Fornecedor</th><th>Categoria</th><th class="r">Valor</th><th class="r">Qtd</th><th>Origem</th><th></th></tr></thead><tbody>${ls.map(l=>`<tr><td><b>${esc(l.fornecedor)}</b>${l.obs?`<br><small class="mut">${esc(l.obs)}</small>`:''}</td><td>${esc(l.categoria)}</td><td class="r">${R2(l.valor)}</td><td class="r">${l.quantidade!=null?N(l.quantidade):'—'}</td><td><span class="pill ${ORIGEM[l.origem][0]}">${ORIGEM[l.origem][1]}</span></td><td class="r"><button class="ib" data-ed="${l.id}" aria-label="Editar">✎</button></td></tr>`).join('')}</tbody></table></div><div class="m-foot"><button type="button" class="btn ghost" data-cx="fechar">Fechar</button></div>`);
  modal.addEventListener('click',e=>{const b=e.target.closest('[data-ed]');if(b){const l=dados.linhas.find(x=>x.id===+b.dataset.ed);if(l)dlgLancar(l)}});
}

function desenharTela(){el.innerHTML=html();carregarChart().then(graf).catch(()=>{})}
function carregar(){
  fetch('/api/gastos_fornecedor'+(ano?'?ano='+ano:'')).then(r=>r.json()).then(async d=>{if(!d.ok)throw 0;dados=d;ano=d.ano;
    try{const i=await fetch('/api/gastos_itens?ano='+ano).then(r=>r.json());itens=i.ok?i.itens:[]}catch(e){itens=[]}
    if(forn!=='todos'&&!dados.linhas.some(l=>l.fornecedor===forn))forn='todos';
    desenharTela()})
   .catch(()=>{el.innerHTML='<div class="card"><h3>Não foi possível carregar</h3><p class="hint">Tente de novo em instantes.</p></div>'})}
function ligar(){
  document.addEventListener('click',e=>{if(!el||!el.isConnected)return;
    const b=e.target.closest('[data-do="novo"]');if(b){dlgLancar(null);return}
    const f=e.target.closest('[data-forn]');if(f){forn=f.dataset.forn;desenharTela();window.scrollTo&&el.scrollIntoView&&el.scrollIntoView({block:'start'});return}
    const m=e.target.closest('[data-mes]');if(m){dlgMes(+m.dataset.mes)}});
  document.addEventListener('change',e=>{if(e.target.id==='gAno'){ano=+e.target.value;carregar()}if(e.target.id==='gFornSel'){forn=e.target.value;desenharTela()}});
}
window.V2.screens.gastos={render(c){el=c;el.innerHTML='<div class="card"><p class="hint" style="margin:0">Carregando gastos…</p></div>';if(!ligado){ligar();ligado=true}carregar()},onFiltros(){}};
})();
