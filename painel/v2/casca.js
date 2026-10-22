const I={geral:'<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',hoje:'<path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/><path d="M10 20v-6h4v6"/>',vendas:'<path d="M4 20V10"/><path d="M10 20V4"/><path d="M16 20v-7"/><path d="M22 20H2"/>',resultado:'<path d="M4 4h16v16H4z"/><path d="M8 9h8M8 13h8M8 17h5"/>',ze:'<path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z"/><path d="M9 11h.01M12 11h.01M15 11h.01"/>',clientes:'<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7"/><path d="M18 14.5a6.5 6.5 0 0 1 3.5 5.5"/>',cardapio:'<path d="M4 10h16"/><path d="M5 10a7 5 0 0 1 14 0"/><path d="M4 14h16"/><path d="M5 17h14a1 1 0 0 1-1 2H6a1 1 0 0 1-1-2z"/>',bairros:'<path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>',operacao:'<circle cx="12" cy="13" r="8"/><path d="M12 9v4l3 2"/><path d="M9 2h6"/>',unidades:'<path d="M3 21V9l6-4 6 4v12"/><path d="M15 21V12l6 3v6"/><path d="M7 13h4M7 17h4"/>',equipe:'<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 8l1.5 1.5L12 7"/><path d="M14 8h3M8 14l1.5 1.5L12 13"/><path d="M14 14h3"/>',compras:'<path d="M3 4h2l2.4 11.2a2 2 0 0 0 2 1.6h7.7a2 2 0 0 0 2-1.5L21 8H6"/><circle cx="10" cy="20" r="1"/><circle cx="17" cy="20" r="1"/>',nota:'<path d="M6 3h12v18l-3-2-3 2-3-2-3 2z"/><path d="M9 8h6M9 12h6"/>',proposta:'<path d="M6 3h9l4 4v14H6z"/><path d="M14 3v5h5"/><path d="M9 13h7M9 17h5"/>',mais:'<circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/>'};
/* Painel Maracayá 2.0 — casca: navegação, tema, perfil e filtros.
   As telas entram em SCREENS[chave] = {render(el), onFiltros()} uma de cada vez. */
(function(){
const S={
  hoje:{t:'Hoje',grp:'Dia a dia',roles:['socio','gerente','cozinha'],v1:'/'},
  geral:{t:'Visão geral',grp:'Dia a dia',roles:['socio'],nw:1},
  ze:{t:'Pergunte para MIA',grp:'Dia a dia',roles:['socio','gerente'],nw:1},
  vendas:{t:'Vendas',grp:'Dinheiro',roles:['socio'],v1:'/'},
  resultado:{t:'Resultado (DRE)',grp:'Dinheiro',roles:['socio'],v1:'/dre'},
  unidades:{t:'Comparar unidades',grp:'Dinheiro',roles:['socio'],nw:1},
  clientes:{t:'Clientes',grp:'Clientes e cardápio',roles:['socio','gerente'],v1:'/clientes'},
  cardapio:{t:'Cardápio',grp:'Clientes e cardápio',roles:['socio'],v1:'/cardapio'},
  bairros:{t:'Bairros',grp:'Clientes e cardápio',roles:['socio','gerente'],v1:'/bairros'},
  operacao:{t:'Operação',grp:'Cozinha e estoque',roles:['socio','gerente'],v1:'/operacao'},
  compras:{t:'Compras e estoque',grp:'Cozinha e estoque',roles:['socio','gerente','cozinha'],v1:'/compras'},
  nota:{t:'Lançar nota',grp:'Cozinha e estoque',roles:['socio','gerente','cozinha'],v1:'/lancar-nota'}
};
const SUBS={hoje:'Resumo do dia',geral:'Resumo por unidade e marca',ze:'Assistente com os números do painel (a mesma MIA do grupo)',vendas:'Faturamento, canais e crescimento',resultado:'Antigas Performance + DRE',unidades:'Colorado e Sobradinho lado a lado',clientes:'Base, fidelização e retenção',cardapio:'Custos, margem e itens encalhados',bairros:'De onde vêm os pedidos',operacao:'Tempo de preparo e entrega',compras:'Estoque, sugestão de compra e fornecedores',nota:'Notas de fornecedor do mês'};
const BOTTOM={socio:['hoje','vendas','ze','clientes','mais'],gerente:['hoje','operacao','ze','compras','mais'],cozinha:['hoje','compras','nota','mais']};
const SEM_PERIODO=['clientes'];
const FILTRO=['geral','vendas','resultado','clientes','cardapio','bairros','operacao'];
const ROLES=[['socio','Sócio'],['gerente','Gerente'],['cozinha','Cozinha']];
const TEMAS=[['auto','Auto'],['light','Claro'],['dark','Escuro']];
const PERIODOS=[['1','Hoje'],['ontem','Ontem'],['7','7 dias'],['30','30 dias'],['90','90 dias'],['semana_atual','Semana'],['mes_atual','Este mês'],['mes_passado','Mês passado'],['custom','Personalizado…']];

const saudacao=()=>{const h=new Date().getHours();return h<12?'Bom dia':h<18?'Boa tarde':'Boa noite'};
const lsGet=(k,d)=>{try{return localStorage.getItem(k)||d}catch(_){return d}};
const lsSet=(k,v)=>{try{localStorage.setItem(k,v)}catch(_){}};
const svg=k=>`<svg viewBox="0 0 24 24" aria-hidden="true">${I[k]||''}</svg>`;

let perfil='socio',role='socio';   // perfil = quem logou (vem do servidor); role = tela exibida (sócio pode "ver como")
let tema=lsGet('m2-tema','auto');
let screen='hoje', sheetOpen=false;
const filtros={unidade:lsGet('m2-un','todas'),marca:lsGet('m2-mc','todas'),periodo:lsGet('m2-per','30'),ini:lsGet('m2-ini',''),fim:lsGet('m2-fim','')};
let unidades=[], marcas=[];

/* API pública pra as telas: leem os filtros e reagem a mudanças */
const iso=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
/* período escolhido -> {dias, ini, fim}; ini/fim só nos períodos de calendário */
const custom=()=>filtros.periodo==='custom'&&filtros.ini&&filtros.fim;
function intervalo(){const p=filtros.periodo,h=new Date();
  if(custom())return{dias:Math.round((new Date(filtros.fim+'T12:00:00')-new Date(filtros.ini+'T12:00:00'))/864e5)+1,ini:filtros.ini,fim:filtros.fim};
  if(p==='custom')return{dias:30};
  if(/^\d+$/.test(p))return{dias:+p};
  let a,b;
  if(p==='ontem'){a=b=new Date(h.getFullYear(),h.getMonth(),h.getDate()-1)}
  else if(p==='semana_atual'){a=new Date(h.getFullYear(),h.getMonth(),h.getDate()-((h.getDay()+6)%7));b=h}
  else if(p==='mes_atual'){a=new Date(h.getFullYear(),h.getMonth(),1);b=h}
  else{a=new Date(h.getFullYear(),h.getMonth()-1,1);b=new Date(h.getFullYear(),h.getMonth(),0)}
  return{dias:Math.round((b-a)/864e5)+1,ini:iso(a),fim:iso(b)}}
const dm=iso=>iso.slice(8,10)+'/'+iso.slice(5,7);
window.V2={filtros,screens:{},intervalo,role:()=>role,
  /* período no formato das APIs de DRE/operação: hoje, ontem, semana_atual, mes_atual, mes_passado, N dias ou AAAA-MM-DD..AAAA-MM-DD */
  periodoApi(){const p=filtros.periodo;if(p==='custom')return custom()?filtros.ini+'..'+filtros.fim:'30';return p==='1'?'hoje':p},
  periodoLabel(){if(custom())return filtros.ini===filtros.fim?dm(filtros.ini):dm(filtros.ini)+' a '+dm(filtros.fim);const f=PERIODOS.find(x=>x[0]===filtros.periodo);return f?f[1]:'período'},
  qs(extra){const iv=intervalo(),p=new URLSearchParams({unidade:filtros.unidade,marca:filtros.marca,dias:iv.dias});
    if(iv.ini){p.set('inicio',iv.ini);p.set('fim',iv.fim)}
    Object.entries(extra||{}).forEach(([k,v])=>p.set(k,v));return p.toString()},
  setJump(list){const jn=document.getElementById('jump');jn.innerHTML=list.map(x=>`<a href="#${screen}" data-jump="${x[0]}">${x[1]}</a>`).join('');jn.hidden=!list.length},
  toast};

function aplicarTema(){const r=document.documentElement;if(tema==='auto')r.removeAttribute('data-theme');else r.setAttribute('data-theme',tema);
  window.dispatchEvent(new Event('v2tema'));
  const m=document.querySelector('meta[name=theme-color]');if(m)m.content=(tema==='dark'||(tema==='auto'&&matchMedia('(prefers-color-scheme: dark)').matches))?'#0E0C0B':'#1E1B18'}
function segs(){document.querySelectorAll('[data-seg-tema]').forEach(el=>el.innerHTML=TEMAS.map(([v,l])=>`<button data-tema="${v}" aria-pressed="${tema===v}">${l}</button>`).join(''));
  document.querySelectorAll('.ver-como').forEach(el=>el.hidden=perfil!=='socio');
  document.querySelectorAll('[data-seg-role]').forEach(el=>el.innerHTML=perfil!=='socio'?'':ROLES.map(([v,l])=>`<button data-role="${v}" aria-pressed="${role===v}">${l}</button>`).join(''))}

function perHtml(){return `<select id="f-per" aria-label="Período">${PERIODOS.map(([v,l])=>`<option value="${v}"${v===filtros.periodo?' selected':''}>${l}</option>`).join('')}</select>`+(filtros.periodo==='custom'?`<span class="f-datas"><input type="date" id="f-de" value="${filtros.ini}" aria-label="De"><span class="mut">→</span><input type="date" id="f-ate" value="${filtros.fim}" aria-label="Até"></span>`:'')}
function filtrosHtml(){
  if(screen==='geral')return perHtml();
  const o=(arr,sel,todas)=>`<option value="todas"${sel==='todas'?' selected':''}>${todas}</option>`+arr.map(x=>`<option value="${x}"${x===sel?' selected':''}>${x}</option>`).join('');
  return `<select id="f-un" aria-label="Unidade">${o(unidades,filtros.unidade,'Todas as unidades')}</select>
  <select id="f-mc" aria-label="Marca">${o(marcas,filtros.marca,'Todas as marcas')}</select>
  ${SEM_PERIODO.includes(screen)?'':perHtml()}`}

function soon(k){const s=S[k];
  return `<div class="card soon"><h3>${s.t} <span class="ex">em construção</span></h3>
  <p>${s.v1?'Esta tela da 2.0 ainda está sendo construída. Enquanto isso, tudo continua disponível na versão atual.':'Tela nova da 2.0, ainda não construída.'}</p>
  ${s.v1?`<a class="btn brasa" href="${s.v1}">Abrir na versão atual</a> `:''}<a class="btn ghost" href="/v2/prototipo#${k}" target="_blank" rel="noopener">Ver no protótipo</a></div>`}

function render(){
  if(!S[screen]||!S[screen].roles.includes(role))screen='hoje';
  let html='',grp='';
  Object.entries(S).forEach(([k,s])=>{if(!s.roles.includes(role))return;if(s.grp!==grp){grp=s.grp;html+=`<div class="navgrp">${grp}</div>`}
    html+=`<a href="#${k}" data-go="${k}" ${k===screen?'aria-current="page"':''}>${svg(k)}${s.t}${s.nw?'<span class="tag-new">NOVO</span>':''}</a>`});
  document.getElementById('nav').innerHTML=html;
  document.getElementById('bnav').style.gridTemplateColumns=`repeat(${BOTTOM[role].length},1fr)`;
  document.getElementById('bnav').innerHTML=BOTTOM[role].map(k=>{const lab=k==='mais'?'Mais':k==='ze'?'MIA':S[k].t.split(' ')[0];const cur=(k===screen||(k==='mais'&&sheetOpen))?'aria-current="page"':'';
    return k==='ze'?`<a href="#ze" data-go="ze" class="ze-btn" ${cur}><span class="z">${svg('ze')}</span>${lab}</a>`:`<a href="#${k}" data-go="${k}" ${cur}>${svg(k)}${lab}</a>`}).join('');
  document.getElementById('ttl').textContent=screen==='hoje'?({socio:saudacao()+', Álvaro',gerente:'Turno de hoje',cozinha:'Cozinha'})[role]:S[screen].t;
  document.getElementById('sub').textContent=SUBS[screen]||'';
  const ba=document.getElementById('btnApresentar');if(ba)ba.hidden=perfil!=='socio';
  document.title=S[screen].t+' · Painel Maracayá 2.0';
  document.getElementById('filters').innerHTML=(FILTRO.includes(screen)||(screen==='hoje'&&role==='gerente'))?filtrosHtml():'';
  const jn=document.getElementById('jump');jn.innerHTML='';jn.hidden=true;
  const el=document.getElementById('content'),impl=window.V2.screens[screen];
  if(impl)impl.render(el);else el.innerHTML=soon(screen);
  const old=document.querySelector('.sheet');if(old)old.remove();
  if(sheetOpen){const used=BOTTOM[role];const rest=Object.keys(S).filter(k=>S[k].roles.includes(role)&&!used.includes(k));
    const sh=document.createElement('div');sh.className='sheet';
    sh.innerHTML=`<div class="lbl" style="margin-bottom:10px">Mais telas</div><div class="grid3">${rest.map(k=>`<a href="#${k}" data-go="${k}">${svg(k)}${S[k].t}</a>`).join('')}</div>
      <div class="lbl" style="margin-top:14px">Tema</div><div class="seg" data-seg-tema></div>
      <div class="ver-como"><div class="lbl" style="margin-top:12px">Ver como</div><div class="seg" data-seg-role></div></div>
      <button class="btn ghost" data-sair style="margin-top:14px;width:100%">Sair</button>`;
    document.getElementById('app').appendChild(sh)}
  segs();
  document.getElementById('main').scrollTop=0;
}

function toast(t){const o=document.querySelector('.toast');if(o)o.remove();const el=document.createElement('div');el.className='toast';el.textContent=t;document.body.appendChild(el);setTimeout(()=>el.remove(),2800)}

function irPara(k){screen=k;sheetOpen=false;try{history.replaceState(null,'','#'+k)}catch(_){}render()}

document.addEventListener('click',e=>{
  const jp=e.target.closest('[data-jump]');if(jp){e.preventDefault();const t=document.getElementById(jp.dataset.jump);if(t)t.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'start'});return}
  const go=e.target.closest('[data-go]');
  if(go){e.preventDefault();const k=go.dataset.go;if(k==='mais'){sheetOpen=!sheetOpen;render()}else irPara(k);return}
  if(e.target.closest('[data-apresentar]')){if(window.V2.apresentar)window.V2.apresentar();return}
  if(e.target.closest('[data-sair]')){fetch('/api/logout',{method:'POST'}).finally(()=>{location.href='/login'});return}
  const t=e.target.closest('[data-tema]');if(t){tema=t.dataset.tema;lsSet('m2-tema',tema);aplicarTema();segs();return}
  const r=e.target.closest('[data-role]');if(r){role=r.dataset.role;lsSet('m2-role',role);screen='hoje';sheetOpen=false;try{history.replaceState(null,'','#hoje')}catch(_){}render();return}
  if(sheetOpen&&!e.target.closest('.sheet')){sheetOpen=false;render()}
});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&sheetOpen){sheetOpen=false;render()}});
document.addEventListener('change',e=>{
  const id=e.target.id,impl=()=>window.V2.screens[screen],avisar=()=>{const i=impl();if(i&&i.onFiltros)i.onFiltros()},barra=()=>{const f=document.getElementById('filters');if(f)f.innerHTML=filtrosHtml()};
  if(id==='f-de'||id==='f-ate'){
    let de=document.getElementById('f-de').value,ate=document.getElementById('f-ate').value;
    if(de&&!ate)ate=iso(new Date());if(ate&&!de)de=ate;if(!de||!ate)return;if(de>ate)[de,ate]=[ate,de];
    filtros.ini=de;filtros.fim=ate;lsSet('m2-ini',de);lsSet('m2-fim',ate);barra();avisar();return}
  if(id==='f-per'&&e.target.value==='custom'&&!(filtros.ini&&filtros.fim)){const h=new Date(),a=new Date(h.getFullYear(),h.getMonth(),h.getDate()-6);filtros.ini=iso(a);filtros.fim=iso(h);lsSet('m2-ini',filtros.ini);lsSet('m2-fim',filtros.fim)}
  const m={'f-un':['unidade','m2-un'],'f-mc':['marca','m2-mc'],'f-per':['periodo','m2-per']}[id];
  if(!m)return;filtros[m[0]]=e.target.value;lsSet(m[1],e.target.value);
  if(id==='f-per')barra();
  avisar();
});
window.addEventListener('hashchange',()=>{const h=location.hash.slice(1);if(S[h]&&h!==screen){screen=h;sheetOpen=false;render()}});
matchMedia('(prefers-color-scheme: dark)').addEventListener('change',aplicarTema);

aplicarTema();
{const h=location.hash.slice(1);if(S[h])screen=h}
/* quem está logado define o perfil; sem login, vai pra tela de entrada */
function iniciar(){
  segs();
  /* as telas (compras.js etc.) carregam depois: desenha só quando todas registraram */
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',render);else render();
  /* filtros vêm da API: unidades e marcas reais */
  Promise.all([
    fetch('/api/unidades').then(r=>r.json()).catch(()=>({})),
    fetch('/api/marcas').then(r=>r.json()).catch(()=>({}))
  ]).then(([u,d])=>{
    unidades=u.unidades||[]; marcas=d.marcas||[];
    if(filtros.unidade!=='todas'&&!unidades.includes(filtros.unidade))filtros.unidade='todas';
    if(filtros.marca!=='todas'&&!marcas.includes(filtros.marca))filtros.marca='todas';
    const f=document.getElementById('filters');if(f.innerHTML)f.innerHTML=filtrosHtml();
    document.getElementById('sync').textContent=unidades.length?`Conectado · ${unidades.length} unidades`:'Sem conexão com a API';
  });
}
fetch('/api/eu').then(r=>{if(r.status===401){location.href='/login?next='+encodeURIComponent(location.pathname+location.hash);throw 0}return r.json()}).then(d=>{
  perfil=d.perfil||'socio';
  if(perfil!=='socio'&&!lsGet('m2-per',''))filtros.periodo='1';
  role=perfil==='socio'?lsGet('m2-role','socio'):perfil;
  if(!ROLES.some(r=>r[0]===role))role='socio';
  iniciar();
}).catch(e=>{if(e!==0)document.getElementById('sync').textContent='Sem conexão com a API'});
})();
