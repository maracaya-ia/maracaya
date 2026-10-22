/* Painel 2.0 — tela Lançar nota (antiga aba Lançar Nota) */
(function(){
const R=v=>(+(v??0)).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
const esc=t=>String(t??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;');
const post=(url,corpo)=>fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(corpo)}).then(r=>r.json());
let el=null,ligado=false,forns=[];
const hoje=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`};

function desenhar(d){
  forns=d.fornecedores;
  const keep={f:document.getElementById('nf-f')?.value,d:document.getElementById('nf-d')?.value};
  const porForn=d.por_fornecedor.length?`<p class="hint" style="margin:10px 0 0">${d.por_fornecedor.map(p=>`<strong style="color:var(--ink)">${esc(p.fornecedor)}</strong> ${R(p.total)} (${p.notas})`).join(' · ')}</p>`:'';
  el.innerHTML=`<div class="g">
  <div class="card s5" id="manual"><h3>Nova nota</h3><p class="hint">Recebeu uma nota? Lance aqui — o gasto do mês soma sozinho.</p>
   <form class="mform" id="nf">
    <label>Fornecedor<select id="nf-f">${forns.map(f=>`<option${f===keep.f?' selected':''}>${esc(f)}</option>`).join('')}</select></label>
    <div class="duas"><label>Valor total (R$)<input id="nf-v" type="number" step="0.01" min="0" inputmode="decimal" placeholder="0,00" required></label>
     <label>Data de emissão<input id="nf-d" type="date" value="${keep.d||hoje()}"></label></div>
    <div class="duas"><label>Nº da nota (opcional)<input id="nf-n" placeholder="ex: NF-509"></label>
     <label>Vencimento (opcional)<input id="nf-venc" type="date"></label></div>
    <button class="btn brasa" style="padding:11px 14px;font-size:14px">Lançar nota</button>
    <div class="feed" id="nf-fb" aria-live="polite"></div></form>
   <p class="hint" style="margin:14px 0 0">📸 <strong style="color:var(--ink)">Nota em foto ou papel?</strong> Mande a foto pro Claudinho no chat: ele lê e devolve os dados prontos pra lançar aqui. A leitura direto pela câmera do painel ainda não existe.</p></div>
  <div class="card s7" id="mes"><h3>Notas deste mês</h3><p class="hint">${d.notas.length} nota(s) · ${d.por_fornecedor.length} fornecedor(es) este mês</p>
   ${d.notas.length?`<div class="tw"><table><thead><tr><th>Fornecedor</th><th>Nº</th><th>Data</th><th class="r">Valor</th><th></th></tr></thead><tbody>${d.notas.map(n=>`<tr><td><strong>${esc(n.fornecedor)}</strong></td><td class="mut">${esc(n.numero??'—')}</td><td>${n.data??'—'}</td><td class="r">${R(n.valor)}</td><td class="r"><button class="ib" data-delnota="${n.id}" title="Remover nota" aria-label="Remover nota ${esc(n.numero??n.fornecedor)}">✕</button></td></tr>`).join('')}</tbody></table></div>`:'<p class="hint" style="text-align:center;padding:20px 0">Nenhuma nota lançada este mês ainda</p>'}
   <div class="total-mes"><span>Total do mês</span><strong>${R(d.total_mes)}</strong></div>${porForn}</div></div>`;
}
async function carregar(){
  if(!el)return;
  try{desenhar(await fetch('/api/notas_mes').then(r=>r.json()))}
  catch(e){el.innerHTML='<div class="card"><h3>Não foi possível carregar</h3><p class="hint">Tente de novo em instantes.</p></div>'}
}
function ligar(){
  document.addEventListener('submit',async e=>{
    if(e.target.id!=='nf')return;e.preventDefault();
    const fb=document.getElementById('nf-fb'),valor=parseFloat(document.getElementById('nf-v').value),forn=document.getElementById('nf-f').value;
    if(!forn||isNaN(valor)||valor<=0){fb.className='feed erro';fb.textContent='Preencha fornecedor e valor.';return}
    const r=await post('/api/nota',{fornecedor:forn,valor,numero:document.getElementById('nf-n').value||null,data_emissao:document.getElementById('nf-d').value||null,vencimento:document.getElementById('nf-venc').value||null});
    if(r.ok){window.V2.toast('Nota lançada');await carregar()}else{fb.className='feed erro';fb.textContent='Erro: '+(r.erro||'tente de novo')}
  });
  document.addEventListener('click',async e=>{
    const b=e.target.closest('[data-delnota]');if(!b||!el||!document.body.contains(el))return;
    if(!confirm('Remover esta nota?'))return;
    await post('/api/nota_delete',{id:+b.dataset.delnota});window.V2.toast('Nota removida');carregar()});
}
window.V2.screens.nota={render(c){el=c;el.innerHTML='<div class="card"><p class="hint" style="margin:0">Carregando notas…</p></div>';if(!ligado){ligar();ligado=true}carregar()},onFiltros(){}};
})();
