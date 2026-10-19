/* ============================================================
   Goodreads Redesign — comportamento compartilhado
   header, cards, carrosséis, filtros globais, quick-view, toast
   ============================================================ */

const fmtCount = n => n >= 1e6 ? (n / 1e6).toFixed(1).replace('.0', '') + 'M' : n >= 1e3 ? Math.round(n / 1e3) + 'K' : String(n);
const fmtNum = n => n.toLocaleString('en-US');
const money = v => '$' + v.toFixed(2);
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function starsHTML(b, withCount = true) {
  const full = Math.round(b.rating);
  const s = '★'.repeat(full) + '☆'.repeat(5 - full);
  return `<span class="stars" aria-label="${b.rating} out of 5, ${fmtNum(b.ratings)} ratings"><span aria-hidden="true">${s}</span><span class="num">${b.rating.toFixed(2)}</span>${withCount ? `<span class="count">(${fmtCount(b.ratings)})</span>` : ''}</span>`;
}

function minPrice(b) { return Math.min(...Object.values(b.price)); }

/* ---------- Header / footer ---------- */
function renderChrome(active) {
  const header = document.getElementById('site-header');
  const cur = k => active === k ? ' class="active" aria-current="page"' : '';
  if (header) header.innerHTML = `
    <a class="skip-link" href="#main">Skip to main content</a>
    <div class="promo-bar"><b>Readers' Favorite Books 2025</b> &nbsp;·&nbsp; the Choice Awards winners are in &nbsp;<a href="lists.html?list=choice-2025">See the winners ›</a></div>
    <header class="site-header">
      <div class="container">
        <a class="logo" href="index.html" aria-label="Goodreads home">goodreads</a>
        <form class="header-search" role="search" action="search.html" method="get">
          <label class="sr-only" for="hs">Search books</label>
          <input id="hs" name="q" type="search" placeholder="Search books, authors, lists" autocomplete="off">
          <span class="kbd" aria-hidden="true">/</span>
          <button class="search-btn" type="submit" aria-label="Search">&#9906;</button>
        </form>
        <nav class="header-nav" aria-label="Main">
          <div class="nav-links">
            <a href="index.html"${cur('home')}>Home</a>
            <a href="lists.html"${cur('lists')}>Lists</a>
            <a href="search.html"${cur('search')}>Search</a>
            <a href="#" class="caret">Community</a>
          </div>
          <a class="btn btn-outline btn-sm" href="#">Sign In</a>
          <a class="btn btn-primary btn-sm" href="#">Join</a>
        </nav>
      </div>
    </header>`;

  const footer = document.getElementById('site-footer');
  if (footer) footer.innerHTML = `
    <footer class="site-footer">
      <div class="container">
        <div><h4>Company</h4><a href="#">About us</a><a href="#">Careers</a><a href="#">Terms</a><a href="#">Privacy</a><a href="#">Help</a></div>
        <div><h4>Work with us</h4><a href="#">Authors</a><a href="#">Advertise</a><a href="#">Authors &amp; ads blog</a></div>
        <div><h4>Connect</h4><div class="socials"><span>f</span><span>X</span><span>ig</span><span>in</span></div></div>
        <div><div class="store"><span>App Store</span><span>Google Play</span></div><div class="copy">© 2026 Goodreads, Inc. — redesign prototype (academic)</div></div>
      </div>
    </footer>`;

  // Atalho "/" foca a busca (heurística #20 — H7 flexibilidade e eficiência)
  document.addEventListener('keydown', e => {
    if (e.key === '/' && !/input|textarea|select/i.test(document.activeElement.tagName)) {
      e.preventDefault();
      const el = document.getElementById('big-search') || document.getElementById('hs');
      el && el.focus();
    }
  });
}

/* ---------- Card de livro ---------- */
function coverHTML(b) {
  return `<img src="${b.cover}" alt="" loading="lazy" onerror="this.replaceWith(Object.assign(document.createElement('div'),{className:'cover-fallback',textContent:'${esc(b.title).replace(/'/g, "\\'")}'}))">`;
}

function bookCard(b, opts = {}) {
  const rank = opts.rank ? `<span class="rank" aria-hidden="true">${opts.rank}</span>` : '';
  const badge = b.award && opts.showAward ? `<span class="badge">Winner</span>` : '';
  return `
  <article class="book-card ${opts.rank ? 'ranked' : ''}" data-id="${b.id}" tabindex="0" aria-label="${esc(b.title)} by ${esc(b.author)}">
    <div class="cover-wrap">
      ${coverHTML(b)}${badge}${rank}
      <div class="hover-actions">
        <button class="btn btn-buy" data-action="buy" data-id="${b.id}">Buy ${money(minPrice(b))}</button>
        <button class="btn btn-outline btn-icon" data-action="want" data-id="${b.id}" aria-label="Want to read" title="Want to Read">+</button>
      </div>
    </div>
    <div class="meta">
      <div class="title">${opts.rank ? '' : ''}${esc(b.title)}</div>
      <div class="author">${esc(b.author)}</div>
      ${starsHTML(b)}
      <div class="price-line"><span class="genre">${esc(b.genre)}</span><span class="price">from ${money(minPrice(b))}</span></div>
    </div>
  </article>`;
}

/* Delegação global: clique em card / botões */
document.addEventListener('click', e => {
  const act = e.target.closest('[data-action]');
  if (act) {
    e.stopPropagation();
    const b = BOOK_BY_ID[act.dataset.id];
    if (act.dataset.action === 'buy') { openQuickView(b, true); return; }
    if (act.dataset.action === 'want') { toast(`"${b.title}" added to Want to Read`); return; }
    if (act.dataset.action === 'open') { openQuickView(b); return; }
  }
  const card = e.target.closest('.book-card');
  if (card && !e.target.closest('a')) openQuickView(BOOK_BY_ID[card.dataset.id]);
});
document.addEventListener('keydown', e => {
  if (e.key === 'Enter' && e.target.classList && e.target.classList.contains('book-card')) openQuickView(BOOK_BY_ID[e.target.dataset.id]);
});

/* ---------- Carrossel ---------- */
function renderRow(container, { title, sub, books, label, rank = false, seeAll, showAward = false }) {
  if (!books || books.length < 4) return; // nunca exibir listas vazias ou com poucos itens
  const id = 'row-' + Math.random().toString(36).slice(2, 7);
  container.insertAdjacentHTML('beforeend', `
  <section class="row" id="${id}">
    <div class="container">
      ${label ? `<span class="section-label ${label === 'community' ? 'community' : ''}">${label === 'community' ? 'From the community' : 'Editorial'}</span>` : ''}
      <div class="row-head"><h2>${esc(title)}</h2>${sub ? `<span class="row-sub">${esc(sub)}</span>` : ''}${seeAll ? `<a class="see-all" href="${seeAll}">See all ›</a>` : ''}</div>
      <div class="row-track-wrap">
        <button class="row-arrow l" aria-label="Scroll left">‹</button>
        <div class="row-track">${books.length ? books.map((b, i) => bookCard(b, { rank: rank ? i + 1 : 0, showAward })).join('') : '<div class="row-empty">No books match the current filters in this list.</div>'}</div>
        <button class="row-arrow r" aria-label="Scroll right">›</button>
      </div>
    </div>
  </section>`);
  const sec = document.getElementById(id);
  const track = sec.querySelector('.row-track');
  sec.querySelector('.row-arrow.l').onclick = () => track.scrollBy({ left: -track.clientWidth * .8, behavior: 'smooth' });
  sec.querySelector('.row-arrow.r').onclick = () => track.scrollBy({ left: track.clientWidth * .8, behavior: 'smooth' });
}

/* ---------- Filtros globais (Home) ---------- */
const FILTER_STATE = { genre: '', period: 'week', format: '', rating: 0, lang: '' };

function applyFilters(books) {
  const f = FILTER_STATE;
  const order = { week: 0, month: 1, year: 2, all: 3 };
  return books.filter(b =>
    (!f.genre || b.genre === f.genre) &&
    (!f.format || b.formats.includes(f.format)) &&
    (!f.rating || b.rating >= f.rating) &&
    (!f.lang || b.lang === f.lang) &&
    (f.period === 'all' || order[b.trend] <= order[f.period] || b.trend === 'all' && f.period === 'all')
  );
}
function periodMatch(b) {
  // "This week" mostra só o que está em alta na semana; "All time" mostra tudo.
  const order = { week: 0, month: 1, year: 2, all: 3 };
  return order[b.trend] <= order[FILTER_STATE.period];
}

/* ---------- Quick view ---------- */
let qvEl, qvBackdrop, lastFocus;
function ensureQuickView() {
  if (qvEl) return;
  document.body.insertAdjacentHTML('beforeend', `
    <div class="qv-backdrop" id="qv-backdrop"></div>
    <aside class="qv" id="qv" role="dialog" aria-modal="true" aria-labelledby="qv-title" aria-hidden="true" inert>
      <button class="qv-close" id="qv-close" aria-label="Close (Esc)">×</button>
      <div class="qv-body" id="qv-body"></div>
    </aside>
    <div class="toast" id="toast" role="status" aria-live="polite"></div>`);
  qvEl = document.getElementById('qv'); qvBackdrop = document.getElementById('qv-backdrop');
  // Heurística #1 (H3): fecha por X, ESC e clique fora
  document.getElementById('qv-close').onclick = closeQuickView;
  qvBackdrop.onclick = closeQuickView;
  document.addEventListener('keydown', e => {
    if (!qvEl.classList.contains('open')) return;
    if (e.key === 'Escape') { closeQuickView(); return; }
    if (e.key === 'Tab') {   // mantém o foco dentro do drawer enquanto aberto
      const f = [...qvEl.querySelectorAll('a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])')].filter(el => el.offsetParent !== null);
      if (!f.length) return;
      const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });
}

function openQuickView(b, focusBuy = false) {
  if (!b) return;
  ensureQuickView();
  if (!qvEl.classList.contains('open')) lastFocus = document.activeElement;
  const seriesBooks = b.series ? BOOKS.filter(x => x.series === b.series).sort((x, y) => x.volume - y.volume) : [];
  const also = BOOKS.filter(x => x.genre === b.genre && x.id !== b.id).slice(0, 8);
  const formats = b.formats.map((f, i) => `
    <label class="format ${i === 0 ? 'on' : ''}">
      <input type="radio" name="fmt" value="${f}" ${i === 0 ? 'checked' : ''}>
      <span><span class="f-name">${f}</span><br><span class="f-note">${{ Kindle: 'Instant delivery · read on any device', Paperback: 'Free delivery over $35 · ships in 2 days', Hardcover: 'Ships in 2 days', Audiobook: 'Narrated · 1 credit or buy outright' }[f]}</span></span>
      <span class="f-price">${money(b.price[f])}</span>
    </label>`).join('');

  document.getElementById('qv-body').innerHTML = `
    <div class="qv-top">
      ${coverHTML(b)}
      <div>
        ${b.series ? `<div class="qv-series">${esc(b.series)} ${b.volume ? '#' + b.volume : ''}</div>` : ''}
        <h2 id="qv-title">${esc(b.title)}</h2>
        <div class="qv-author">${esc(b.author)}</div>
        ${starsHTML(b)}
        <div class="qv-facts">${b.pages} pages · ${b.lang} · First published ${b.year < 0 ? Math.abs(b.year) + ' BC' : b.year}</div>
        <div class="qv-chips"><span class="chip">${esc(b.genre)}</span>${b.award ? `<span class="chip award">★ Choice Award 2025 · ${esc(b.award)}</span>` : ''}</div>
      </div>
    </div>
    <p class="qv-blurb"${b.textLang ? ` lang="${b.textLang}"` : ''}>${esc(b.blurb || 'No description available for this edition yet.')}${b.detail ? ` <a href="book.html?id=${b.id}">See the full book page ›</a>` : ''}</p>
    <h3>Choose a format</h3>
    <div class="formats" id="qv-formats">${formats}</div>
    <p class="qv-facts" style="margin-top:8px">Prices include tax. Kindle Unlimited members read this title at no extra cost (requires an active subscription).</p>
    <div class="qv-cta">
      <button class="btn btn-buy btn-lg" id="qv-buy">Buy now · ${money(b.price[b.formats[0]])}</button>
      <button class="btn btn-outline btn-lg" id="qv-want">Want to Read</button>
    </div>
    ${seriesBooks.length > 1 ? `<h3>Shop the series (${seriesBooks.length} books, in reading order)</h3><div class="qv-also">${seriesBooks.map(s => `<button type="button" class="thumb" data-action="open" data-id="${s.id}" aria-label="#${s.volume} ${esc(s.title)}" title="#${s.volume} ${esc(s.title)}"><img src="${s.cover}" alt=""></button>`).join('')}</div>` : ''}
    <h3>Readers also bought</h3>
    <div class="qv-also">${also.map(s => `<button type="button" class="thumb" data-action="open" data-id="${s.id}" aria-label="${esc(s.title)}" title="${esc(s.title)}"><img src="${s.cover}" alt=""></button>`).join('')}</div>`;

  const buyBtn = document.getElementById('qv-buy');
  document.querySelectorAll('#qv-formats input').forEach(r => r.addEventListener('change', () => {
    document.querySelectorAll('#qv-formats .format').forEach(l => l.classList.toggle('on', l.querySelector('input').checked));
    buyBtn.textContent = `Buy now · ${money(b.price[r.value])}`;
  }));
  buyBtn.onclick = () => { const f = document.querySelector('#qv-formats input:checked').value; toast(`Added "${b.title}" (${f}) to your cart · ${money(b.price[f])}`); };
  document.getElementById('qv-want').onclick = () => toast(`"${b.title}" added to Want to Read`);

  qvEl.removeAttribute('inert'); qvEl.classList.add('open'); qvBackdrop.classList.add('open'); qvEl.setAttribute('aria-hidden', 'false');
  qvEl.scrollTop = 0;
  document.body.style.overflow = 'hidden';
  (focusBuy ? buyBtn : document.getElementById('qv-close')).focus();
}
function closeQuickView() {
  qvEl.classList.remove('open'); qvBackdrop.classList.remove('open'); qvEl.setAttribute('aria-hidden', 'true'); qvEl.setAttribute('inert', '');
  document.body.style.overflow = '';
  lastFocus && lastFocus.focus && lastFocus.focus();
}

let toastT;
function toast(msg) {
  ensureQuickView();
  const t = document.getElementById('toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), 2600);
}

function qs(name) { return new URLSearchParams(location.search).get(name) || ''; }
