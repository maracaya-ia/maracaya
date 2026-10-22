/* Painel 2.0 — tela Comparar unidades: marca × unidade lado a lado, a partir de /api/faturamento_mensal */
(function(){
const R=v=>(+(v??0)).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
const R0=v=>(+(v??0)).toLocaleString('pt-BR',{style:'currency',currency:'BRL',maximumFractionDigits:0});
const N=v=>(+(v??0)).toLocaleString('pt-BR');
const esc=t=>String(t??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;');
const MES=['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'],MESN=['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];
const ativoAgora=()=>!!document.getElementById('u-part');
const COR={'Maracayá Burger|Colorado':'--c-gc','Maracayá Burger|Sobradinho':'--c-sob','Chomp Burger|Colorado':'--c-chomp','Chomp Burger|Sobradinho':'--c-chomp'};
const nome=s=>`${s.marca.replace(' Burger','')} · ${s.unidade==='Colorado'?'GC':s.unidade}`;
let el=null,ligado=false,timer=null;

function spark(vals,cor){
  const w=260,h=64,p=6,mx=Math.max(...vals,1),pts=vals.map((v,i)=>[p+i*(w-2*p)/Math.max(vals.length-1,1),h-p-(v/mx)*(h-2*p)]);
  const dd=pts.map((q,i)=>(i?'L':'M')+q[0].toFixed(1)+' '+q[1].toFixed(1)).join(' ');
  const ult=pts[pts.length-1];
  return `<svg viewBox="0 0 ${w} ${h}" width="100%" height="${h}" role="img" aria-label="Faturamento mês a mês"><path d="${dd}" fill="none" stroke="var(${cor})" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/><circle cx="${ult[0]}" cy="${ult[1]}" r="4" fill="var(${cor})"/></svg>`;
}
function pintar(d){
  const hoje=new Date(d.hoje+'T12:00:00'),dia=hoje.getDate(),dm=new Date(hoje.getFullYear(),hoje.getMonth()+1,0).getDate();
  const idx=d.meses.length-1,parcial=d.meses[idx].parcial,iAnt=parcial?idx-1:idx;
  const nomeMes=MESN[+d.meses[idx].mes.slice(5)-1];
  const ser=d.series.filter(s=>s.faturamento.some(v=>v>0)).map(s=>{
    const atual=s.faturamento[idx],ant=s.faturamento[iAnt],ritmo=parcial?atual/dia*dm:atual;
    return {s,atual,ant,ritmo,delta:ant?100*(ritmo/ant-1):null,cor:COR[s.marca+'|'+s.unidade]||'--ink-2',hist:s.faturamento.slice(-6),
      ped:s.pedidos[idx],ticket:s.pedidos[idx]?s.faturamento[idx]/s.pedidos[idx]:null}});
  const tot=ser.reduce((a,x)=>a+x.atual,0),totAnt=ser.reduce((a,x)=>a+(x.ant||0),0),totRitmo=ser.reduce((a,x)=>a+x.ritmo,0);
  const rot=d.meses.slice(-6).map(m=>MES[+m.mes.slice(5)-1]);
  const ratio=`${dia} de ${dm} dias`;
  el.innerHTML=`<div class="g">
  <div class="card s12" id="u-part"><h3>Participação em ${nomeMes}</h3><p class="hint">${parcial?`Até dia ${dia}`:'Mês fechado'} · ${R(tot)} no grupo${totAnt?` · ritmo pra ${R0(totRitmo)} (${MESN[+d.meses[iAnt].mes.slice(5)-1]}: ${R0(totAnt)})`:''}</p>
   <div class="partbar">${ser.map(x=>`<div style="flex:${Math.max(x.atual,1)};background:var(${x.cor})" title="${esc(nome(x.s))}"></div>`).join('')}</div>
   <div class="legenda">${ser.map(x=>`<span><i class="bol" style="background:var(${x.cor})"></i>${esc(nome(x.s))} · ${tot?(100*x.atual/tot).toFixed(0):0}%</span>`).join('')}</div></div>
  <div class="s12 compare">${ser.map(x=>{const dl=x.delta;return `<div class="card"><div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap"><h3>${esc(nome(x.s))}</h3>${dl==null?'':`<span class="pill ${dl<-10?'p-bad':dl<0?'p-warn':'p-ok'}">${dl>0?'+':''}${dl.toFixed(0)}% no ritmo</span>`}</div>
    <div class="kpi" style="margin-top:6px"><div class="k-l">${nomeMes} ${parcial?'até dia '+dia:''}</div><div class="k-v">${R0(x.atual)}</div><div class="k-s">${parcial?`ritmo pra ${R0(x.ritmo)} · `:''}${x.ant?`${MESN[+d.meses[iAnt].mes.slice(5)-1]} ${R0(x.ant)}`:'sem mês anterior'}</div></div>
    <div style="margin-top:10px">${spark(x.hist,x.cor)}</div><div class="legenda" style="justify-content:space-between;margin:2px 0 0">${rot.map(m=>`<span>${m}</span>`).join('')}</div>
    ${x.ped!=null?`<div class="k-s" style="margin-top:8px">${N(x.ped)} pedidos · ticket ${R(x.ticket)}</div>`:''}</div>`}).join('')}</div>
  <div class="card s12" id="u-leitura"></div>
  <div class="card s12"><h3>Mês a mês</h3><p class="hint">Faturamento por marca e unidade. * meses do histórico do grupo (o GC é o restante depois de descontar Sobradinho e Chomp).</p><div class="tw"><table><thead><tr><th>Mês</th>${ser.map(x=>`<th class="r">${esc(nome(x.s))}</th>`).join('')}<th class="r">Total</th></tr></thead><tbody>${d.meses.map((m,i)=>`<tr><td>${MES[+m.mes.slice(5)-1]}/${m.mes.slice(2,4)}${m.parcial?` (até ${dia})`:''}${m.historico?' *':''}</td>${ser.map(x=>`<td class="r">${R0(x.s.faturamento[i])}</td>`).join('')}<td class="r"><strong>${R0(ser.reduce((a,x)=>a+x.s.faturamento[i],0))}</strong></td></tr>`).reverse().join('')}</tbody></table></div></div>
  <p class="hint s12" style="margin:0"><span class="dot" style="display:inline-block;margin-right:6px"></span>Atualizado às ${new Date().toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})} · mesma base da tela Vendas (/api/faturamento_mensal)</p></div>`;
  // leitura automática: maior queda e maior alta no ritmo
  const comD=ser.filter(x=>x.delta!=null).sort((a,b)=>a.delta-b.delta);
  const lt=document.getElementById('u-leitura');
  if(comD.length&&parcial){const pior=comD[0],melhor=comD[comD.length-1];
    lt.innerHTML=`<h3>Leitura do período</h3><p style="margin:6px 0 0;font-size:13.5px">${pior.delta<0?`<b>${esc(nome(pior.s))}</b> está ${Math.abs(pior.delta).toFixed(0)}% abaixo do mês passado no ritmo (${R0(pior.ritmo)} projetados contra ${R0(pior.ant)}).`:'Nenhuma operação abaixo do mês passado no ritmo.'} ${melhor!==pior&&melhor.delta>0?`<b>${esc(nome(melhor.s))}</b> vai ${melhor.delta.toFixed(0)}% acima.`:''} Cálculo simples: o faturamento até dia ${dia} dividido pelos dias passados e multiplicado pelos ${dm} dias do mês (${ratio}).</p>`}
  else lt.hidden=true;
}
async function carregar(){
  if(!ativoAgora()&&!el)return;
  try{pintar(await fetch('/api/faturamento_mensal?meses=12').then(r=>r.json()))}
  catch(e){el.innerHTML='<div class="card"><h3>Não foi possível carregar</h3><p class="hint">Tente de novo em instantes.</p></div>'}
}
window.V2.screens.unidades={render(c){el=c;el.innerHTML='<div class="card"><p class="hint" style="margin:0">Carregando…</p></div>';window.V2.setJump([]);carregar();clearInterval(timer);timer=setInterval(()=>{if(ativoAgora())carregar();else clearInterval(timer)},10*60*1000)},onFiltros(){}};
})();
