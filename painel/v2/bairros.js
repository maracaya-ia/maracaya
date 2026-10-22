/* Painel 2.0 — tela Bairros: mapa de entregas (Leaflet) + ranking de regiões */
(function(){
const R=v=>(+(v??0)).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
const N=v=>(+(v??0)).toLocaleString('pt-BR');
const esc=t=>String(t??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;');
const ativoAgora=()=>!!document.getElementById('b-mapa');
let el=null,ligado=false,mapa=null,camada=null,timer=null,dados=null;
let st={dias:90,agrupar:'regiao'};

function carregarLeaflet(){
  if(window.L)return Promise.resolve();
  return new Promise((ok,err)=>{
    const l=document.createElement('link');l.rel='stylesheet';l.href='https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css';document.head.appendChild(l);
    const s=document.createElement('script');s.src='https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js';s.onload=ok;s.onerror=err;document.head.appendChild(s)})}

function esqueleto(){
  mapa=null;camada=null;
  el.innerHTML=`<div class="g">
  <div class="card s12 ctrl-per"><div class="filters"><select id="b-agr" aria-label="Agrupar"><option value="regiao">Por região/condomínio</option><option value="bairro">Por bairro (oficial)</option></select></div></div>
  <div class="card s7" id="mapa-card"><h3>Mapa de entregas <span class="info2" title="Cada ponto é um pedido de delivery entregue no período — posição vem das coordenadas reais do endereço. Zoom com scroll ou pinça, arraste pra navegar. Concentração de pontos = seu território; vazio com gente morando = oportunidade de marketing.">?</span></h3>
   <p class="hint" id="b-desc">Cada ponto é um pedido entregue</p><div id="b-mapa"></div></div>
  <div class="card s5" id="ranking"><h3>Ranking de regiões <span class="info2" title="Só pedidos de delivery não cancelados. Por região/condomínio: usa as regras cadastradas (Jardim Europa II, Bela Vista...) lidas do texto do endereço; quem não casa com regra aparece pelo bairro oficial. Por bairro: usa o campo oficial do endereço.">?</span></h3>
   <p class="hint">Quem sustenta a casa — delivery no período</p><div class="tw" id="b-rank"></div></div>
  <p class="hint s12" id="b-atual" style="margin:0"></p></div>`;
  document.getElementById('b-agr').value=st.agrupar;
  window.V2.setJump([]);
}

function pintar(){
  const d=dados;if(!d||!window.L||!document.getElementById('b-mapa'))return;
  if(!mapa){mapa=L.map('b-mapa',{zoomControl:true}).setView([-15.65,-47.83],12);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{attribution:'© OpenStreetMap',maxZoom:19}).addTo(mapa)}
  if(camada)camada.remove();
  const brasa=getComputedStyle(document.documentElement).getPropertyValue('--brasa').trim()||'#D4511C';
  camada=L.layerGroup();
  d.pontos.forEach(p=>L.circleMarker([+p.lat,+p.lng],{radius:4,color:brasa,weight:1,fillColor:brasa,fillOpacity:.5}).bindTooltip(R(+p.total)).addTo(camada));
  camada.addTo(mapa);
  if(d.pontos.length){const la=d.pontos.map(p=>+p.lat),ln=d.pontos.map(p=>+p.lng);mapa.fitBounds([[Math.min(...la),Math.min(...ln)],[Math.max(...la),Math.max(...ln)]],{padding:[30,30]})}
  setTimeout(()=>mapa&&mapa.invalidateSize(),100);
  document.getElementById('b-desc').textContent=`${N(d.pontos.length)} entregas no mapa · ${N(d.totais.pedidos)} pedidos de delivery no período`;
  const mx=Math.max(...d.ranking.map(b=>+b.pedidos),1),tot=d.ranking.reduce((s,b)=>s+(+b.faturamento),0);
  document.getElementById('b-rank').innerHTML=`<table><thead><tr><th>Bairro</th><th class="r">Pedidos</th><th class="r">Faturamento</th><th class="r hide-m">Ticket</th><th class="r hide-m">Clientes</th></tr></thead><tbody>${d.ranking.length?d.ranking.map((b,i)=>`<tr><td class="wrap"><strong class="${i===0?'up':''}">${esc(b.bairro)}${i===0?' 👑':''}</strong><div class="rbar" style="width:${Math.max(100*b.pedidos/mx,3)}%"></div></td><td class="r">${N(b.pedidos)}</td><td class="r">${R(b.faturamento)}</td><td class="r hide-m">${R(b.ticket)}</td><td class="r hide-m">${N(b.clientes)}</td></tr>`).join(''):'<tr><td colspan="5" class="mut">Sem entregas no período</td></tr>'}</tbody></table>`;
  const top=d.ranking[0];
  document.getElementById('b-atual').innerHTML=(top?`${esc(top.bairro)} responde por ${(100*top.faturamento/Math.max(tot,1)).toFixed(0)}% do faturamento de delivery · `:'')+'Atualizado às '+new Date().toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'});
}
async function carregar(){
  if(!ativoAgora())return;const f=window.V2.filtros;
  try{dados=await fetch(`/api/bairros?marca=${encodeURIComponent(f.marca)}&unidade=${encodeURIComponent(f.unidade)}&dias=${window.V2.intervalo().dias}${window.V2.intervalo().ini?`&inicio=${window.V2.intervalo().ini}&fim=${window.V2.intervalo().fim}`:''}&agrupar=${st.agrupar}`).then(r=>r.json());pintar()}
  catch(e){document.getElementById('b-rank').innerHTML='<p class="hint">Não foi possível carregar.</p>'}
}
function ligar(){
  document.addEventListener('change',e=>{if(!ativoAgora())return;
    if(e.target.id==='b-agr'){st.agrupar=e.target.value;carregar()}});
}
window.V2.screens.bairros={render(c){el=c;if(!ligado){ligar();ligado=true}clearInterval(timer);esqueleto();
  carregarLeaflet().then(carregar).catch(()=>{document.getElementById('b-mapa').innerHTML='<p class="hint" style="padding:20px">Não foi possível carregar o mapa.</p>'});
  timer=setInterval(()=>{if(ativoAgora())carregar();else clearInterval(timer)},5*60*1000)},onFiltros(){carregar()}};
})();
