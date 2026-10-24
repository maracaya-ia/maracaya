/* Painel 2.0 — tela Pergunte para MIA: chat que usa o mesmo motor da MIA do grupo (/api/zap/pergunta_painel) */
(function(){
const esc=t=>String(t??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
/* texto do WhatsApp -> HTML: *negrito*, _itálico_, quebras de linha */
const zap=t=>esc(t).replace(/\*([^*\n]+)\*/g,'<b>$1</b>').replace(/(^|[\s(])_([^_\n]+)_(?=[\s).,!?]|$)/g,'$1<i>$2</i>').replace(/\n/g,'<br>');
const GRUPOS=[
  ['🍔 Cardápio',['Quais os produtos menos vendidos?','Quais os produtos mais vendidos?','Quais os burros de carga?','Quais os abacaxis do cardápio?','Me mostra as estrelas','Quebra-cabeças do cardápio','Como está o cardápio?']],
  ['🧾 Itens vendidos',['Quantas ferinhas foram vendidas?','Quantas vendas tiveram de pudim?','Quantos itens foram vendidos ontem?','Quantos itens foram vendidos em setembro?']],
  ['💰 Faturamento e meta',['Quanto falta pra meta?','Faturamento de ontem','Faturamento de setembro','Quantos pedidos hoje?']],
  ['📦 Estoque, clientes e operação',['Como está o estoque?','Quantos clientes estão sumidos?','Quantas carnes uso no domingo?','Tempo de entrega hoje']]];
const BOAS=`Oi, Álvaro, aqui é a MIA. Pergunte o que quiser sobre vendas, clientes, cardápio ou estoque. Eu respondo com os números do painel. Dá pra filtrar por unidade (Colorado, Sobradinho) ou marca (Chomp, Maracayá) e por período (hoje, ontem, semana, mês ou um mês pelo nome).`;
let conversa=[],ocupado=false,ligado=false;
const ativoAgora=()=>!!document.getElementById('z-chat');

function bolhas(){
  const c=document.getElementById('z-chat');if(!c)return;
  c.innerHTML=`<div class="msg ze"><b class="who">MIA</b>${zap(BOAS)}</div>`+conversa.map(m=>m.de==='me'?`<div class="msg me">${esc(m.t)}</div>`:`<div class="msg ze"><b class="who">MIA</b>${m.html}</div>`).join('')+(ocupado?'<div class="msg ze"><b class="who">MIA</b><span class="mut">pensando…</span></div>':'');
  const mn=document.getElementById('main');if(mn)mn.scrollTop=mn.scrollHeight;
}
async function perguntar(q){
  q=(q||'').trim();if(!q||ocupado)return;
  conversa.push({de:'me',t:q});ocupado=true;bolhas();
  try{
    const r=await fetch('/api/zap/pergunta_painel',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({pergunta:q})}).then(x=>x.json());
    conversa.push({de:'ze',html:r.ok?zap(r.texto):`<span class="down">${esc(r.erro||'Não consegui responder agora.')}</span>`});
  }catch(e){conversa.push({de:'ze',html:'<span class="down">Não consegui falar com o servidor. Tente de novo em instantes.</span>'})}
  ocupado=false;bolhas();const i=document.getElementById('z-in');if(i)i.focus();
}
function ligar(){
  document.addEventListener('submit',e=>{if(!ativoAgora()||e.target.id!=='z-form')return;e.preventDefault();const i=document.getElementById('z-in');const q=i.value;i.value='';perguntar(q)});
  document.addEventListener('click',e=>{if(!ativoAgora())return;const b=e.target.closest('[data-q]');if(b)perguntar(b.dataset.q);
    if(e.target.closest('#z-limpar')){conversa=[];bolhas()}});
}
window.V2.screens.ze={render(c){if(!ligado){ligar();ligado=true}
  c.innerHTML=`<div class="chat" id="z-chat"></div>
  <div class="atalhos" style="max-width:760px">${GRUPOS.map(([t,l])=>`<div class="ag"><div class="lbl">${t}</div><div class="filters">${l.map(q=>`<button class="chip" data-q="${esc(q)}">${esc(q)}</button>`).join('')}</div></div>`).join('')}
   <p class="hint" style="margin:0">Dica: some um período (<i>ontem, em setembro, 15/10, últimos 15 dias</i>) ou uma marca/unidade (<i>Chomp, Sobradinho</i>) à pergunta. Sem período, o cardápio usa 90 dias e "quantos itens" mostra o total.</p></div>
  <form class="ask" id="z-form"><input id="z-in" maxlength="300" placeholder="Pergunte sobre vendas, clientes, estoque…" aria-label="Pergunta" autocomplete="off"><button class="btn brasa">Enviar</button></form>
  <p class="hint" style="max-width:760px;margin:0">É a mesma MIA do grupo do WhatsApp. <button class="btn ghost" id="z-limpar" style="padding:2px 10px">Limpar conversa</button></p>`;
  bolhas()},onFiltros(){}};
})();
