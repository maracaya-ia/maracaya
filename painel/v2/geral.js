/* Painel 2.0 — Visão geral (sócio): resumão por unidade e marca no período escolhido */
(function(){
const R=v=>(+(v??0)).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
const R0=v=>(+(v??0)).toLocaleString('pt-BR',{style:'currency',currency:'BRL',maximumFractionDigits:0});
const N=v=>(+(v??0)).toLocaleString('pt-BR');
const P1=v=>(+(v??0)).toLocaleString('pt-BR',{maximumFractionDigits:1})+'%';
const esc=t=>String(t??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;');
const J=u=>fetch(u).then(r=>r.json());
const COR={'Maracayá Burger|Colorado':'--c-gc','Maracayá Burger|Sobradinho':'--c-sob','Chomp Burger|Colorado':'--c-chomp','Chomp Burger|Sobradinho':'--c-chomp'};
const nome=(m,u)=>`${m.replace(' Burger','')} · ${u==='Colorado'?'GC':u}`;
const ativoAgora=()=>!!document.getElementById('g-root');
let el=null,timer=null,seq=0;

const per=()=>{const p=window.V2.filtros.periodo;return p==='1'?'hoje':p};
function intervalo(){const iv=window.V2.intervalo();return iv.ini?`dias=${iv.dias}&inicio=${iv.ini}&fim=${iv.fim}`:`dias=${iv.dias}`}
async function numeros(marca,unidade){
  const q=`marca=${encodeURIComponent(marca)}&unidade=${encodeURIComponent(unidade)}`;
  const [d,r]=await Promise.all([J(`/api/dados?${intervalo()}&${q}`).catch(()=>null),J(`/api/dre?${q}&periodo=${per()}`).catch(()=>null)]);
  if(!d||!r)return null;
  const k=d.kpis,res=r.resumo,vendas=r.linhas.find(l=>l.rotulo.startsWith('Vendas cheias'))?.valor??0;
  return {fat:+k.faturamento,ped:+k.pedidos,ticket:+k.ticket,canc:+k.cancelados,tot:+k.total_geral,lucro:+res.lucro,margem:+res.margem,cmv:+res.cmv,vendas};
}
async function render(c){
  el=c;const meu=++seq;
  el.innerHTML='<div id="g-root"><div class="card"><p class="hint" style="margin:0">Montando o resumo por unidade e marca…</p></div></div>';window.V2.setJump([]);
  const [u,m]=await Promise.all([J('/api/unidades').catch(()=>({})),J('/api/marcas').catch(()=>({}))]);
  const combos=[];(m.marcas||[]).forEach(mc=>(u.unidades||[]).forEach(un=>combos.push([mc,un])));
  const grupo=await numeros('todas','todas');           // um de cada vez: o servidor é pequeno
  const porUn=[];for(const un of (u.unidades||[])){const n=await numeros('todas',un);if(n&&n.ped>0)porUn.push({un,n});if(meu!==seq)return}
  const linhas=[];for(const [mc,un] of combos){const n=await numeros(mc,un);if(n&&n.ped>0)linhas.push({mc,un,n});if(meu!==seq)return}
  if(meu!==seq||!el)return;
  const perTxt=document.querySelector('#filters #f-per option:checked')?.textContent||'período';
  const tot=grupo?grupo.fat:linhas.reduce((a,x)=>a+x.n.fat,0)||1;
  const kp=(l,v,s,cl='')=>`<div class="card kpi ${cl}"><div class="k-l">${l}</div><div class="k-v">${v}</div><div class="k-s">${s||'&nbsp;'}</div></div>`;
  const txCanc=n=>n.tot>0?100*n.canc/n.tot:0;
  const cartao=(titulo,cor,n)=>`<div class="card"><h3 style="display:flex;justify-content:space-between;gap:8px;align-items:center"><span><i class="bol" style="background:var(${cor})"></i>${esc(titulo)}</span><span class="pill ${n.margem<15?'p-bad':n.margem<30?'p-warn':'p-ok'}">margem ${P1(n.margem)}</span></h3>
    <div class="kpi" style="margin-top:6px"><div class="k-l">Faturamento</div><div class="k-v">${R0(n.fat)}</div><div class="k-s">${tot?(100*n.fat/tot).toFixed(0):0}% do grupo</div></div>
    <div class="resumo-mini"><div><small>Pedidos</small><b>${N(n.ped)}</b></div><div><small>Ticket</small><b>${R(n.ticket)}</b></div><div><small>Lucro</small><b class="${n.lucro<0?'down':''}">${R0(n.lucro)}</b></div><div><small>Cancel.</small><b>${P1(txCanc(n))}</b></div></div></div>`;
  const corUn={Colorado:'--c-gc',Sobradinho:'--c-sob'};
  el.innerHTML=`<div id="g-root" class="g">
  <div class="s12" style="font-size:12.5px;color:var(--ink-2)">Resumo por unidade e marca · <b style="color:var(--ink)">${esc(perTxt)}</b></div>
  ${grupo?`<div class="s12 kpis5">${kp('Grupo · Faturamento',R0(grupo.fat),`${N(grupo.ped)} pedidos`,'destaque')}${kp('Ticket médio',R(grupo.ticket),'')}${kp('Lucro',R0(grupo.lucro),`CMV ${P1(grupo.vendas?100*grupo.cmv/grupo.vendas:0)} das vendas`)}${kp('Margem',P1(grupo.margem),'sobre o subtotal')}${kp('Cancelamentos',N(grupo.canc),`${P1(txCanc(grupo))} dos pedidos`)}</div>`:''}
  <div class="card s12"><h3>Participação no faturamento</h3><p class="hint">${R0(tot)} no período</p>
   <div class="partbar">${linhas.map(x=>`<div style="flex:${Math.max(x.n.fat,1)};background:var(${COR[x.mc+'|'+x.un]||'--ink-2'})" title="${esc(nome(x.mc,x.un))}"></div>`).join('')}</div>
   <div class="legenda">${linhas.map(x=>`<span><i class="bol" style="background:var(${COR[x.mc+'|'+x.un]||'--ink-2'})"></i>${esc(nome(x.mc,x.un))} · ${tot?(100*x.n.fat/tot).toFixed(0):0}%</span>`).join('')}</div></div>
  <div class="sec" style="margin:4px 0 -6px">Por unidade</div>
  <div class="s12 compare">${porUn.map(x=>cartao(x.un==='Colorado'?'Colorado (GC) · todas as marcas':`${x.un} · todas as marcas`,corUn[x.un]||'--ink-2',x.n)).join('')}</div>
  <div class="sec" style="margin:4px 0 -6px">Por marca em cada unidade</div>
  <div class="s12 compare">${linhas.map(x=>cartao(nome(x.mc,x.un),COR[x.mc+'|'+x.un]||'--ink-2',x.n)).join('')}</div>
  <div class="card s12"><h3>Lado a lado</h3><p class="hint">Mesmo período, mesmas regras do DRE</p><div class="tw"><table><thead><tr><th>Operação</th><th class="r">Faturamento</th><th class="r">Pedidos</th><th class="r">Ticket</th><th class="r">CMV</th><th class="r">Lucro</th><th class="r">Margem</th><th class="r">Cancel.</th></tr></thead><tbody>
   ${linhas.map(x=>{const n=x.n;return `<tr><td><strong>${esc(nome(x.mc,x.un))}</strong></td><td class="r">${R0(n.fat)}</td><td class="r">${N(n.ped)}</td><td class="r">${R(n.ticket)}</td><td class="r">${P1(n.vendas?100*n.cmv/n.vendas:0)}</td><td class="r ${n.lucro<0?'down':''}">${R0(n.lucro)}</td><td class="r"><span class="pill ${n.margem<15?'p-bad':n.margem<30?'p-warn':'p-ok'}">${P1(n.margem)}</span></td><td class="r">${P1(txCanc(n))}</td></tr>`}).join('')}
   ${porUn.map(x=>{const n=x.n;return `<tr style="background:var(--surface-2)"><td><strong>Unidade ${esc(x.un==='Colorado'?'Colorado (GC)':x.un)}</strong></td><td class="r">${R0(n.fat)}</td><td class="r">${N(n.ped)}</td><td class="r">${R(n.ticket)}</td><td class="r">${P1(n.vendas?100*n.cmv/n.vendas:0)}</td><td class="r ${n.lucro<0?'down':''}">${R0(n.lucro)}</td><td class="r"><span class="pill ${n.margem<15?'p-bad':n.margem<30?'p-warn':'p-ok'}">${P1(n.margem)}</span></td><td class="r">${P1(txCanc(n))}</td></tr>`}).join('')}
   ${grupo?`<tr><td><strong>Grupo</strong></td><td class="r"><strong>${R0(grupo.fat)}</strong></td><td class="r"><strong>${N(grupo.ped)}</strong></td><td class="r"><strong>${R(grupo.ticket)}</strong></td><td class="r"><strong>${P1(grupo.vendas?100*grupo.cmv/grupo.vendas:0)}</strong></td><td class="r"><strong>${R0(grupo.lucro)}</strong></td><td class="r"><strong>${P1(grupo.margem)}</strong></td><td class="r"><strong>${P1(txCanc(grupo))}</strong></td></tr>`:''}
   </tbody></table></div></div>
  <p class="hint s12" style="margin:0">CMV em % das vendas cheias. Para o passo a passo do lucro, abra <a href="#resultado" data-go="resultado" style="color:var(--brasa-ink);font-weight:600">Resultado (DRE)</a>.</p></div>`;
}
window.V2.screens.geral={render(c){clearInterval(timer);render(c);timer=setInterval(()=>{if(ativoAgora())render(el);else clearInterval(timer)},10*60*1000)},onFiltros(){if(el&&ativoAgora())render(el)}};
})();
