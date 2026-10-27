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
let el=null,ligado=false,dados=null,itens=[],ano=null,cat='todas',charts={},modal=null;
const kpi=(l,v,s,x='')=>`<div class="card kpi s3"><div class="k-l">${l}</div><div class="k-v ${x}">${v}</div>${s?`<div class="k-s">${s}</div>`:''}</div>`;
const mesIdx=iso=>+iso.slice(5,7)-1;

function carregarChart(){if(window.Chart)return Promise.resolve();return new Promise((ok,err)=>{const s=document.createElement('script');s.src='https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js';s.onload=ok;s.onerror=err;document.head.appendChild(s)})}
function desenhar(id,cfg){const c=document.getElementById(id);if(!c)return;if(charts[id])charts[id].destroy();charts[id]=new Chart(c,cfg)}

function modelo(){
  const ls=dados.linhas.filter(l=>cat==='todas'||l.categoria===cat),forns=[...new Set(ls.map(l=>l.fornecedor))];
  const meses=[...new Set(ls.map(l=>mesIdx(l.mes)))].sort((a,b)=>a-b);
  const idx={};ls.forEach(l=>{(idx[l.fornecedor+'|'+mesIdx(l.mes)]=idx[l.fornecedor+'|'+mesIdx(l.mes)]||[]).push(l)});
  const val=(f,m)=>(idx[f+'|'+m]||[]).reduce((a,l)=>a+l.valor,0);
  const qtd=(f,m)=>(idx[f+'|'+m]||[]).reduce((a,l)=>a+(l.quantidade||0),0);
  const totMes=meses.map(m=>forns.reduce((a,f)=>a+val(f,m),0));
  const qtdMes=meses.map(m=>forns.reduce((a,f)=>a+qtd(f,m),0));
  const total=totMes.reduce((a,b)=>a+b,0),qtdTot=qtdMes.reduce((a,b)=>a+b,0);
  /* preço por unidade de cada fornecedor mês a mês (só onde há quantidade) */
  const preco=f=>meses.map(m=>qtd(f,m)>0?val(f,m)/qtd(f,m):null);
  const temQtd=ls.length>0&&ls.every(l=>l.quantidade>0);
  return {temQtd,ls,forns,meses,val,qtd,totMes,qtdMes,total,qtdTot,preco};
}

function atencao(M){
  const out=[];
  M.forns.forEach(f=>{
    const p=M.preco(f),pts=M.meses.map((m,i)=>[m,p[i]]).filter(x=>x[1]!=null);
    if(pts.length>=2){
      const [,ant]=pts[pts.length-2],[mu,ult]=pts[pts.length-1];
      const d=(ult/ant-1)*100;
      if(Math.abs(d)>=3){
        const q=M.qtd(f,mu),imp=(ult-ant)*q;
        out.push(`<div><span class="pill ${d>0?'p-bad':'p-ok'}">Preço</span> ${esc(f)}: ${d>0?'subiu':'caiu'} <b>${Math.abs(d).toFixed(0)}%</b> de ${MES_AB[pts[pts.length-2][0]].toLowerCase()} para ${MES_AB[mu].toLowerCase()} (R$ ${ant.toFixed(2).replace('.',',')} → R$ ${ult.toFixed(2).replace('.',',')}). Impacto no mês: <b>${R(Math.abs(imp))}</b>.</div>`)}}});
  const est=M.ls.filter(l=>l.origem==='estimado').length;
  if(est)out.push(`<div><span class="pill p-warn">Estimado</span> <b>${est}</b> de ${M.ls.length} lançamentos ainda são estimativa. Troque pelo valor da nota ou do comprovante no lápis da tabela.</div>`);
  const top=M.forns.map(f=>[f,M.meses.reduce((a,m)=>a+M.val(f,m),0)]).sort((a,b)=>b[1]-a[1])[0];
  if(top&&M.total>0)out.push(`<div><span class="pill p-n">Concentração</span> ${esc(top[0])} responde por <b>${Math.round(top[1]/M.total*100)}%</b> do gasto do ano.</div>`);
  return out.join('')||'<p class="hint">Nada fora do normal.</p>';
}

const GRUPO_COR={'Molhos e sachês':'--brasa','Batata':'#d9a21b','Queijos':'#e0873a','Óleo':'#5b8def','Descartáveis e limpeza':'#2e9e6b','Proteínas':'#a855a7','Temperos':'#7c6f64','Embalagens':'#4a8f9a','Frete e ajustes':'#9a9a9a'};
function itensModelo(){
  const por={};
  itens.forEach(l=>{const k=l.item;const o=por[k]=por[k]||{item:k,grupo:l.grupo,un:l.unidade,qtd:0,valor:0,compras:0,forn:{},ult:null};
    o.qtd+=l.quantidade||0;o.valor+=l.valor;o.compras++;
    const f=o.forn[l.fornecedor]=o.forn[l.fornecedor]||{qtd:0,valor:0,ult:null,det:new Set()};
    f.qtd+=l.quantidade||0;f.valor+=l.valor;if(l.detalhe)f.det.add(l.detalhe);
    if(l.preco_unit!=null&&(!f.ult||l.mes>=f.ult.mes))f.ult={mes:l.mes,p:l.preco_unit};
    if(l.preco_unit!=null&&(!o.ult||l.mes>=o.ult.mes))o.ult={mes:l.mes,p:l.preco_unit,f:l.fornecedor}});
  const lista=Object.values(por).sort((a,b)=>b.valor-a.valor);
  const grupos={};itens.forEach(l=>{grupos[l.grupo||'Outros']=(grupos[l.grupo||'Outros']||0)+l.valor});
  /* comparação: item comprado de 2+ fornecedores, preço médio = valor/qtd */
  const comp=lista.filter(o=>Object.keys(o.forn).length>=2&&o.grupo!=='Frete e ajustes').map(o=>{
    const fs=Object.entries(o.forn).filter(([,f])=>f.qtd>0).map(([n,f])=>({n,p:f.valor/f.qtd,qtd:f.qtd,det:[...f.det].join(', ')})).sort((a,b)=>a.p-b.p);
    if(fs.length<2)return null;const bar=fs[0],car=fs[fs.length-1];
    return {item:o.item,un:o.un,fs,dif:(car.p/bar.p-1)*100,eco:(car.p-bar.p)*car.qtd}}).filter(Boolean).sort((a,b)=>b.eco-a.eco);
  return {lista,grupos,comp};
}
const R2p=v=>'R$ '+(+v).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});
function itensHtml(M){
  if(!itens.length)return '';
  const I=itensModelo(),totItens=itens.reduce((a,l)=>a+l.valor,0);
  const cobertura=M.total>0?Math.round(totItens/M.total*100):0;
  const linhas=I.lista.map(o=>{const fs=Object.entries(o.forn).map(([n,f])=>`<div>${esc(n)}: <b>${f.qtd?R2p(f.valor/f.qtd):'—'}</b><small class="mut"> ${f.qtd?N(+f.qtd.toFixed(2))+' '+esc(o.un||''):''}${f.det.size?' · '+esc([...f.det].join(', ')):''}</small></div>`).join('');
    return `<tr><td><b>${esc(o.item)}</b><br><span class="pill p-n">${esc(o.grupo||'Outros')}</span></td><td class="r">${o.qtd?N(+o.qtd.toFixed(2))+' '+esc(o.un||''):'—'}</td><td class="r"><b>${R(o.valor)}</b></td><td class="r hide-m">${M.total>0?(o.valor/M.total*100).toFixed(1).replace('.',',')+'%':''}</td><td>${fs}</td></tr>`}).join('');
  const cmp=I.comp.length?I.comp.map(c=>`<div style="padding:10px 0;border-top:1px solid var(--line)"><div style="display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap"><b>${esc(c.item)}</b><span class="pill ${c.dif>=8?'p-bad':'p-warn'}">${c.fs[c.fs.length-1].n} ${c.dif.toFixed(0)}% mais caro</span></div><div class="hint" style="margin:4px 0 0">${c.fs.map(f=>`${esc(f.n)} <b>${R2p(f.p)}</b>/${esc(c.un||'un')}${f.det?` <span class="mut">(${esc(f.det)})</span>`:''}`).join(' · ')}</div><div class="hint" style="margin:2px 0 0">Comprando tudo no mais barato, a diferença seria de cerca de <b class="up">${R(c.eco)}</b> no período.</div></div>`).join(''):'<p class="hint">Nenhum item foi comprado de mais de um fornecedor.</p>';
  const ecoTot=I.comp.reduce((a,c)=>a+c.eco,0);
  return `<div class="card s12"><h3>Itens comprados</h3><p class="hint" style="margin:0 0 8px">${R(totItens)} detalhados item a item (${cobertura}% do gasto desta categoria no ano). O resto fica sem detalhe porque a nota ou o pedido não estava nas conversas.</p>
   <div class="tw"><table><thead><tr><th>Item</th><th class="r">Quantidade</th><th class="r">Gasto</th><th class="r hide-m">% do total</th><th>Preço por fornecedor</th></tr></thead><tbody>${linhas}</tbody></table></div></div>
  <div class="card s6"><h3>Gasto por grupo de item</h3><div style="position:relative;height:${Math.max(190,Object.keys(I.grupos).length*38)}px;margin-top:6px"><canvas id="gG"></canvas></div></div>
  <div class="card s6"><h3>Comparação de preço entre fornecedores</h3><p class="hint" style="margin:0 0 4px">Mesmo item comprado em mais de um fornecedor${ecoTot>0?` · potencial total de ${R(ecoTot)}`:''}</p>${cmp}</div>`;
}
function html(){
  const M=modelo(),mx=M.totMes.length?M.totMes.indexOf(Math.max(...M.totMes)):-1;
  const media=M.meses.length?M.total/M.meses.length:0;
  const linhas=M.meses.map((m,i)=>{
    const ls=M.ls.filter(l=>mesIdx(l.mes)===m),origs=[...new Set(ls.map(l=>l.origem))];
    const pill=origs.length===1&&origs[0]!=='estimado'?`<span class="pill ${ORIGEM[origs[0]][0]}">${ORIGEM[origs[0]][1]}</span>`:origs.every(o=>o==='estimado')?'<span class="pill p-warn">estimado</span>':'<span class="pill p-n">misto</span>';
    const preco=M.qtdMes[i]>0?'R$ '+(M.totMes[i]/M.qtdMes[i]).toFixed(2).replace('.',','):'—';
    return `<tr><td><b>${MES_AB[m]}/${dados.ano}</b></td>${M.temQtd?`<td class="r">${M.qtdMes[i]?N(Math.round(M.qtdMes[i])):'—'}</td>`:''}${M.forns.map(f=>`<td class="r">${M.val(f,m)?R(M.val(f,m)):'<span class="mut">—</span>'}</td>`).join('')}<td class="r"><b>${R(M.totMes[i])}</b></td>${M.temQtd?`<td class="r hide-m">${preco}</td>`:''}<td>${pill}</td><td class="r"><button class="ib" data-mes="${m}" title="Ver e editar lançamentos do mês" aria-label="Editar ${MES_AB[m]}">✎</button></td></tr>`}).join('');
  const cats=[...new Set(dados.linhas.map(l=>l.categoria))];
  const catSel=cats.length>1?`<select id="gCatSel" class="busca" style="width:auto"><option value="todas"${cat==='todas'?' selected':''}>Todas as categorias</option>${cats.map(c=>`<option value="${esc(c)}"${c===cat?' selected':''}>${esc(c)}</option>`).join('')}</select>`:'';
  const anos=dados.anos.length>1?`<select id="gAno" class="busca" style="width:auto">${dados.anos.map(a=>`<option ${a===dados.ano?'selected':''}>${a}</option>`).join('')}</select>`:'';
  return `<div class="grid">
  <div class="card s12" style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap"><div><h3 style="margin:0">${cat==='todas'?'Todos os gastos':esc(cat)}</h3><p class="hint" style="margin:0">Quanto cada fornecedor custou por mês. Valores "estimado" vêm das conversas com os fornecedores; troque pelo real quando tiver a nota ou o comprovante.</p></div><div style="display:flex;gap:8px;align-items:center">${catSel}${anos}<button class="btn brasa" data-do="novo">➕ Lançar gasto</button></div></div>
  ${kpi('Gasto no ano',R(M.total),M.meses.length?`${MES_AB[M.meses[0]].toLowerCase()} a ${MES_AB[M.meses[M.meses.length-1]].toLowerCase()}`:'')}
  ${kpi('Média mensal',R(media),M.meses.length+' mês(es)')}
  ${M.temQtd?kpi('Discos comprados','~'+N(Math.round(M.qtdTot)),'custo médio '+R2(M.total/M.qtdTot)):kpi('Fornecedores',M.forns.length,M.forns.map(esc).join(' · '))}
  ${kpi('Maior mês',mx>=0?MES_AB[M.meses[mx]]+' · '+R(M.totMes[mx]):'—',mx>0?(M.totMes[mx]>=M.totMes[mx-1]?'+':'')+Math.round((M.totMes[mx]/M.totMes[mx-1]-1)*100)+'% vs '+MES_AB[M.meses[mx-1]].toLowerCase():'',mx>0?'down':'')}
  <div class="card s12"><h3>Gasto por mês e fornecedor</h3><div style="position:relative;height:280px"><canvas id="gF"></canvas></div></div>
  ${M.temQtd?'<div class="card s6"><h3>Preço por disco</h3><p class="hint" style="margin:0 0 8px">Valor ÷ quantidade, por fornecedor</p><div style="position:relative;height:220px"><canvas id="gP"></canvas></div></div>':''}
  <div class="card ${M.temQtd?'s6':'s12'}"><h3>Pontos de atenção</h3><div style="display:grid;gap:10px;margin-top:8px">${atencao(M)}</div></div>
  <div class="card s12"><h3>Mês a mês</h3><div class="tw"><table><thead><tr><th>Mês</th>${M.temQtd?'<th class="r">Discos</th>':''}${M.forns.map(f=>`<th class="r">${esc(f)}</th>`).join('')}<th class="r">Total</th>${M.temQtd?'<th class="r hide-m">Preço</th>':''}<th>Origem</th><th></th></tr></thead><tbody>${linhas||`<tr><td colspan="${M.forns.length+(M.temQtd?6:4)}" class="mut">Nenhum lançamento neste ano.</td></tr>`}</tbody>
   <tfoot><tr><td><b>Total</b></td>${M.temQtd?`<td class="r"><b>${N(Math.round(M.qtdTot))}</b></td>`:''}${M.forns.map(f=>`<td class="r"><b>${R(M.meses.reduce((a,m)=>a+M.val(f,m),0))}</b></td>`).join('')}<td class="r"><b>${R(M.total)}</b></td>${M.temQtd?'<td></td>':''}<td></td><td></td></tr></tfoot></table></div></div>
  ${cat==='Insumos secos'?itensHtml(M):''}
  </div>`;
}

function grafGrupos(){
  if(cat!=='Insumos secos'||!itens.length||!window.Chart||!document.getElementById('gG'))return;
  const I=itensModelo(),gs=Object.entries(I.grupos).sort((a,b)=>b[1]-a[1]);
  const cor=n=>{const c=GRUPO_COR[n]||'#9a9a9a';return c.startsWith('--')?css(c):c};
  desenhar('gG',{type:'bar',data:{labels:gs.map(g=>g[0]),datasets:[{data:gs.map(g=>g[1]),backgroundColor:gs.map(g=>cor(g[0])),borderRadius:5,maxBarThickness:22}]},options:{indexAxis:'y',responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false},tooltip:{callbacks:{label:c=>R(c.parsed.x)}}},scales:{x:{grid:{color:css('--line')},ticks:{callback:v=>R(v)}},y:{grid:{display:false}}}}});
}
function graf(){
  grafGrupos();
  const M=modelo();if(!M.meses.length||!window.Chart)return;
  Chart.defaults.color=css('--ink-2');Chart.defaults.borderColor=css('--line');Chart.defaults.font.family='Figtree, system-ui, sans-serif';
  const pal=[css('--brasa'),css('--ink-2'),'#5b8def','#2e9e6b','#d9a21b','#a855a7'],line=css('--line'),labels=M.meses.map(m=>MES_AB[m]);
  desenhar('gF',{type:'bar',data:{labels,datasets:M.forns.map((f,i)=>({label:f,data:M.meses.map(m=>M.val(f,m)),backgroundColor:pal[i%pal.length],borderRadius:5,maxBarThickness:34}))},
    options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:'bottom',labels:{boxWidth:10,boxHeight:10,usePointStyle:true}},tooltip:{callbacks:{label:c=>c.dataset.label+': '+R(c.parsed.y),footer:i=>'Total: '+R(i.reduce((a,b)=>a+b.parsed.y,0))}}},
    scales:{x:{stacked:true,grid:{display:false}},y:{stacked:true,grid:{color:line},ticks:{callback:v=>R(v)}}}}});
  if(!M.temQtd)return;
  const ds=M.forns.map((f,i)=>({label:f,data:M.preco(f),stepped:true,spanGaps:false,borderColor:pal[i%pal.length],backgroundColor:pal[i%pal.length],borderWidth:2.5,pointRadius:4})).filter(d=>d.data.some(v=>v!=null));
  desenhar('gP',{type:'line',data:{labels,datasets:ds},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:'bottom',labels:{boxWidth:10,boxHeight:10,usePointStyle:true}},tooltip:{callbacks:{label:c=>c.dataset.label+': R$ '+(c.parsed.y??0).toFixed(2).replace('.',',')}}},
    scales:{x:{grid:{display:false}},y:{grid:{color:line},ticks:{callback:v=>'R$ '+v.toFixed(2).replace('.',',')}}}}});
}

function fechar(){if(modal){modal.remove();modal=null}}
function abrir(h){fechar();modal=document.createElement('div');modal.className='modal-bg';modal.innerHTML=`<div class="modal" role="dialog" aria-modal="true">${h}</div>`;
  modal.addEventListener('click',e=>{if(e.target===modal||e.target.closest('[data-cx]'))fechar()});document.getElementById('app').appendChild(modal)}
const mhead=(l,t)=>`<div class="m-head"><div><div class="lbl">${l}</div><h3>${esc(t)}</h3></div><button class="ib" data-cx="fechar" aria-label="Fechar">✕</button></div>`;

function dlgLancar(l){
  const novo=!l,hoje=new Date(),mesAtual=l?l.mes.slice(0,7):`${dados.ano}-${String(hoje.getMonth()+1).padStart(2,'0')}`;
  const forns=[...new Set([...dados.linhas.map(x=>x.fornecedor),...(dados.fornecedores_cadastrados||[])])];
  abrir(`${mhead(novo?'Novo lançamento':'Editar lançamento',novo?'Lançar gasto':l.fornecedor+' · '+MES_AB[mesIdx(l.mes)]+'/'+l.mes.slice(0,4))}
  <form class="mform" id="fGasto">
   <label>Fornecedor<input id="gForn" list="gFornL" maxlength="60" required value="${esc(l?l.fornecedor:'')}" placeholder="ex: Ki Karnes"${l?' readonly':''}><datalist id="gFornL">${forns.map(f=>`<option value="${esc(f)}">`).join('')}</datalist></label>
   <label>Mês<input id="gMes" type="month" required value="${mesAtual}"${l?' readonly':''}></label>
   <label>Categoria<input id="gCat" maxlength="60" value="${esc(l?l.categoria:'Discos de hambúrguer')}"${l?' readonly':''}></label>
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
  fetch('/api/gastos_fornecedor'+(ano?'?ano='+ano:'')).then(r=>r.json()).then(async d=>{if(!d.ok)throw 0;dados=d;ano=d.ano;try{const i=await fetch('/api/gastos_itens?ano='+ano+'&categoria='+encodeURIComponent('Insumos secos')).then(r=>r.json());itens=i.ok?i.itens:[]}catch(e){itens=[]}desenharTela()})
   .catch(()=>{el.innerHTML='<div class="card"><h3>Não foi possível carregar</h3><p class="hint">Tente de novo em instantes.</p></div>'})}
function ligar(){
  document.addEventListener('click',e=>{if(!el||!el.isConnected)return;
    const b=e.target.closest('[data-do="novo"]');if(b){dlgLancar(null);return}
    const m=e.target.closest('[data-mes]');if(m){dlgMes(+m.dataset.mes)}});
  document.addEventListener('change',e=>{if(e.target.id==='gAno'){ano=+e.target.value;carregar()}if(e.target.id==='gCatSel'){cat=e.target.value;desenharTela()}});
}
window.V2.screens.gastos={render(c){el=c;el.innerHTML='<div class="card"><p class="hint" style="margin:0">Carregando gastos…</p></div>';if(!ligado){ligar();ligado=true}carregar()},onFiltros(){}};
})();
