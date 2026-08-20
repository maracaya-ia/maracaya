// Componente compartilhado: sidebar + tema claro/escuro
(function(){
  const PAGINAS = [
    {href:'/',           nome:'Visão geral', icone:'📊'},
    {href:'/clientes',   nome:'Clientes',    icone:'👥'},
    {href:'/operacao',   nome:'Operação',    icone:'⏱️'},
    {href:'/cardapio',   nome:'Cardápio',    icone:'🍔'},
    {href:'/bairros',    nome:'Bairros',     icone:'🗺️'},
    {href:'/dre',        nome:'DRE',         icone:'💰'},
    {href:'/compras',    nome:'Compras',     icone:'🛒'},
    {href:'/lancar-nota',nome:'Lançar Nota', icone:'🧾'},
  ];
  const path = location.pathname.replace(/\/$/,'') || '/';

  // ---- tema ----
  const temaSalvo = localStorage.getItem('tema') || 'escuro';
  document.documentElement.setAttribute('data-tema', temaSalvo);

  // ---- sidebar ----
  const aside = document.createElement('aside');
  aside.className = 'sidebar';
  aside.innerHTML =
    '<div class="sb-logo"><img src="/static/logo-clara.png" class="logo-clara" alt="Maracayá"><img src="/static/logo-escura.png" class="logo-escura" alt="Maracayá"></div>' +
    '<nav class="sb-nav">' +
    PAGINAS.map(p => {
      const ativo = (p.href === '/' ? path === '/' : path === p.href) ? ' ativo' : '';
      return `<a href="${p.href}" class="sb-item${ativo}"><span class="sb-ico">${p.icone}</span><span class="sb-txt">${p.nome}</span></a>`;
    }).join('') +
    '</nav>' +
    '<button class="sb-tema" id="btnTema"></button>';
  document.body.insertBefore(aside, document.body.firstChild);

  function pintarBotao(){
    const t = document.documentElement.getAttribute('data-tema');
    document.getElementById('btnTema').innerHTML = t === 'escuro'
      ? '<span class="sb-ico">☀️</span><span class="sb-txt">Modo claro</span>'
      : '<span class="sb-ico">🌙</span><span class="sb-txt">Modo escuro</span>';
  }
  pintarBotao();
  document.getElementById('btnTema').addEventListener('click', () => {
    const atual = document.documentElement.getAttribute('data-tema');
    const novo = atual === 'escuro' ? 'claro' : 'escuro';
    document.documentElement.setAttribute('data-tema', novo);
    localStorage.setItem('tema', novo);
    pintarBotao();
  });

  // botão de recolher no mobile
  const toggle = document.createElement('button');
  toggle.className = 'sb-toggle';
  toggle.innerHTML = '☰';
  toggle.addEventListener('click', () => document.body.classList.toggle('sb-aberta'));
  document.body.insertBefore(toggle, document.body.firstChild);
})();
