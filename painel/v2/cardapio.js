/* Painel 2.0 — tela Cardápio: quadrante mágico, encalhados, produtos e custos (CMV editável), excluídos */
(function(){
const R=v=>(+(v??0)).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
const N=v=>(+(v??0)).toLocaleString('pt-BR');
const esc=t=>String(t??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;');
const css=n=>getComputedStyle(document.documentElement).getPropertyValue(n).trim();
const post=(url,corpo)=>fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(corpo)}).then(r=>r.json());
const ativoAgora=()=>!!document.getElementById('k-quad');
const semAcento=s=>(s??'').toString().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'');
const EMOJI={'Estrela':'⭐','Burro de carga':'🐴','Quebra-cabeça':'🧩','Abacaxi':'🍍'};
const cor=c=>({'Estrela':css('--ok'),'Burro de carga':css('--c-sob'),'Quebra-cabeça':css('--c-chomp'),'Abacaxi':css('--bad')})[c]||css('--ink-2');
let el=null,ligado=false,chart=null,dados=null,enc=null,timer=null;
let st={dias:90,classe:'',busca:''};

const mediana=a=>{const s=[...a].sort((x,y)=>x-y),m=Math.floor(s.length/2);return s.length%2?s[m]:(s[m-1]+s[m])/2};
function carregarChart(){if(window.Chart)return Promise.resolve();return new Promise((ok,err)=>{const s=document.createElement('script');s.src='https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js';s.onload=ok;s.onerror=err;document.head.appendChild(s)})}
const qBase=()=>{const f=window.V2.filtros;return `marca=${encodeURIComponent(f.marca)}&unidade=${encodeURIComponent(f.unidade)}`};

function esqueleto(){
  el.innerHTML=`<div class="g">
  <div class="card s12 ctrl-per"><div class="filters"><span class="lbl">Janela de vendas</span><select id="k-dias" aria-label="Janela">${[30,60,90].map(v=>`<option value="${v}"${v===st.dias?' selected':''}>Últimos ${v} dias</option>`).join('')}</select></div></div>
  <div class="s12" id="k-aviso" hidden></div>
  <div class="sec" id="quadrante">Quadrante mágico</div>
  <div class="card s12" id="k-quad"><h3>Quadrante mágico <span class="info2" title="Cada bolinha é um produto: quanto mais pra direita, mais vende; quanto mais pra cima, mais margem por unidade deixa (preço médio − CMV). As linhas tracejadas são as medianas e dividem os 4 grupos.">?</span></h3>
   <p class="hint">Popularidade × margem unitária — o raio-X de lucro do seu cardápio</p>
   <div class="legenda" id="k-leg"></div><div class="area" style="height:380px"><canvas id="gQuad"></canvas></div></div>
  <div class="sec" id="encalhados">Encalhados</div>
  <div class="card s12"><h3>Radar de produtos encalhados 📉 <span class="info2" title="Vigia produtos que já tiveram volume relevante (8+ vendas em 8 semanas). Parados = sem vender há 10+ dias. Em queda = as últimas 2 semanas caíram bem em relação às anteriores.">?</span></h3><p class="hint" id="k-desc-enc">Produtos perdendo tração — aja antes de sumirem do cardápio</p>
   <div class="dois2"><div><div class="lbl" style="margin-bottom:8px">🛑 Parados</div><div id="k-par"></div></div><div><div class="lbl" style="margin-bottom:8px">📉 Em queda</div><div id="k-que"></div></div></div></div>
  <div class="sec" id="custos">Produtos e custos</div>
  <div class="card s12"><h3>Produtos e custos <span class="info2" title="Digite o CMV (insumos + embalagem) de cada produto e tecle Enter ou saia do campo — salva na hora e o quadrante se redesenha.">?</span></h3>
   <p class="hint">Cadastre o CMV direto aqui — Enter salva. Preço médio vem das vendas reais do período.</p>
   <div class="aviso" id="k-margem" hidden></div>
   <div class="filters" style="margin:10px 0"><div class="seg" id="k-classes" style="width:auto;flex-wrap:wrap">${[['','Todas'],['Estrela','⭐ Estrela'],['Burro de carga','🐴 Burro de carga'],['Quebra-cabeça','🧩 Quebra-cabeça'],['Abacaxi','🍍 Abacaxi'],['sem-custo','📝 Sem custo']].map(([v,l])=>`<button data-classe="${v}" aria-pressed="${v===st.classe}">${l}</button>`).join('')}</div>
    <input type="search" id="k-busca" class="busca" placeholder="🔍 Buscar produto…" value="${esc(st.busca)}"></div>
   <p class="hint" id="k-sem" hidden>Nenhum produto encontrado.</p><div class="tw" id="k-tab"></div>
   <div id="k-excl" hidden style="margin-top:14px"><div class="lbl" style="margin-bottom:8px">Produtos excluídos da análise</div><div id="k-exl" class="filters"></div></div></div>
  <p class="hint s12" id="k-atual" style="margin:0"></p></div>`;
  window.V2.setJump([['quadrante','Quadrante'],['encalhados','Encalhados'],['custos','Custos']]);
}

function processar(d){
  const com=d.produtos.filter(p=>p.custo!==null).map(p=>({...p,margem:+p.preco_medio-+p.custo,margem_pct:+p.preco_medio>0?100*(+p.preco_medio-+p.custo)/+p.preco_medio:0,lucro:(+p.preco_medio-+p.custo)*+p.qtd}));
  const sem=d.produtos.filter(p=>p.custo===null);
  let medQ=0,medM=0;
  if(com.length>=2){medQ=mediana(com.map(p=>+p.qtd));medM=mediana(com.map(p=>p.margem));
    com.forEach(p=>{const pop=+p.qtd>=medQ,mg=p.margem>=medM;p.classe=pop&&mg?'Estrela':pop&&!mg?'Burro de carga':!pop&&mg?'Quebra-cabeça':'Abacaxi'})}
  else com.forEach(p=>p.classe='—');
  return {com,sem,medQ,medM};
}

function pintar(){
  const d=dados;if(!d)return;const {com,sem,medQ,medM}=processar(d);
  Chart.defaults.color=css('--ink-2');Chart.defaults.borderColor=css('--line');Chart.defaults.font.family='Figtree, system-ui, sans-serif';
  const av=document.getElementById('k-aviso');av.hidden=d.produtos.length===0;
  if(sem.length){av.className='s12 sent atencao';av.innerHTML=`<div>📝 <strong>${sem.length} produto${sem.length>1?'s':''} sem custo cadastrado</strong> — preencha o CMV na tabela abaixo que o quadrante se completa sozinho. ${com.length?`Já classificados: ${com.length}.`:''}</div>`}
  else{av.className='s12 sent ok';av.innerHTML=`<div>✅ Todos os ${d.produtos.length} produtos com custo cadastrado — quadrante completo.</div>`}
  document.getElementById('k-leg').innerHTML=Object.keys(EMOJI).map(c=>`<span><i class="bol" style="background:${cor(c)}"></i>${EMOJI[c]} ${c}</span>`).join('');
  const burros=com.filter(p=>p.classe==='Burro de carga').sort((a,b)=>(medM-b.margem)*b.qtd-(medM-a.margem)*a.qtd),am=document.getElementById('k-margem');
  if(burros.length){am.hidden=false;am.innerHTML=`🐴 <strong>Melhore a margem dos produtos:</strong> ${burros.slice(0,5).map(p=>esc(p.nome)).join(', ')}${burros.length>5?` (+${burros.length-5})`:''} — vendem muito, mas deixam menos margem por unidade que a média do cardápio. Reajuste de preço ou redução de CMV aqui tem o maior impacto no lucro.`}else am.hidden=true;
  const linhas={id:'linhasQ',afterDraw(ch){if(com.length<2)return;const {ctx,scales:{x,y}}=ch;ctx.save();ctx.strokeStyle=css('--ink-2');ctx.setLineDash([5,4]);ctx.lineWidth=1;
    const px=x.getPixelForValue(medQ),py=y.getPixelForValue(medM);ctx.beginPath();ctx.moveTo(px,y.top);ctx.lineTo(px,y.bottom);ctx.stroke();ctx.beginPath();ctx.moveTo(x.left,py);ctx.lineTo(x.right,py);ctx.stroke();ctx.restore()}};
  if(chart)chart.destroy();
  chart=new Chart(document.getElementById('gQuad'),{type:'scatter',data:{datasets:[{data:com.map(p=>({x:+p.qtd,y:p.margem,nome:p.nome,classe:p.classe,pct:p.margem_pct,lucro:p.lucro})),backgroundColor:com.map(p=>cor(p.classe)),pointRadius:7,pointHoverRadius:9}]},
    options:{maintainAspectRatio:false,plugins:{legend:{display:false},tooltip:{callbacks:{label:c=>`${EMOJI[c.raw.classe]??''} ${c.raw.nome}`,afterLabel:c=>[`${N(c.raw.x)} vendidos · margem ${R(c.raw.y)}/un (${c.raw.pct.toFixed(0)}%)`,`lucro no período: ${R(c.raw.lucro)}`]}}},scales:{x:{title:{display:true,text:'unidades vendidas'}},y:{title:{display:true,text:'margem por unidade (R$)'}}}},plugins:[linhas]});
  const todos=[...com,...sem.map(p=>({...p,margem:null,margem_pct:null,lucro:null,classe:null}))];
  document.getElementById('k-tab').innerHTML=`<table><thead><tr><th>Produto</th><th class="r">Vendidos</th><th class="r hide-m">Preço médio</th><th class="r">Custo (CMV)</th><th class="r hide-m">Margem un.</th><th class="r hide-m">Margem %</th><th class="r hide-m">Lucro total</th><th>Classe</th><th></th></tr></thead><tbody>${todos.map(p=>`<tr data-nome="${esc(semAcento(p.nome))}" data-classe="${p.classe??'sem-custo'}"><td class="wrap"><strong>${esc(p.nome)}</strong></td><td class="r">${N(p.qtd)}</td><td class="r hide-m">${R(p.preco_medio)}</td>
   <td class="r"><input class="cin" type="number" step="0.01" min="0" data-chave="${esc(p.chave)}" value="${p.custo!==null?(+p.custo).toFixed(2):''}" placeholder="R$ 0,00" aria-label="Custo de ${esc(p.nome)}"></td>
   <td class="r hide-m">${p.margem!==null?R(p.margem):'—'}</td><td class="r hide-m">${p.margem_pct!==null?p.margem_pct.toFixed(0)+'%':'—'}</td><td class="r hide-m">${p.lucro!==null?R(p.lucro):'—'}</td>
   <td style="color:${p.classe?cor(p.classe):'var(--ink-2)'}">${p.classe?(EMOJI[p.classe]??'')+' '+p.classe:'cadastre o custo'}</td>
   <td><button class="ib" data-excl="${esc(p.chave)}" data-nome="${esc(p.nome)}" title="Excluir da análise de cardápio" aria-label="Excluir ${esc(p.nome)}">🗑</button></td></tr>`).join('')}</tbody></table>`;
  filtrar();
  const be=document.getElementById('k-excl');
  if(d.excluidos&&d.excluidos.length){be.hidden=false;document.getElementById('k-exl').innerHTML=d.excluidos.map(n=>`<span class="pill p-n">${esc(n)} <button class="btn ghost" data-rest="${esc(n)}" style="padding:1px 8px">↺ restaurar</button></span>`).join('')}else be.hidden=true;
  document.getElementById('k-atual').innerHTML='<span class="dot" style="display:inline-block;margin-right:6px"></span>Atualizado às '+new Date().toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})+' · classificação recalculada a cada custo salvo';
}
function pintarEnc(){
  const en=enc;if(!en||!document.getElementById('k-par'))return;
  const box=h=>`<div class="encl">${h}</div>`;
  document.getElementById('k-par').innerHTML=en.parados.length?en.parados.map(p=>box(`<span>${esc(p.nome)}</span><b class="down">${p.dias}d parado</b>`)).join(''):'<p class="hint">Nenhum produto parado 🎉</p>';
  document.getElementById('k-que').innerHTML=en.quedas.length?en.quedas.map(q=>box(`<span>${esc(q.nome)}<br><small class="mut">${q.anterior}→${q.recente} un</small></span><b class="down">▼ ${q.queda}%</b>`)).join(''):'<p class="hint">Nenhum produto em queda 🎉</p>';
  const t=en.parados.length+en.quedas.length;
  document.getElementById('k-desc-enc').textContent=t===0?'Nenhum alerta — o cardápio está girando bem 🔥':`${t} produto(s) pedindo atenção — aja antes de sumirem do cardápio`;
}
function filtrar(){
  const termo=semAcento(st.busca.trim());let v=0;
  document.querySelectorAll('#k-tab tbody tr').forEach(tr=>{const ok=(!termo||tr.dataset.nome.includes(termo))&&(!st.classe||tr.dataset.classe===st.classe);tr.hidden=!ok;if(ok)v++});
  document.getElementById('k-sem').hidden=!((termo||st.classe)&&v===0);
}
async function carregar(){
  if(!ativoAgora())return;
  fetch(`/api/encalhados?${qBase()}`).then(r=>r.json()).then(r=>{enc=r;pintarEnc()}).catch(()=>{});
  try{dados=await fetch(`/api/cardapio?${qBase()}&dias=${st.dias}`).then(r=>r.json());pintar()}
  catch(e){document.getElementById('k-aviso').innerHTML='<div class="card"><h3>Não foi possível carregar</h3></div>';document.getElementById('k-aviso').hidden=false}
}
function ligar(){
  document.addEventListener('click',async e=>{if(!ativoAgora())return;let b;
    if(b=e.target.closest('[data-classe]')){st.classe=b.dataset.classe;document.querySelectorAll('#k-classes button').forEach(x=>x.setAttribute('aria-pressed',x===b));filtrar();return}
    if(b=e.target.closest('[data-excl]')){if(!confirm(`Excluir "${b.dataset.nome}" da análise de cardápio?\n\nNão apaga as vendas — só tira esse produto do quadrante mágico, da lista de custos e do radar de encalhados. Dá pra restaurar depois.`))return;const r=await post('/api/produtos/excluir',{nome:b.dataset.excl});if(r.ok)carregar();return}
    if(b=e.target.closest('[data-rest]')){const r=await post('/api/produtos/restaurar',{nome:b.dataset.rest});if(r.ok)carregar()}});
  document.addEventListener('change',async e=>{if(!ativoAgora())return;const t=e.target;
    if(t.id==='k-dias'){st.dias=+t.value;carregar();return}
    if(t.dataset.chave){const v=parseFloat(t.value);if(isNaN(v)||v<0)return;const r=await post('/api/custos',{nome:t.dataset.chave,custo:v});if(r.ok){t.style.borderColor='var(--ok)';setTimeout(carregar,400)}else window.V2.toast(r.erro||'Não foi possível salvar')}});
  document.addEventListener('input',e=>{if(ativoAgora()&&e.target.id==='k-busca'){st.busca=e.target.value;filtrar()}});
  document.addEventListener('keydown',e=>{if(ativoAgora()&&e.key==='Enter'&&e.target.dataset&&e.target.dataset.chave)e.target.blur()});
  window.addEventListener('v2tema',()=>{if(ativoAgora()&&dados)pintar()});
}
window.V2.screens.cardapio={render(c){el=c;if(!ligado){ligar();ligado=true}clearInterval(timer);esqueleto();carregarChart().then(carregar).catch(()=>{});timer=setInterval(()=>{if(ativoAgora())carregar();else clearInterval(timer)},5*60*1000)},onFiltros(){carregar()}};
})();
