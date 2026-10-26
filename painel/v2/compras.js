/* Painel 2.0 — tela Compras e estoque (junta a antiga aba Compras + recebimento por fornecedor e contagem) */
(function(){
const R=v=>(+(v??0)).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
const N=(v,d=0)=>(+v).toLocaleString('pt-BR',{maximumFractionDigits:d});
const esc=t=>String(t??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;');
const semAcento=t=>(t||'').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().replace(/"/g,'');
const DOW=['dom','seg','ter','qua','qui','sex','sáb'];
const fmtDia=iso=>{const d=new Date(iso+'T12:00:00');return `${DOW[d.getDay()]} ${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}`};
const DIAS=[['seg','Seg'],['ter','Ter'],['qua','Qua'],['qui','Qui'],['sex','Sex'],['sáb','Sáb'],['dom','Dom']].map(([k,r])=>[k==='sáb'?'sab':k,r]);
const fmtQ=(v,u)=>v==null?'—':(u==='kg'?N(v,1)+' kg':Math.ceil(+v).toLocaleString('pt-BR')+(u==='g'?' g':' un'));
const fmtG=(v,u)=>v==null?'—':(u==='g'&&Math.abs(v)>=1000?N(v/1000,1)+' kg':N(v,u==='kg'?2:1)+' '+(u||''));
const post=(url,corpo)=>fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(corpo)}).then(r=>r.json());
const toast=t=>window.V2.toast(t);

let st={ancora:'seg',seguranca:20,cobertura:30,busca:''};
let plano=null,estq=null,sug=null,itens=[],forns={},el=null,modal=null;
const tbl=(head,rows,right=[],hide=[])=>`<div class="tw"><table><thead><tr>${head.map((h,i)=>`<th class="${right.includes(i)?'r':''}${hide.includes(i)?' hide-m':''}">${h}</th>`).join('')}</tr></thead><tbody>${rows.map(r=>`<tr${r.attr||''}>${(r.cells||r).map((c,i)=>`<td class="${right.includes(i)?'r':''}${hide.includes(i)?' hide-m':''}">${c}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
const kpi=(l,v,s,extra='')=>`<div class="card kpi s3"><div class="k-l">${l}</div><div class="k-v ${extra}">${v}</div>${s?`<div class="k-s">${s}</div>`:''}</div>`;
const SI={in:'<path d="M12 3v12"/><path d="M7 10l5 5 5-5"/><path d="M4 17v3h16v-3"/>',out:'<path d="M12 15V3"/><path d="M7 8l5-5 5 5"/><path d="M4 17v3h16v-3"/>',clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',box:'<path d="M3 7l9-4 9 4-9 4z"/><path d="M3 7v10l9 4 9-4V7"/><path d="M12 11v10"/>',count:'<path d="M9 5H5v14h14v-4"/><path d="M9 12l3 3 8-8"/>',edit:'<path d="M4 20h4L19 9l-4-4L4 16z"/>'};
const ic=k=>`<svg viewBox="0 0 24 24" aria-hidden="true">${SI[k]}</svg>`;

/* unidade de quem confere: embalagem > kg (itens em g) > unidade própria */
const unid=x=>x.embalagem_qtd?{lab:x.embalagem_nome||'emb.',f:+x.embalagem_qtd,step:'1'}:(x.unidade==='g'?{lab:'kg',f:1000,step:'0.1'}:{lab:x.unidade||'un',f:1,step:x.unidade==='kg'?'0.1':'1'});

function celulaPedirAte(x){
  if(x.ciclo)return `<span class="up">🔄 troca ${fmtDia(x.proxima_troca)}</span><br><small class="mut">ciclo de ${x.dias_ciclo} dia(s)</small>`;
  if(x.estoque==null||x.consumo_dia<=0)return '<span class="mut">—</span>';
  if(x.dias_sem_produto>0)return `<span class="down"><b>⚠️ ${x.dias_sem_produto} dia(s) sem produto</b></span><br><small class="mut">próx. entrega ${fmtDia(x.proxima_entrega)}</small>`;
  if(x.pedir_hoje)return '<span class="down"><b>pedir HOJE</b></span>';
  if(x.pedir_ate)return `<span class="${x.abaixo_minimo?'down':'mut'}">${fmtDia(x.pedir_ate)}</span>`;
  return '—';
}

/* ---------- modais ---------- */
function openModal(html){closeModal();modal=document.createElement('div');modal.className='modal-bg';modal.innerHTML=`<div class="modal" role="dialog" aria-modal="true">${html}</div>`;document.getElementById('app').appendChild(modal);const f=modal.querySelector('input:not([type=checkbox]),select');if(f&&!matchMedia('(max-width:760px)').matches)f.focus()}
function closeModal(){if(modal){modal.remove();modal=null}}
const mhead=(lab,t)=>`<div class="m-head"><div><div class="lbl">${lab}</div><h3>${esc(t)}</h3></div><button class="ib" data-cx="fechar" aria-label="Fechar">✕</button></div>`;

function dlgReceberItem(x){
  const u=x.embalagem_qtd?unid(x):null;
  openModal(`${mhead('Receber entrega',x.insumo)}<p class="hint">${esc(x.fornecedor)} · estoque atual: <strong>${fmtG(x.estoque??0,x.unidade)}</strong></p>
  <form class="mform" id="fRecItem">
   ${u?`<label>${esc(u.lab)}(s) recebido(s) <small>1 ${esc(u.lab)} = ${N(u.f,3)} ${x.unidade}</small><input id="rEmb" type="number" min="0" step="any" inputmode="decimal" placeholder="ex: 3"></label>`:''}
   <label>Quantidade recebida (${x.unidade})<input id="rQtd" type="number" min="0" step="any" inputmode="decimal" placeholder="0" required></label>
   <label>Observação (opcional)<input id="rObs" maxlength="120" placeholder="ex: NF 1234, 2 pacotes amassados"></label>
   <div class="m-prev" id="rPrev"></div>
   <div class="m-foot"><button type="button" class="btn ghost" data-cx="fechar">Cancelar</button><button class="btn brasa">Somar ao estoque</button></div></form>`);
  const prev=()=>{const q=parseFloat(document.getElementById('rQtd').value),a=x.estoque??0;
    document.getElementById('rPrev').innerHTML=isNaN(q)||q<=0?`Estoque atual: <strong>${fmtG(a,x.unidade)}</strong>`:`Estoque: ${fmtG(a,x.unidade)} → <strong class="up">${fmtG(a+q,x.unidade)}</strong> (+${fmtG(q,x.unidade)})`};
  prev();
  document.getElementById('rQtd').addEventListener('input',prev);
  const e=document.getElementById('rEmb');if(e)e.addEventListener('input',()=>{const n=parseFloat(e.value);if(!isNaN(n))document.getElementById('rQtd').value=+(n*u.f).toFixed(3);prev()});
  document.getElementById('fRecItem').addEventListener('submit',async ev=>{ev.preventDefault();
    const q=parseFloat(document.getElementById('rQtd').value);if(isNaN(q)||q<=0){toast('Informe a quantidade recebida');return}
    const r=await post('/api/estoque_entrada',{insumo:x.insumo,quantidade:q,obs:document.getElementById('rObs').value});
    if(!r.ok){toast(r.erro||'Não foi possível registrar');return}closeModal();toast(`+${fmtG(q,x.unidade)} de ${x.insumo} somados ao estoque`);carregar()});
}

function dlgBaixaItem(x0){
  const lista=[...itens].filter(i=>!i.ciclo&&i.estoque!=null).sort((a,b)=>a.insumo.localeCompare(b.insumo,'pt-BR',{sensitivity:'base'}));
  let x=x0||lista[0];if(!x){toast('Nenhum item com estoque cadastrado');return}
  openModal(`${mhead('Baixa manual',x0?x0.insumo:'Dar baixa no estoque')}<p class="hint" id="bHint"></p>
  <form class="mform" id="fBaixa">
   ${x0?'':`<label>Item<select id="bIns">${lista.map(i=>`<option value="${esc(i.insumo)}">${esc(i.insumo)}</option>`).join('')}</select></label>`}
   <label>Quantidade a baixar <span id="bUn"></span><input id="bQtd" type="number" min="0" step="any" inputmode="decimal" placeholder="0" required></label>
   <label>Motivo<select id="bMot"><option>Perda / estragou</option><option>Uso interno</option><option>Brinde / cortesia</option><option>Outro</option></select></label>
   <label>Observação (opcional)<input id="bObs" maxlength="100" placeholder="ex: caixa caiu"></label>
   <div class="m-prev" id="bPrev"></div>
   <div class="m-foot"><button type="button" class="btn ghost" data-cx="fechar">Cancelar</button><button class="btn brasa">Dar baixa</button></div></form>`);
  const prev=()=>{const q=parseFloat(document.getElementById('bQtd').value),a=x.estoque??0;
    document.getElementById('bHint').innerHTML=`Estoque atual: <strong>${fmtG(a,x.unidade)}</strong> · use para perda, uso interno ou item que não passou pela ficha técnica.`;
    document.getElementById('bUn').textContent='('+x.unidade+')';
    document.getElementById('bPrev').innerHTML=isNaN(q)||q<=0?`Estoque atual: <strong>${fmtG(a,x.unidade)}</strong>`:`Estoque: ${fmtG(a,x.unidade)} → <strong class="down">${fmtG(Math.max(a-q,0),x.unidade)}</strong> (−${fmtG(q,x.unidade)})`};
  prev();document.getElementById('bQtd').addEventListener('input',prev);
  const s=document.getElementById('bIns');if(s)s.addEventListener('change',()=>{x=lista.find(i=>i.insumo===s.value);prev()});
  document.getElementById('fBaixa').addEventListener('submit',async ev=>{ev.preventDefault();
    const q=parseFloat(document.getElementById('bQtd').value);if(isNaN(q)||q<=0){toast('Informe a quantidade');return}
    const r=await post('/api/estoque_baixa',{insumo:x.insumo,quantidade:q,motivo:document.getElementById('bMot').value,obs:document.getElementById('bObs').value});
    if(!r.ok){toast(r.erro||'Não foi possível registrar');return}closeModal();toast(`−${fmtG(q,x.unidade)} de ${x.insumo} baixados do estoque`);carregar()});
}

async function dlgHist(x){
  openModal(`${mhead('Histórico',x.insumo)}<p class="hint">Carregando…</p>`);
  const d=await fetch('/api/estoque_historico?insumo='+encodeURIComponent(x.insumo)).then(r=>r.json());
  const TIPO={baixa:'🍔 Baixa de pedido',estorno:'↩️ Pedido cancelado',entrada:'📥 Entrega recebida',ajuste:'✏️ Contagem manual',inicial:'🆕 Primeira contagem'};
  const q=v=>N(v,x.unidade==='kg'?2:1);
  const dias=d.por_dia.slice(0,5).map(p=>`<div><b>${fmtDia(p.dia)}</b><span class="down">−${q(p.baixas)}</span>${p.entradas?`<small>+${q(p.entradas)}</small>`:''}${p.ajustes?`<small class="mut">✏️ ${p.ajustes>0?'+':''}${q(p.ajustes)}</small>`:''}</div>`).join('');
  const rows=d.movimentos.map(m=>{const quando=new Date(m.criado_em).toLocaleString('pt-BR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'});
    const orig=m.pedido_id?` <span class="mut">#${m.numero_curto??m.pedido_id}</span>`:(m.obs&&!['entrega recebida','contagem manual','primeira contagem','cadastro do item'].some(p=>m.obs.startsWith(p))?` <span class="mut">${esc(m.obs)}</span>`:'');
    const man=m.tipo==='baixa'&&!m.pedido_id&&(m.obs||'').startsWith('baixa manual');
    return [quando,(man?'➖ Baixa manual':(TIPO[m.tipo]||m.tipo))+(man?` <span class="mut">${esc(m.obs.slice(12).replace(/^[ (]+|\)?$/g,''))}</span>`:orig),`<strong class="${m.delta>=0?'up':'down'}">${m.delta>=0?'+':''}${q(m.delta)}</strong>`,m.saldo_apos==null?'—':q(m.saldo_apos)]});
  document.querySelector('.modal').innerHTML=`${mhead('Histórico',x.insumo)}<p class="hint">Estoque atual: <strong>${d.estoque==null?'—':fmtG(d.estoque,x.unidade)}</strong></p>
   ${dias?`<div class="hist-days">${dias}</div>`:''}
   ${rows.length?tbl(['Quando','Movimento','Qtd','Saldo'],rows,[2,3]):'<p class="hint">Sem movimentos registrados ainda.</p>'}
   <div class="m-foot"><button type="button" class="btn ghost" data-cx="fechar">Fechar</button></div>`;
}

let recForn=null;
function dlgReceberEntrega(){
  const nomes=[...new Set([...(sug?sug.pedidos.map(p=>p.fornecedor):[]),...Object.keys(forns)])];
  if(!recForn||!nomes.includes(recForn))recForn=nomes[0];
  const ped=sug&&sug.pedidos.find(p=>p.fornecedor===recForn);
  const pedMap={};if(ped)ped.itens.forEach(i=>pedMap[i.insumo]=i.qtd);
  const lista=itens.filter(x=>x.fornecedor===recForn&&!x.ciclo&&!x.generico).sort((a,b)=>(pedMap[b.insumo]?1:0)-(pedMap[a.insumo]?1:0)||a.insumo.localeCompare(b.insumo,'pt-BR'));
  const entrega=ped?`Entrega prevista: ${fmtDia(ped.entrega)}`:'Sem pedido sugerido pra esse fornecedor agora';
  openModal(`${mhead('Receber entrega','Conferir o que chegou')}
  <form class="mform" id="fRecEnt">
   <label>Fornecedor<select id="recForn">${nomes.map(n=>`<option ${n===recForn?'selected':''}>${esc(n)}</option>`).join('')}</select><small>${entrega}</small></label>
   ${lista.length?`<div class="conf"><div class="conf-h"><span>Item</span><span>Pedido</span><span>Chegou</span></div>
   ${lista.map((x,k)=>{const u=unid(x),p=pedMap[x.insumo]||0,pq=p?Math.round(p/u.f*10)/10:0;
     return `<div class="conf-r"><span><b>${esc(x.insumo)}</b>${x.embalagem_qtd?`<small>1 ${esc(u.lab)} = ${N(u.f,3)} ${x.unidade}</small>`:''}</span><span class="num">${p?N(pq,pq%1?1:0)+' '+esc(u.lab):'—'}</span><span class="inu"><input class="cin" type="number" min="0" step="${u.step==='1'?'any':u.step}" inputmode="decimal" data-i="${k}" data-ins="${esc(x.insumo)}" data-f="${u.f}" data-ped="${pq}" placeholder="0" aria-label="${esc(x.insumo)} que chegou, em ${esc(u.lab)}"><small>${esc(u.lab)}</small></span></div>`}).join('')}</div>
   <button type="button" class="btn ghost" data-cx="tudo" style="justify-self:start">Chegou tudo como pedido</button>`:'<p class="hint">Nenhum item cadastrado pra esse fornecedor.</p>'}
   <label>Observação (opcional)<input id="recObs" maxlength="80" placeholder="ex: faltou 1 caixa, entregador volta amanhã"></label>
   <div class="m-prev" id="recPrev">Preencha o que chegou. O que vier diferente do pedido fica marcado.</div>
   <div class="m-foot"><button type="button" class="btn ghost" data-cx="fechar">Cancelar</button><a class="btn ghost" href="/lancar-nota" target="_blank" rel="noopener">Lançar nota</a><button class="btn brasa">Confirmar entrada</button></div></form>`);
  document.getElementById('recForn').addEventListener('change',e=>{recForn=e.target.value;dlgReceberEntrega()});
  const upd=()=>{const ins=[...document.querySelectorAll('#fRecEnt [data-ins]')];let pre=0,falt=0;
    ins.forEach(i=>{if(i.value==='')return;pre++;const v=+i.value,p=+i.dataset.ped;i.classList.toggle('diff',!!p&&v!==p);if(p&&v<p)falt++});
    document.getElementById('recPrev').innerHTML=pre?`${pre} de ${ins.length} itens conferidos${falt?` · <span class="down">${falt} veio menos que o pedido</span>`:' · tudo certo'}`:'Preencha o que chegou. O que vier diferente do pedido fica marcado.'};
  document.getElementById('fRecEnt').addEventListener('input',upd);
  document.getElementById('fRecEnt').addEventListener('click',e=>{if(e.target.dataset.cx==='tudo'){document.querySelectorAll('#fRecEnt [data-ins]').forEach(i=>{if(+i.dataset.ped)i.value=i.dataset.ped});upd()}});
  document.getElementById('fRecEnt').addEventListener('submit',async ev=>{ev.preventDefault();
    const its=[...document.querySelectorAll('#fRecEnt [data-ins]')].filter(i=>i.value!==''&&+i.value>0).map(i=>({insumo:i.dataset.ins,quantidade:Math.round(+i.value*+i.dataset.f*1000)/1000,pedido:Math.round(+i.dataset.ped*+i.dataset.f*1000)/1000}));
    if(!its.length){toast('Preencha pelo menos um item que chegou');return}
    const r=await post('/api/estoque_entrega',{fornecedor:recForn,itens:its,obs:document.getElementById('recObs').value});
    if(!r.ok){toast(r.erro||'Não foi possível salvar');return}closeModal();
    toast(`Entrada de ${recForn} salva · ${r.itens} ${r.itens>1?'itens':'item'}${r.faltas.length?` · ${r.faltas.length} com falta registrada`:''}`);carregar()});
}

let contCat='perecivel';
function dlgContagem(){
  const cat=x=>(forns[x.fornecedor]&&forns[x.fornecedor].categoria)||'seco';
  const lista=itens.filter(x=>!x.ciclo&&!x.generico&&cat(x)===contCat).sort((a,b)=>a.insumo.localeCompare(b.insumo,'pt-BR'));
  openModal(`${mhead('Fazer contagem','Conferir o estoque real')}
  <p class="hint">Conte o que tem na câmara e no estoque seco. A diferença pro sistema vira "contagem manual" no histórico.</p>
  <div class="seg" style="margin-bottom:10px">${[['perecivel','Câmara (perecíveis)'],['seco','Estoque seco']].map(([v,l])=>`<button type="button" data-cat="${v}" aria-pressed="${v===contCat}">${l}</button>`).join('')}</div>
  <form class="mform" id="fCont"><div class="conf"><div class="conf-h"><span>Item</span><span>Sistema</span><span>Contado</span></div>
  ${lista.map((x,k)=>{const f=x.unidade==='g'?1000:1,lab=x.unidade==='g'?'kg':x.unidade;
    return `<div class="conf-r"><span><b>${esc(x.insumo)}</b><small class="cdiff" id="cd-${k}"></small></span><span class="num">${fmtG(x.estoque,x.unidade)}</span><span class="inu"><input class="cin" type="number" min="0" step="any" inputmode="decimal" data-ins="${esc(x.insumo)}" data-k="${k}" data-f="${f}" data-sis="${x.estoque??0}" placeholder="0" aria-label="Contagem de ${esc(x.insumo)} em ${lab}"><small>${lab}</small></span></div>`}).join('')}</div>
  <div class="m-foot"><button type="button" class="btn ghost" data-cx="fechar">Cancelar</button><button class="btn brasa">Salvar contagem</button></div></form>`);
  const f=document.getElementById('fCont');
  f.addEventListener('input',e=>{const t=e.target;if(t.dataset.k===undefined)return;const c=document.getElementById('cd-'+t.dataset.k);
    if(t.value===''){c.textContent='';return}const d=Math.round(+t.value*+t.dataset.f)-Math.round(+t.dataset.sis);
    c.textContent=d===0?'bate com o sistema':(d>0?'+':'−')+N(Math.abs(d),1)+' de diferença';c.className='cdiff '+(d===0?'up':'down')});
  document.querySelectorAll('.modal [data-cat]').forEach(b=>b.addEventListener('click',()=>{contCat=b.dataset.cat;dlgContagem()}));
  f.addEventListener('submit',async ev=>{ev.preventDefault();
    const its=[...f.querySelectorAll('[data-ins]')].filter(i=>i.value!=='').map(i=>({insumo:i.dataset.ins,contado:Math.round(+i.value*+i.dataset.f*1000)/1000}));
    if(!its.length){toast('Conte pelo menos um item');return}
    const r=await post('/api/estoque_contagem',{itens:its});if(!r.ok){toast(r.erro||'Não foi possível salvar');return}
    closeModal();toast(`Contagem salva · ${r.itens} ${r.itens>1?'itens ajustados':'item ajustado'}`);carregar()});
}

function dlgFornecedor(nome){
  const novo=nome===null,f=novo?{categoria:'seco',dias_entrega:'seg,ter,qua,qui,sex',prazo:7,valor:0,antecedencia:1,cobertura:14}:forns[nome];if(!f)return;
  const marc=f.dias_entrega==='todos'?DIAS.map(d=>d[0]):f.dias_entrega.split(',');
  openModal(`${mhead(novo?'Novo fornecedor':'Fornecedor',novo?'Cadastrar':nome)}
  <form class="mform" id="fForn">
   ${novo?'<label>Nome<input id="fNome" maxlength="60" placeholder="ex: Ki Pudim" required></label>':''}
   <label>Categoria<select id="fCat"><option value="seco"${f.categoria==='seco'?' selected':''}>Seco</option><option value="perecivel"${f.categoria==='perecivel'?' selected':''}>Perecível</option></select></label>
   <label>Dias de entrega<span style="display:flex;flex-wrap:wrap;gap:6px 12px;font-weight:500">${DIAS.map(([k,r])=>`<label class="chk" style="display:flex;gap:4px"><input type="checkbox" value="${k}" ${marc.includes(k)?'checked':''}>${r}</label>`).join('')}</span></label>
   <label>Antecedência do pedido (dias)<input id="fAnt" type="number" min="0" max="14" value="${f.antecedencia}"></label>
   <label>Cobertura do estoque (dias)<input id="fCob" type="number" min="1" max="90" value="${f.cobertura}"></label>
   <label>Prazo de pagamento (dias)<input id="fPrazo" type="number" min="0" max="120" value="${f.prazo}"></label>
   <label>Valor médio mensal (R$)<input id="fVal" type="number" min="0" step="10" value="${f.valor}"></label>
   <div class="m-foot"><button type="button" class="btn ghost" data-cx="fechar">Cancelar</button><button class="btn brasa">Salvar</button></div></form>`);
  document.getElementById('fForn').addEventListener('submit',async ev=>{ev.preventDefault();
    const dias=[...document.querySelectorAll('#fForn input[type=checkbox]:checked')].map(i=>i.value);if(!dias.length){toast('Marque pelo menos um dia de entrega');return}
    const corpo={categoria:document.getElementById('fCat').value,dias_entrega:dias.length===7?'todos':dias.join(','),antecedencia_dias:document.getElementById('fAnt').value,cobertura_dias:document.getElementById('fCob').value,prazo_dias:document.getElementById('fPrazo').value,valor_mensal:document.getElementById('fVal').value};
    let r;if(novo){corpo.nome=document.getElementById('fNome').value.trim();if(!corpo.nome)return;r=await post('/api/fornecedor_novo',corpo)}else{corpo.nome=nome;r=await post('/api/fornecedor',corpo)}
    if(!r.ok){toast(r.erro||'Não foi possível salvar');return}closeModal();carregar()});
}

function dlgInsumo(nome){
  const novo=nome===null,x=novo?{insumo:'',unidade:'un',fornecedor:'—',estoque:null,custo_unitario:null}:itens.find(i=>i.insumo===nome);if(!x)return;
  const nomes=[...new Set([...Object.keys(forns),x.fornecedor].filter(f=>f&&f!=='—'))];
  openModal(`${mhead(novo?'Novo item':'Editar insumo',novo?'Novo item de estoque':x.insumo)}
  <form class="mform" id="fIns">
   ${novo?`<label>Nome do item<input id="iNome" maxlength="80" placeholder="ex: Molho Cheddar" required></label>
   <label>Unidade<select id="iUn"><option value="un">unidade</option><option value="g">gramas (g)</option><option value="kg">quilos (kg)</option></select></label>`:''}
   <label>Fornecedor<select id="iForn">${x.fornecedor==='—'?'<option value="">— sem fornecedor —</option>':''}${nomes.map(f=>`<option value="${esc(f)}"${f===x.fornecedor?' selected':''}>${esc(f)}</option>`).join('')}</select></label>
   <label>Estoque atual${novo?'':` (${x.unidade})`}<input id="iEst" type="number" step="any" min="0" placeholder="—" value="${x.estoque??''}"></label>
   <label>Estoque mínimo <small>${novo?'':`(automático: ${Math.ceil(x.minimo_auto)})`}</small><input id="iMin" type="number" step="any" min="0" placeholder="vazio = automático" value="${!novo&&x.minimo_manual?x.minimo:''}"></label>
   <label class="chk"><input id="iCiclo" type="checkbox" ${!novo&&x.ciclo?'checked':''}> Controlar por troca (sem contagem de estoque, hortifrúti)</label>
   ${novo?'':`<label class="chk"><input id="iPausa" type="checkbox" ${x.pausado?'checked':''}> Pausar item (sem alertas nem sugestão de compra enquanto não usar)</label>`}
   <label>Embalagem de compra <small>nome e quantidade na unidade do item</small><span style="display:grid;grid-template-columns:1fr 1fr;gap:8px"><input id="iEmbN" maxlength="30" placeholder="caixa, bolsa, fardo…" value="${esc(!novo&&x.embalagem_nome||'')}"><input id="iEmbQ" type="number" step="any" min="0" placeholder="qtd por embalagem" value="${!novo&&x.embalagem_qtd||''}"></span></label>
   <label>Custo unitário (R$)<input id="iCusto" type="number" step="any" min="0" placeholder="0,00" value="${x.custo_unitario??''}"></label>
   <div class="m-foot"><button type="button" class="btn ghost" data-cx="fechar">Cancelar</button><button class="btn brasa">Salvar</button></div></form>`);
  document.getElementById('fIns').addEventListener('submit',async ev=>{ev.preventDefault();
    const g=id=>document.getElementById(id);
    if(novo){const n=g('iNome').value.trim();if(!n)return;
      const r=await post('/api/insumo_novo',{insumo:n,unidade:g('iUn').value,fornecedor:g('iForn').value,estoque:g('iEst').value,custo_unitario:g('iCusto').value});
      if(!r.ok){toast(r.erro||'Não foi possível criar o item');return}
      if(g('iMin').value.trim()!=='')await post('/api/estoque_minimo',{insumo:n,minimo:parseFloat(g('iMin').value)});
      st.busca=n;closeModal();carregar();return}
    const tarefas=[],forn=g('iForn').value,est=parseFloat(g('iEst').value),custo=parseFloat(g('iCusto').value);
    if(forn&&forn!==x.fornecedor)tarefas.push(post('/api/insumo_fornecedor',{insumo:x.insumo,fornecedor:forn}));
    if(!isNaN(est)&&est>=0&&est!==x.estoque)tarefas.push(post('/api/estoque',{insumo:x.insumo,estoque:est}));
    if(!isNaN(custo)&&custo>=0&&custo!==x.custo_unitario)tarefas.push(post('/api/insumo_custo',{insumo:x.insumo,custo_unitario:custo}));
    const ciclo=g('iCiclo').checked;if(ciclo!==!!x.ciclo)tarefas.push(post('/api/insumo_ciclo',{insumo:x.insumo,ativo:ciclo}));
    if(!novo&&g('iPausa').checked!==!!x.pausado)tarefas.push(post('/api/insumo_pausado',{insumo:x.insumo,ativo:g('iPausa').checked}));
    const en=g('iEmbN').value.trim(),eq=g('iEmbQ').value.trim();
    if(en!==(x.embalagem_nome||'')||(eq===''?null:parseFloat(eq))!==(x.embalagem_qtd||null)){const r=await post('/api/insumo_embalagem',{insumo:x.insumo,nome:en,qtd:eq});if(!r.ok){toast(r.erro||'Embalagem inválida');return}}
    const mt=g('iMin').value.trim(),mn=mt===''?null:parseFloat(mt),ma=x.minimo_manual?x.minimo:null;
    if(mn!==ma&&(mn===null||(!isNaN(mn)&&mn>=0)))tarefas.push(post('/api/estoque_minimo',{insumo:x.insumo,minimo:mn}));
    await Promise.all(tarefas);closeModal();carregar()});
}

/* ---------- tela ---------- */
function filtrar(){const termos=semAcento(st.busca).split(/\s+/).filter(Boolean);
  el.querySelectorAll('#tEstoque tbody tr').forEach(tr=>{tr.style.display=termos.every(t=>(tr.dataset.busca||'').includes(t))?'':'none'})}

function desenhar(){
  const d=plano,es=estq;if(!d||!es)return;
  const nHoje=sug?sug.pedidos.filter(p=>p.pedir_hoje).length:0;
  const abaixo=itens.filter(x=>x.abaixo_minimo).length;
  const sem=itens.filter(x=>x.estoque==null&&!x.ciclo&&!x.generico&&!x.pausado).length;
  const maxVal=Math.max(...d.concentracao.map(c=>c.valor),1);
  const aviso=d.pico&&d.pico.qtd>=2
    ?`<div class="card s12 aviso warn">⚠️ No dia <strong>${d.pico.dia}</strong> vencem <strong>${d.pico.qtd} boletos</strong> juntos (${R(d.pico.valor)}): ${d.pico.forns.join(', ')}. Se apertar o caixa, adie o pedido de um fornecedor "todo dia" pra empurrar o vencimento.</div>`
    :`<div class="card s12 aviso ok">✅ Boletos bem distribuídos — nenhum dia concentra muito.</div>`;
  const ordenados=[...itens].sort((a,b)=>a.insumo.localeCompare(b.insumo,'pt-BR',{sensitivity:'base'}));
  const linhas=ordenados.map(x=>{const q=esc(x.insumo);
    return {attr:` data-busca="${esc(semAcento(x.insumo+' '+x.fornecedor))}"`,cells:[
      `<strong>${q}</strong>${x.pausado?' <span class="pill">⏸ pausado</span>':x.estoque===0&&!x.ciclo?' <span class="pill p-bad">zerado</span>':x.abaixo_minimo?' <span class="pill p-warn">abaixo</span>':''}`,
      `<span class="mut">${esc(x.fornecedor)}</span>`,
      `<span class="mut">${fmtQ(x.consumo_dia,x.unidade)}</span>`,
      fmtQ(x.necessidade,x.unidade),
      `<input class="cin" data-est="${q}" type="number" step="0.1" min="0" value="${x.estoque??''}" placeholder="—" style="${x.abaixo_minimo?'border-color:var(--warn)':''}" aria-label="Estoque atual de ${q}">`,
      `<span class="mut" title="${x.minimo_manual?'mínimo manual':'mínimo automático'}">${x.ciclo?'—':fmtQ(x.minimo,x.unidade)+(x.minimo_manual?' ✎':'')}</span>`,
      celulaPedirAte(x),
      `<strong class="${x.comprar>0?'down':'up'}">${x.comprar>0?fmtQ(x.comprar,x.unidade):'✓ ok'}</strong>${x.ciclo?'<br><small class="mut">p/ o ciclo até a próxima troca</small>':''}${x.comprar>0&&x.embalagem_qtd?`<br><small class="mut">≈ ${x.comprar_embalagens} ${esc(x.embalagem_nome)}(s) de ${N(x.embalagem_qtd)} ${x.unidade}</small>`:''}`,
      `<span class="mut">R$</span> <input class="cin" data-custo="${q}" type="number" step="any" min="0" value="${x.custo_unitario??''}" placeholder="0,00" aria-label="Custo de ${q}">`,
      `<span class="mut">${x.custo_dia!=null?R(x.custo_dia):'—'}</span>`,
      `<span class="row-act"><button class="ib" data-rec="${q}" title="Receber entrega (soma ao estoque)" aria-label="Receber entrega de ${q}">${ic('in')}</button><button class="ib" data-baixa="${q}" title="Dar baixa manual (perda, uso interno)" aria-label="Baixa manual de ${q}">${ic('out')}</button><button class="ib" data-hist="${q}" title="Ver baixas, entregas e contagens" aria-label="Histórico de ${q}">${ic('clock')}</button><button class="ib" data-edit="${q}" title="Editar fornecedor, estoque, mínimo e custo" aria-label="Editar ${q}">${ic('edit')}</button></span>`]}});
  const fRows=d.itens.map(it=>({cells:[`<strong>${esc(it.nome)}</strong>`,`<span class="pill ${it.categoria==='perecivel'?'p-warn':'p-n'}">${it.categoria==='perecivel'?'Perecível':'Seco'}</span>`,it.dias_entrega==='todos'?'Todo dia':it.dias_entrega,`${it.antecedencia} dia(s)`,`${it.cobertura} dias`,`${it.prazo} dias`,
    `<input class="cin" data-forn="${esc(it.nome)}" type="number" step="10" min="0" value="${(+it.valor).toFixed(2)}" aria-label="Valor mensal de ${esc(it.nome)}">`,
    `<span class="${(it.real_mes||0)>it.valor?'down':(it.real_mes>0?'up':'mut')}">${(it.real_mes||0)>0?R(it.real_mes)+(it.real_mes>it.valor?' ⚠️':''):'—'}</span>`,
    `<button class="ib" data-editf="${esc(it.nome)}" aria-label="Editar ${esc(it.nome)}">${ic('edit')}</button>`]}));
  const pedidosHtml=sug?sug.pedidos.map((p,k)=>`<div class="ped ${p.pedir_hoje?'hoje':''}"><div class="ped-top"><span><strong>${esc(p.fornecedor)}</strong> <span class="pill ${p.pedir_hoje?'p-bad':'p-n'}">${p.pedir_hoje?'pedir HOJE':'pedir até '+fmtDia(p.pedir_ate)}</span> <span class="pill p-n">entrega ${fmtDia(p.entrega)}</span>${p.dias_sem_produto?` <span class="pill p-bad">⚠️ ${p.dias_sem_produto} dia(s) sem produto</span>`:''}</span>
     <span><small class="mut">estimado ${R(p.total_estimado)}${p.itens_sem_custo?' + '+p.itens_sem_custo+' sem custo':''}</small> <button class="btn ghost" data-copiar="${k}">📋 Copiar pedido</button></span></div>
     ${tbl(['Insumo','Estoque','Acaba em','Pedir','Custo est.'],p.itens.map(i=>[esc(i.insumo),`<span class="mut">${N(i.estoque,i.unidade==='kg'?1:0)} ${i.unidade}</span>`,`<span class="mut">${fmtDia(i.acaba_em)}</span>`,`<strong class="down">${i.embalagens?`${i.embalagens} ${esc(i.embalagem_nome)}(s) <span class="mut" style="font-weight:400">(${N(i.qtd,i.unidade==='kg'?1:0)} ${i.unidade})</span>`:`${N(i.qtd,i.unidade==='kg'?1:0)} ${i.unidade}`}</strong>`,`<span class="mut">${i.custo_estimado!=null?R(i.custo_estimado):'—'}</span>`]),[1,3,4],[2,4])}</div>`).join(''):'';
  const rotas=r=>r==='todos'?'todo dia':r.split(',').map(x=>x==='sab'?'sáb':x).join('/');
  const sugHtml=sug?`<p class="hint">${sug.pedidos.length?`Semana até ${fmtDia(sug.semana_fim)}: <strong>${nHoje}</strong> pedido(s) pra fazer hoje · ${sug.pedidos.length-nHoje} ainda esta semana`:`Nada pra pedir até ${fmtDia(sug.semana_fim)} ✅`} · previsão de pedidos (próx. 7 dias): ${sug.pedidos_previstos.join(' · ')}${sug.sem_estoque.length?`<br><span class="down">❓ Sem estoque preenchido (fora da sugestão): ${sug.sem_estoque.join(', ')}</span>`:''}</p>
    ${pedidosHtml}
    ${sug.proximos.length?`<p class="hint" style="margin-top:10px">📅 <strong style="color:var(--ink)">Próximas rotas</strong> (sem pedido esta semana):${sug.proximos.map(p=>`<br>• <strong style="color:var(--ink)">${esc(p.fornecedor)}</strong> — rotas ${rotas(p.rotas)} · próxima entrega ${fmtDia(p.entrega)}`).join('')}</p>`:''}
    ${sug.hortifruti.length?`<p class="hint">🥬 <strong style="color:var(--ink)">Hortifrúti</strong> — próxima troca ${fmtDia(sug.hortifruti[0].proxima_troca)} (ciclo de ${sug.hortifruti[0].dias_ciclo} dia(s)): ${sug.hortifruti.map(x=>`${esc(x.insumo)} ~${Math.ceil(x.qtd)} ${x.unidade}`).join(' · ')}</p>`:''}`:'<p class="hint">Não foi possível calcular a sugestão agora.</p>';
  el.innerHTML=`<div class="g">
  <div class="card s12 stock-bar"><div><h3>Movimentar estoque</h3><p class="hint" style="margin:0">Os pedidos dão baixa sozinhos pela ficha técnica. Entrada, contagem e baixa manual são com você.</p></div>
   <div class="stock-acts"><button class="sa" data-do="entrega">${ic('box')}<span><b>Receber entrega</b><small>conferir o que chegou</small></span></button><button class="sa" data-do="contagem">${ic('count')}<span><b>Fazer contagem</b><small>acertar o estoque real</small></span></button><button class="sa" data-do="baixa">${ic('out')}<span><b>Dar baixa</b><small>perda, uso interno</small></span></button></div></div>
  ${kpi('Pedir hoje',nHoje+' pedido(s)',sug?`${sug.pedidos.length} até o fim da semana`:'')}
  ${kpi('Abaixo do mínimo',abaixo+' insumo(s)',sem?`${sem} sem estoque preenchido`:'todos com estoque preenchido',abaixo?'down':'')}
  ${kpi('Custo de insumos/dia',R(es.custo_dia_total),es.sem_custo>0?`${es.sem_custo} insumo(s) sem custo`:'todos com custo cadastrado')}
  ${kpi('Compra total/mês',R(d.total_mes),`${d.itens.length} fornecedores · maior boleto ${d.pico?R(d.pico.valor):'—'}`)}
  ${aviso}
  <div class="card s12" id="sugestao"><h3>Sugestão de compra 🛒</h3>${sugHtml}</div>
  <div class="card s12" id="estoque"><div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px;flex-wrap:wrap"><div><h3>Plano de estoque do mês 📦</h3>
   <p class="hint" style="margin:0">${sem>0?`Preencha o estoque atual dos ${sem} insumo(s) em branco — a coluna <strong>Comprar</strong> assume zero até lá.`:`Cobertura de cada fornecedor + ${es.seguranca_pct}% de segurança · a coluna <strong>Comprar</strong> é sua ordem de compra.`} O estoque desconta sozinho a cada pedido; edite só pra corrigir.</p></div>
   <div class="filters"><span class="lbl">Segurança</span><div class="seg" style="width:auto">${[10,20,30].map(v=>`<button data-seg="${v}" aria-pressed="${v===st.seguranca}">+${v}%</button>`).join('')}</div></div></div>
   <div class="filters" style="margin:12px 0"><input id="busca" class="busca" type="search" placeholder="🔍 Buscar insumo ou fornecedor…" autocomplete="off" value="${esc(st.busca)}">
     <span class="lbl">Troca hortifrúti</span>${DIAS.map(([k,r])=>`<label class="chk2"><input type="checkbox" data-troca="${k}" ${es.troca_dias.split(',').includes(k)?'checked':''}>${r}</label>`).join('')}
     <button class="btn ghost" data-do="novoItem">➕ Novo item</button></div>
   <div id="tEstoque">${tbl(['Insumo','Fornecedor','Consumo/dia','Necessidade','Estoque atual','Mínimo','Pedir até','Comprar','Custo unit.','Custo/dia',''],linhas,[2,3,5,9],[1,2,3,5,8,9])}</div></div>
  <div class="card s12" id="boletos"><div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;align-items:flex-start"><div><h3>Calendário de boletos do mês</h3><p class="hint" style="margin:0">Pedidos na ${d.ancora_dow.toLowerCase()}-feira → ${d.concentracao.length} vencimentos no mês</p></div>
   <div class="filters"><span class="lbl">Pedir sempre na</span><select id="ancora" aria-label="Dia-âncora">${[['seg','segunda'],['ter','terça'],['qua','quarta'],['qui','quinta'],['sex','sexta']].map(([k,l])=>`<option value="${k}"${k===st.ancora?' selected':''}>${l}</option>`).join('')}</select></div></div>
   <div class="boletos">${d.concentracao.map(c=>{const pico=d.pico&&c.data===d.pico.data&&c.qtd>=2;return `<div class="boleto${pico?' pico':''}"><span class="dia">dia ${c.dia}</span><span class="barra"><i style="width:${Math.max(100*c.valor/maxVal,6)}%"></i><span>${esc(c.forns.join(', '))}</span></span><b>${R(c.valor)}</b></div>`}).join('')}</div>
   <details class="more"><summary>Ordem de compra (entrega e vencimento por fornecedor)</summary>${tbl(['Fornecedor','Entrega','Vence'],d.itens.map(it=>[esc(it.nome),`${it.entrega_dow} ${it.entrega.slice(8,10)}/${it.entrega.slice(5,7)}`,`${it.vence_dow} ${it.vence.slice(8,10)}/${it.vence.slice(5,7)}`]))}</details></div>
  <div class="card s12" id="fornecedores"><div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap"><div><h3>Fornecedores</h3><p class="hint" style="margin:0">Edite o valor mensal direto na tabela ou use o lápis pra rotas, cobertura e prazo.</p></div><button class="btn ghost" data-do="novoForn">➕ Novo fornecedor</button></div>
   <div style="margin-top:10px">${tbl(['Fornecedor','Tipo','Entrega','Antecedência','Cobertura','Prazo','Valor/mês','Real no mês',''],fRows,[6,7],[2,3,4])}</div></div>
  </div>`;
  filtrar();
}

async function carregar(){
  if(!el)return;
  try{
    const [d,es,sg]=await Promise.all([
      fetch(`/api/compras_plano?ancora=${st.ancora}`).then(r=>r.json()),
      fetch(`/api/estoque_plano?cobertura_dias=${st.cobertura}&seguranca_pct=${st.seguranca}`).then(r=>r.json()),
      fetch(`/api/sugestao_compra?cobertura_dias=${st.cobertura}&seguranca_pct=${st.seguranca}`).then(r=>r.json()).catch(()=>null)]);
    plano=d;estq=es;sug=sg;itens=es.itens;forns=Object.fromEntries(d.itens.map(i=>[i.nome,i]));
    const y=document.getElementById('main').scrollTop;desenhar();document.getElementById('main').scrollTop=y;
  }catch(e){el.innerHTML='<div class="card"><h3>Não foi possível carregar</h3><p class="hint">Tente de novo em instantes.</p></div>'}
}

async function salvarInline(inp,url,corpo){const r=await post(url,corpo);if(r.ok){inp.style.borderColor='var(--ok)';setTimeout(carregar,400)}else toast(r.erro||'Não foi possível salvar')}
function ligar(){
  document.addEventListener('click',e=>{
    if(!el||!document.body.contains(el))return;
    const c=e.target.closest('[data-cx]');if(c&&c.dataset.cx==='fechar'){closeModal();return}
    if(e.target.classList&&e.target.classList.contains('modal-bg')){closeModal();return}
    if(!e.target.closest('#content'))return;
    const g=a=>e.target.closest(a);let b;
    if(b=g('[data-do]')){const t=b.dataset.do;if(t==='entrega')dlgReceberEntrega();else if(t==='contagem')dlgContagem();else if(t==='baixa')dlgBaixaItem(null);else if(t==='novoItem')dlgInsumo(null);else if(t==='novoForn')dlgFornecedor(null);return}
    if(b=g('[data-rec]')){const x=itens.find(i=>i.insumo===b.dataset.rec);if(x)dlgReceberItem(x);return}
    if(b=g('[data-baixa]')){const x=itens.find(i=>i.insumo===b.dataset.baixa);if(x)dlgBaixaItem(x);return}
    if(b=g('[data-hist]')){const x=itens.find(i=>i.insumo===b.dataset.hist);if(x)dlgHist(x);return}
    if(b=g('[data-edit]')){dlgInsumo(b.dataset.edit);return}
    if(b=g('[data-editf]')){dlgFornecedor(b.dataset.editf);return}
    if(b=g('[data-seg]')){st.seguranca=+b.dataset.seg;carregar();return}
    if(b=g('[data-copiar]')){const p=sug.pedidos[+b.dataset.copiar];const q=i=>i.embalagens?`${i.embalagens} ${i.embalagem_nome}(s)`:`${N(i.qtd,i.unidade==='kg'?1:0)} ${i.unidade}`;
      const txt=`Pedido ${p.fornecedor} — entrega ${fmtDia(p.entrega)}\n`+p.itens.map(i=>`• ${i.insumo}: ${q(i)}`).join('\n');
      navigator.clipboard.writeText(txt).then(()=>{b.textContent='✅ Copiado'},()=>{prompt('Copie o pedido:',txt)});setTimeout(()=>{b.textContent='📋 Copiar pedido'},2000);return}
  });
  document.addEventListener('keydown',e=>{if(e.key==='Escape')closeModal();if(e.key==='Enter'&&e.target.matches&&e.target.matches('#content input.cin'))e.target.blur()});
  document.addEventListener('input',e=>{if(e.target.id==='busca'){st.busca=e.target.value;filtrar()}});
  document.addEventListener('change',e=>{const t=e.target;if(!el||!document.body.contains(el)||!t.closest('#content'))return;
    if(t.id==='ancora'){st.ancora=t.value;carregar();return}
    if(t.dataset.troca){const dias=[...el.querySelectorAll('[data-troca]:checked')].map(i=>i.dataset.troca);if(!dias.length){t.checked=true;return}
      post('/api/config_troca',{dias:dias.join(',')}).then(carregar);return}
    if(t.dataset.est!==undefined){const v=parseFloat(t.value);if(isNaN(v)||v<0)return;salvarInline(t,'/api/estoque',{insumo:t.dataset.est,estoque:v});return}
    if(t.dataset.custo!==undefined){const v=parseFloat(t.value);if(isNaN(v)||v<0)return;salvarInline(t,'/api/insumo_custo',{insumo:t.dataset.custo,custo_unitario:v});return}
    if(t.dataset.forn!==undefined){const v=parseFloat(t.value);if(isNaN(v)||v<0)return;salvarInline(t,'/api/fornecedor',{nome:t.dataset.forn,valor_mensal:v})}});
}
let ligado=false;
window.V2.screens.compras={render(c){el=c;el.innerHTML='<div class="card"><p class="hint" style="margin:0">Carregando estoque e compras…</p></div>';if(!ligado){ligar();ligado=true}carregar()},onFiltros(){}};
})();
