/* Painel 2.0 — tela Equipe e checklists: recado do dia, checklists (abertura, cozinha, fechamento), escala da semana e histórico */
(function(){
const esc=t=>String(t??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;');
const J=u=>fetch(u).then(r=>r.json());
const post=(url,corpo)=>fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(corpo)}).then(r=>r.json());
const DC=['dom','seg','ter','qua','qui','sex','sáb'];
const TURNOS=[['abertura','Checklist de abertura'],['cozinha','Checklist da cozinha'],['fechamento','Checklist de fechamento']];
const FUNCOES=['Chapa','Montagem','Fritura','Balcão'];
const ativoAgora=()=>!!document.getElementById('e-root');
const nome=()=>{try{return localStorage.getItem('m2-nome')||''}catch(_){return ''}};
function pedirNome(){let n=nome();if(n)return n;n=(prompt('Seu nome (fica registrado quem marcou e a que horas):')||'').trim().slice(0,40);if(n){try{localStorage.setItem('m2-nome',n)}catch(_){}}return n}
const fmtDia=iso=>{const d=new Date(iso+'T12:00:00');return `${DC[d.getDay()]} ${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}`};
let el=null,ligado=false,editar=false;

function esqueleto(){
  el.innerHTML=`<div id="e-root" class="g">
  <div class="card s12" id="recado"><h3>Recado do dia</h3><div id="e-recado"><p class="hint" style="margin:0">Carregando…</p></div>
   <form class="filters" id="e-recform" style="margin-top:10px"><input id="e-rectxt" class="busca" maxlength="500" placeholder="Escreva um recado pra equipe…" required><button class="btn brasa">Publicar</button></form></div>
  <div class="sec" id="listas">Checklists</div>
  ${TURNOS.map(([t,l])=>`<div class="card s4" id="ck-${t}"><div style="display:flex;justify-content:space-between;align-items:center;gap:8px"><h3>${l}</h3></div><p class="hint" id="ck-${t}-t">Carregando…</p><div id="ck-${t}-b" data-turno="${t}"></div><form class="filters e-add" data-add="${t}" hidden style="margin-top:10px"><input class="busca" maxlength="120" placeholder="Novo item…" required><button class="btn ghost">Adicionar</button></form></div>`).join('')}
  <div class="s12" style="display:flex;justify-content:flex-end"><button class="btn ghost" id="e-editar" aria-pressed="false">✏️ Editar itens dos checklists</button></div>
  <div class="sec" id="escala">Escala da semana</div>
  <div class="card s12"><h3>Escala da semana</h3><p class="hint">Previsão de pedidos por dia (mediana das últimas 8 semanas) pra ajudar a montar a equipe. Digite o nome e saia do campo pra salvar.</p><div class="tw" id="e-escala"><p class="hint">Carregando…</p></div></div>
  <div class="sec" id="historico">Histórico</div>
  <div class="card s12"><h3>Quem marcou o quê</h3><p class="hint">Últimos 7 dias · cada marcação guarda o nome e a hora</p><div id="e-hist"><p class="hint">Carregando…</p></div></div></div>`;
  window.V2.setJump([['recado','Recado'],['listas','Checklists'],['escala','Escala'],['historico','Histórico']]);
}
async function recado(){
  const r=(await J('/api/recado').catch(()=>({}))).recado,b=document.getElementById('e-recado');if(!b)return;
  b.innerHTML=r?`<p style="margin:6px 0 0;font-size:14px">${esc(r.texto)} <span class="mut">· ${esc(r.autor||'—')}, ${esc(r.quando)}${r.hoje?'':' (recado antigo)'}</span></p>`:'<p class="hint" style="margin:0">Nenhum recado ainda.</p>';
}
async function checklist(t){
  const d=await J('/api/checklist?turno='+t),b=document.getElementById(`ck-${t}-b`);if(!b)return;
  b.innerHTML=d.itens.map(i=>`<label class="check"><input type="checkbox" data-ck="${i.id}" ${i.feito?'checked':''}><span>${esc(i.texto)}${i.feito?` <small class="mut">· ${esc(i.quem||'—')}, ${i.hora}</small>`:''}</span>${editar?`<button type="button" class="ib" data-rem="${i.id}" aria-label="Remover ${esc(i.texto)}" style="margin-left:auto">✕</button>`:''}</label>`).join('')||'<p class="hint">Nenhum item.</p>';
  document.getElementById(`ck-${t}-t`).textContent=`${d.feitos} de ${d.total} feitos hoje`;
}
async function escala(){
  const [pv,es]=await Promise.all([J('/api/previsao').catch(()=>null),J('/api/escala?dias=7').catch(()=>({escala:[]}))]);
  const b=document.getElementById('e-escala');if(!b)return;
  const hoje=new Date(),dias=[...Array(7)].map((_,i)=>{const d=new Date(hoje.getFullYear(),hoje.getMonth(),hoje.getDate()+i);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`});
  const prev=Object.fromEntries(((pv&&pv.dias)||[]).map(x=>[x.data,x.pedidos])),m={};es.escala.forEach(x=>m[x.dia+'|'+x.funcao]=x.nome);
  b.innerHTML=`<table><thead><tr><th>Função</th>${dias.map(d=>`<th class="r">${fmtDia(d)}${prev[d]?`<br><small class="mut" style="text-transform:none;letter-spacing:0">~${Math.round(prev[d])} pedidos</small>`:''}</th>`).join('')}</tr></thead><tbody>${FUNCOES.map(f=>`<tr><td><strong>${f}</strong></td>${dias.map(d=>`<td><input class="cin" style="width:96px;text-align:left" data-esc="${d}|${f}" value="${esc(m[d+'|'+f]||'')}" maxlength="40" aria-label="${f} em ${fmtDia(d)}"></td>`).join('')}</tr>`).join('')}</tbody></table>`;
}
async function historico(){
  const d=await J('/api/checklist_historico?dias=7').catch(()=>null),b=document.getElementById('e-hist');if(!b||!d)return;
  const nomeT=Object.fromEntries(TURNOS);
  b.innerHTML=d.dias.length?d.dias.map(x=>`<details class="more" style="margin-top:0;border-top:1px solid var(--line)" ${x===d.dias[0]?'open':''}><summary style="font-weight:600">${fmtDia(x.dia)} · ${Object.entries(x.turnos).map(([t,l])=>`${(nomeT[t]||t).replace('Checklist ','').replace('da ','').replace('de ','')}: ${l.length}/${d.totais[t]||l.length}`).join(' · ')}</summary>
    ${Object.entries(x.turnos).map(([t,l])=>`<p class="lbl" style="margin:8px 0 4px">${nomeT[t]||t}</p>${l.map(i=>`<div style="font-size:13px;padding:2px 0">✓ ${esc(i.texto)} <span class="mut">· ${esc(i.quem||'—')}, ${i.hora}</span></div>`).join('')}`).join('')}</details>`).join(''):'<p class="hint" style="margin:0">Ainda não há marcações registradas.</p>';
}
function tudo(){recado();TURNOS.forEach(([t])=>checklist(t));escala();historico()}

function ligar(){
  document.addEventListener('submit',async e=>{if(!ativoAgora())return;const f=e.target;
    if(f.id==='e-recform'){e.preventDefault();const r=await post('/api/recado',{texto:document.getElementById('e-rectxt').value,autor:nome()||pedirNome()});if(r.ok){document.getElementById('e-rectxt').value='';recado();window.V2.toast('Recado publicado')}else window.V2.toast(r.erro||'Não foi possível publicar')}
    else if(f.dataset.add){e.preventDefault();const i=f.querySelector('input'),r=await post('/api/checklist_item',{turno:f.dataset.add,texto:i.value});if(r.ok){i.value='';checklist(f.dataset.add)}else window.V2.toast(r.erro||'Não foi possível adicionar')}});
  document.addEventListener('click',async e=>{if(!ativoAgora())return;let b;
    if(b=e.target.closest('#e-editar')){editar=!editar;b.setAttribute('aria-pressed',editar);b.textContent=editar?'✓ Concluir edição':'✏️ Editar itens dos checklists';document.querySelectorAll('.e-add').forEach(f=>f.hidden=!editar);TURNOS.forEach(([t])=>checklist(t));return}
    if(b=e.target.closest('[data-rem]')){if(!confirm('Remover este item do checklist? O histórico já registrado é mantido.'))return;await post('/api/checklist_item_remover',{id:+b.dataset.rem});TURNOS.forEach(([t])=>checklist(t))}});
  document.addEventListener('change',async e=>{if(!ativoAgora())return;const t=e.target;
    if(t.dataset.ck){let n='';if(t.checked){n=pedirNome();if(!n){t.checked=false;return}}
      const r=await post('/api/checklist_marcar',{item_id:+t.dataset.ck,marcado:t.checked,quem:n});if(!r.ok){window.V2.toast(r.erro||'Não foi possível salvar');t.checked=!t.checked;return}
      const bx=t.closest('[data-turno]');if(bx)checklist(bx.dataset.turno);historico()}
    else if(t.dataset.esc){const [dia,fn]=t.dataset.esc.split('|');const r=await post('/api/escala',{dia,funcao:fn,nome:t.value});if(r.ok)t.style.borderColor='var(--ok)';else window.V2.toast(r.erro||'Não foi possível salvar')}});
  document.addEventListener('keydown',e=>{if(ativoAgora()&&e.key==='Enter'&&e.target.dataset&&e.target.dataset.esc)e.target.blur()});
}
window.V2.screens.equipe={render(c){el=c;editar=false;if(!ligado){ligar();ligado=true}esqueleto();tudo()},onFiltros(){}};
})();
