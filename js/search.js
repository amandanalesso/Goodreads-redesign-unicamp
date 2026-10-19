/* ============================================================
   Busca — typeahead (≥3 caracteres), ranking de séries por volume,
   filtros avançados, abas e estado "nenhum resultado".
   Heurísticas endereçadas: #8 (série em ordem), #13 (estado vazio com CTA),
   #15 ("Lists" em vez de "Listopia"), #20 (atalho /), #21 (filtros).
   ============================================================ */

const norm = s => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
const MIN_CHARS = 3;

function highlight(text, q) {
  const n = norm(q); if (!n) return esc(text);
  const words = n.split(' ').filter(Boolean);
  let out = esc(text);
  words.forEach(w => { out = out.replace(new RegExp(`(${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'ig'), '<mark>$1</mark>'); });
  return out;
}

/* score de relevância simples ("elastic-like"): título > série > autor, prefixo > contém */
function scoreBook(b, q, scope) {
  const n = norm(q); if (n.length < MIN_CHARS) return 0;
  const words = n.split(' ');
  const t = norm(b.title), a = norm(b.author), s = norm(b.series || '');
  let score = 0;
  for (const w of words) {
    let hit = 0;
    if (scope !== 'author' && scope !== 'isbn') { if (t.startsWith(w)) hit = Math.max(hit, 10); else if (t.includes(w)) hit = Math.max(hit, 6); if (s.includes(w)) hit = Math.max(hit, 7); }
    if (scope !== 'title' && scope !== 'isbn') { if (a.startsWith(w)) hit = Math.max(hit, 8); else if (a.includes(w)) hit = Math.max(hit, 5); }
    if (scope === 'isbn') { if (b.id.includes(w)) hit = 10; }
    if (!hit) return 0; // todas as palavras precisam casar
    score += hit;
  }
  // desempate: popularidade; penaliza volumes > 1 para que o Livro 1 apareça primeiro (achado #8)
  score += Math.log10(b.ratings + 1) / 10;
  if (b.series && b.volume > 1) score -= 0.5 * Math.min(b.volume, 5);
  return score;
}

function searchBooks(q, scope = 'all') {
  return BOOKS.map(b => ({ b, s: scoreBook(b, q, scope) })).filter(x => x.s > 0).sort((x, y) => y.s - x.s).map(x => x.b);
}
function searchAuthors(q) { const n = norm(q); return n.length < MIN_CHARS ? [] : AUTHORS.filter(a => norm(a.name).includes(n)).slice(0, 5); }
function searchLists(q) { const n = norm(q); return n.length < MIN_CHARS ? [] : LISTS.filter(l => norm(l.name).includes(n) || norm(l.blurb).includes(n)).slice(0, 5); }

/* "Did you mean": distância de edição simples sobre títulos/autores */
function lev(a, b) { const m = []; for (let i = 0; i <= a.length; i++) m[i] = [i]; for (let j = 0; j <= b.length; j++) m[0][j] = j; for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) m[i][j] = Math.min(m[i - 1][j] + 1, m[i][j - 1] + 1, m[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); return m[a.length][b.length]; }
function didYouMean(q) {
  const n = norm(q); if (!n) return null;
  const cands = [...new Set([...BOOKS.map(b => b.title), ...AUTHORS.map(a => a.name), ...BOOKS.filter(b => b.series).map(b => b.series)])];
  let best = null, bestD = Infinity;
  for (const c of cands) { const cn = norm(c); const d = Math.min(lev(n, cn), lev(n, cn.slice(0, n.length))); if (d < bestD) { bestD = d; best = c; } }
  return bestD <= Math.max(2, Math.floor(n.length / 3)) ? best : null;
}

/* ---------- Typeahead ---------- */
function initTypeahead(input, panel, hint, onSubmit) {
  let timer, active = -1, items = [];
  const close = () => { panel.classList.remove('open'); panel.innerHTML = ''; active = -1; items = []; input.setAttribute('aria-expanded', 'false'); input.removeAttribute('aria-activedescendant'); };
  const render = q => {
    const books = searchBooks(q).slice(0, 5), authors = searchAuthors(q).slice(0, 3), lists = searchLists(q).slice(0, 2);
    if (!books.length && !authors.length && !lists.length) {
      panel.innerHTML = `<div class="ta-group"><div class="ta-item" style="grid-template-columns:32px 1fr"><span class="ta-ico">∅</span><span><span class="ta-t">No matches for “${esc(q)}”</span><br><span class="ta-s">Press Enter to see suggestions</span></span></div></div>`;
      panel.classList.add('open'); return;
    }
    panel.innerHTML = `
      ${books.length ? `<div class="ta-group"><div class="ta-group-title">Books</div>${books.map(b => `<div class="ta-item" data-type="book" data-id="${b.id}" role="option"><img src="${b.cover}" alt=""><span><span class="ta-t">${highlight(b.title, q)}${b.series ? ` <span class="ta-s">(${esc(b.series)} #${b.volume})</span>` : ''}</span><br><span class="ta-s">${highlight(b.author, q)}</span></span><span class="ta-r">★ ${b.rating.toFixed(2)}</span></div>`).join('')}</div>` : ''}
      ${authors.length ? `<div class="ta-group"><div class="ta-group-title">Authors</div>${authors.map(a => `<div class="ta-item" data-type="author" data-q="${esc(a.name)}" role="option"><span class="ta-ico">✎</span><span><span class="ta-t">${highlight(a.name, q)}</span><br><span class="ta-s">${a.books} book${a.books > 1 ? 's' : ''}</span></span><span class="ta-r">Author</span></div>`).join('')}</div>` : ''}
      ${lists.length ? `<div class="ta-group"><div class="ta-group-title">Lists <span style="font-weight:400;text-transform:none;letter-spacing:0">· reader-curated</span></div>${lists.map(l => `<div class="ta-item" data-type="list" data-id="${l.id}" role="option"><span class="ta-ico">☰</span><span><span class="ta-t">${highlight(l.name, q)}</span><br><span class="ta-s">${l.books.length} books · ${l.curator}</span></span><span class="ta-r">List</span></div>`).join('')}</div>` : ''}
      <div class="ta-footer">Press <b>Enter</b> to see all results for “${esc(q)}”</div>`;
    panel.classList.add('open'); input.setAttribute('aria-expanded', 'true');
    items = [...panel.querySelectorAll('.ta-item[data-type]')]; items.forEach((it, i) => it.id = 'ta-opt-' + i); active = -1; input.removeAttribute('aria-activedescendant');
  };
  const go = el => {
    if (!el) return;
    if (el.dataset.type === 'book') { close(); openQuickView(BOOK_BY_ID[el.dataset.id]); }
    else if (el.dataset.type === 'author') { input.value = el.dataset.q; close(); onSubmit(el.dataset.q, 'author'); }
    else if (el.dataset.type === 'list') { location.href = `lists.html?list=${el.dataset.id}`; }
  };
  input.addEventListener('input', () => {
    const q = input.value.trim();
    clearTimeout(timer);
    if (q.length === 0) { hint.textContent = 'Search by title, author, series or ISBN.'; hint.classList.remove('warn'); close(); return; }
    if (q.length < MIN_CHARS) { hint.textContent = `Type at least ${MIN_CHARS} characters to see suggestions (${q.length}/${MIN_CHARS})`; hint.classList.add('warn'); close(); return; }
    hint.textContent = 'Suggestions update as you type. Use ↑ ↓ to navigate, Enter to open.'; hint.classList.remove('warn');
    timer = setTimeout(() => render(q), 200); // debounce "elastic"
  });
  input.addEventListener('keydown', e => {
    if (!panel.classList.contains('open')) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); active = Math.min(active + 1, items.length - 1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); active = Math.max(active - 1, -1); }
    else if (e.key === 'Enter' && active >= 0) { e.preventDefault(); go(items[active]); return; }
    else if (e.key === 'Escape') { close(); return; }
    items.forEach((it, i) => { it.classList.toggle('active', i === active); it.setAttribute('aria-selected', i === active); });
    if (items[active]) input.setAttribute('aria-activedescendant', items[active].id); else input.removeAttribute('aria-activedescendant');
    if (items[active]) items[active].scrollIntoView({ block: 'nearest' });
  });
  panel.addEventListener('mousedown', e => { const it = e.target.closest('.ta-item[data-type]'); if (it) { e.preventDefault(); go(it); } });
  document.addEventListener('click', e => { if (!panel.contains(e.target) && e.target !== input) close(); });
  return { close };
}

/* ---------- Página de resultados ---------- */
const SF = { genre: '', rating: 0, format: '', lang: '', yearFrom: '', yearTo: '', sort: 'relevance', more: false };

function applySearchFilters(books) {
  return books.filter(b =>
    (!SF.genre || b.genre === SF.genre) &&
    (!SF.lang || b.lang === SF.lang) &&
    (!SF.format || b.formats.includes(SF.format)) &&
    (!SF.rating || b.rating >= SF.rating) &&
    (!SF.yearFrom || b.year >= +SF.yearFrom) &&
    (!SF.yearTo || b.year <= +SF.yearTo));
}
function sortBooks(books) {
  const c = [...books];
  if (SF.sort === 'rating') c.sort((a, b) => b.rating - a.rating);
  else if (SF.sort === 'popular') c.sort((a, b) => b.ratings - a.ratings);
  else if (SF.sort === 'newest') c.sort((a, b) => b.year - a.year);
  else if (SF.sort === 'price') c.sort((a, b) => minPrice(a) - minPrice(b));
  return c;
}
const hasFilters = () => SF.genre || SF.rating || SF.format || SF.lang || SF.yearFrom || SF.yearTo;
function clearFilters() { Object.assign(SF, { genre: '', rating: 0, format: '', lang: '', yearFrom: '', yearTo: '' }); renderResults(); }

let CURRENT_Q = '', CURRENT_SCOPE = 'all';
function runSearch(q, scope) {
  CURRENT_Q = q; CURRENT_SCOPE = scope || CURRENT_SCOPE;
  const url = new URL(location); url.searchParams.set('q', q); if (scope) url.searchParams.set('scope', scope); history.replaceState(null, '', url);
  document.getElementById('results').hidden = false;
  document.getElementById('browse-all').hidden = true;
  renderResults();
}

function renderBar(q, pool, filtered) {
  const bar = document.getElementById('results-bar');
  const genres = [...new Set(pool.map(b => b.genre))].sort();
  const langs = [...new Set(pool.map(b => b.lang))].sort();
  const opt = (list, cur) => list.map(v => `<option ${v === cur ? 'selected' : ''}>${esc(v)}</option>`).join('');
  bar.innerHTML = `
    <div class="rb-top">
      <span class="count"><b>${filtered.length}</b> ${filtered.length === 1 ? 'book' : 'books'} for “${esc(q)}”${pool.length !== filtered.length ? ` <span class="muted">(${pool.length} before filters)</span>` : ''}</span>
      <label class="sort">Sort by <select class="select" id="sort"><option value="relevance">Relevance</option><option value="rating">Rating</option><option value="popular">Most rated</option><option value="newest">Newest</option><option value="price">Price: low to high</option></select></label>
    </div>
    <div class="rb-filters">
      <select class="select" id="f-genre" aria-label="Genre"><option value="">All genres</option>${opt(genres, SF.genre)}</select>
      <select class="select" id="f-rating" aria-label="Minimum rating"><option value="0">Any rating</option><option value="4.5" ${SF.rating === 4.5 ? 'selected' : ''}>4.5 ★ &amp; up</option><option value="4" ${SF.rating === 4 ? 'selected' : ''}>4.0 ★ &amp; up</option><option value="3.5" ${SF.rating === 3.5 ? 'selected' : ''}>3.5 ★ &amp; up</option></select>
      <select class="select" id="f-format" aria-label="Format"><option value="">Any format</option>${opt(['Kindle', 'Paperback', 'Hardcover', 'Audiobook'], SF.format)}</select>
      <button type="button" class="btn-link rb-more" id="f-more" aria-expanded="${SF.more}">${SF.more ? 'Fewer filters' : 'More filters'}</button>
      ${hasFilters() ? '<button type="button" class="btn-link rb-clear" id="f-clear">Clear filters</button>' : ''}
    </div>
    <div class="rb-more-panel" id="rb-more" ${SF.more ? '' : 'hidden'}>
      <label>Language <select class="select" id="f-lang"><option value="">Any</option>${opt(langs, SF.lang)}</select></label>
      <label>Published <input class="select" type="number" id="f-yfrom" aria-label="Published from year" placeholder="from" value="${SF.yearFrom}"> <input class="select" type="number" id="f-yto" aria-label="Published to year" placeholder="to" value="${SF.yearTo}"></label>
    </div>`;
  const on = (id, fn) => { const el = bar.querySelector(id); if (el) el.onchange = e => { fn(e.target.value); renderResults(); }; };
  bar.querySelector('#sort').value = SF.sort;
  on('#sort', v => SF.sort = v);
  on('#f-genre', v => SF.genre = v);
  on('#f-rating', v => SF.rating = +v);
  on('#f-format', v => SF.format = v);
  on('#f-lang', v => SF.lang = v);
  on('#f-yfrom', v => SF.yearFrom = v);
  on('#f-yto', v => SF.yearTo = v);
  bar.querySelector('#f-more').onclick = () => { SF.more = !SF.more; renderResults(); };
  const clr = bar.querySelector('#f-clear'); if (clr) clr.onclick = clearFilters;
}

function renderResults() {
  const q = CURRENT_Q;
  const genreParam = qs('genre');
  const pool = q ? searchBooks(q, CURRENT_SCOPE) : (genreParam ? BOOKS.filter(b => b.genre === genreParam) : [...BOOKS].sort((a, b) => b.ratings - a.ratings));
  const authors = q ? searchAuthors(q) : [];
  const lists = q ? searchLists(q) : [];
  const filtered = sortBooks(applySearchFilters(pool));
  const bar = document.getElementById('results-bar'), grid = document.getElementById('results-grid'), extra = document.getElementById('results-extra');

  // Nada encontrado: tela limpa, sem filtros nem abas
  if (!pool.length && !authors.length && !lists.length) {
    bar.innerHTML = ''; grid.innerHTML = emptyHTML(q); extra.innerHTML = ''; const srs0 = document.getElementById('sr-status'); if (srs0) srs0.textContent = `No results found for ${q}`; return;
  }

  renderBar(q || genreParam || 'all books', pool, filtered);
  const srs = document.getElementById('sr-status'); if (srs) srs.textContent = `${filtered.length} ${filtered.length === 1 ? 'book' : 'books'} found${q ? ' for ' + q : ''}`;

  if (!filtered.length) {
    grid.innerHTML = `<div class="empty empty--filters"><h2>No books match these filters</h2><p>There are ${pool.length} results for “${esc(q)}”, but none pass the active filters.</p><button class="btn btn-primary" onclick="clearFilters()">Clear filters</button></div>`;
  } else {
    // Série: card em ordem de leitura (achado #8)
    let seriesCard = '';
    if (q) {
      const n = norm(q);
      const series = [...new Set(filtered.filter(b => b.series && norm(b.series).includes(n)).map(b => b.series))];
      if (series.length) {
        const sName = series[0]; const vols = BOOKS.filter(b => b.series === sName).sort((a, b) => a.volume - b.volume);
        const first = vols.find(v => v.volume === 1) || vols[0];
        seriesCard = `<div class="series-card"><div class="sc-covers">${vols.slice(0, 7).map(v => `<button type="button" data-action="open" data-id="${v.id}" aria-label="#${v.volume} ${esc(v.title)}" title="#${v.volume} ${esc(v.title)}"><img src="${v.cover}" alt=""></button>`).join('')}</div><div><h3>${esc(sName)} <span class="muted">series · ${vols.length} books</span></h3><p>Start with <b>#1 ${esc(first.title)}</b>. Shown in reading order.</p><div class="sc-actions"><button class="btn btn-buy" data-action="buy" data-id="${first.id}">Buy book 1 · ${money(minPrice(first))}</button><button class="btn btn-outline" data-action="open" data-id="${first.id}">See the series</button></div></div></div>`;
      }
    }
    grid.innerHTML = seriesCard + filtered.map(b => bookCard(b)).join('');
  }

  // Autores e listas: seções secundárias, só se existirem
  extra.innerHTML = `
    ${authors.length ? `<section class="extra"><h2>Authors</h2><div class="extra-row">${authors.map(a => `<button class="author-card" onclick="document.getElementById('big-search').value='${esc(a.name).replace(/'/g, "\\'")}';document.getElementById('scope').value='author';runSearch('${esc(a.name).replace(/'/g, "\\'")}','author')"><span class="avatar">${esc(a.name[0])}</span><span><b>${esc(a.name)}</b><small>${a.books} book${a.books > 1 ? 's' : ''}</small></span></button>`).join('')}</div></section>` : ''}
    ${lists.length ? `<section class="extra"><h2>Lists <span class="muted">reader-curated</span></h2><div class="extra-row">${lists.map(l => `<a class="list-row" href="lists.html?list=${l.id}"><span class="stack">${l.books.slice(0, 3).map(id => `<img src="${BOOK_BY_ID[id].cover}" alt="">`).join('')}</span><span><b>${esc(l.name)}</b><small>${l.books.length} books · ${l.curator}</small></span></a>`).join('')}</div></section>` : ''}`;
}

function emptyHTML(q) {
  const dym = q ? didYouMean(q) : null;
  const popular = [...BOOKS].sort((a, b) => b.wantToRead - a.wantToRead).slice(0, 6);
  return `<div class="empty">
    <h2>We couldn’t find “${esc(q)}”</h2>
    ${dym ? `<p class="did-you-mean">Did you mean <a href="#" onclick="document.getElementById('big-search').value='${esc(dym).replace(/'/g, "\\'")}';runSearch('${esc(dym).replace(/'/g, "\\'")}');return false">${esc(dym)}</a>?</p>` : '<p>Check the spelling or try the author’s name.</p>'}
    <a class="btn btn-primary btn-lg" href="index.html">Browse top books instead</a>
    <h3>Popular right now</h3>
    <div class="row-track empty-track">${popular.map(b => bookCard(b)).join('')}</div>
  </div>`;
}
