/**
 * nav.js — loads shared/nav.html into #nav-placeholder, sets active link,
 *           wires hamburger, and keeps the cart badge in sync.
 */

(async function initNav() {
  // ── Load footer ──────────────────────────────────────────────────────────
  const footerPlaceholder = document.getElementById('footer-placeholder');
  if (footerPlaceholder) {
    try {
      const res = await fetch('/shared/footer.html');
      if (res.ok) footerPlaceholder.innerHTML = await res.text();
    } catch (e) { console.warn('Footer load error:', e); }
  }

  const placeholder = document.getElementById('nav-placeholder');
  if (!placeholder) return;

  try {
    const res = await fetch('/shared/nav.html');
    if (!res.ok) throw new Error('nav fetch failed');
    placeholder.innerHTML = await res.text();
  } catch (e) {
    console.warn('Nav load error:', e);
    return;
  }

  // ── Active link by pathname ──────────────────────────────────────────────
  const path = window.location.pathname.replace(/\/$/, '') || '/index.html';
  const page = path.split('/').pop().replace('.html', '') || 'index';

  document.querySelectorAll('.nav-link[data-page]').forEach(link => {
    const linkPage = link.dataset.page;
    const match =
      (linkPage === 'home' && (page === 'index' || page === '')) ||
      (linkPage !== 'home' && page === linkPage);
    if (match) link.classList.add('active');
  });

  // ── Hamburger toggle ─────────────────────────────────────────────────────
  const hamburger = document.getElementById('hamburger');
  const mobileNav = document.getElementById('mobile-nav');
  if (hamburger && mobileNav) {
    hamburger.addEventListener('click', () => mobileNav.classList.toggle('open'));
  }

  // ── Cart badge ───────────────────────────────────────────────────────────
  function updateBadge() {
    const count = window.Cart ? window.Cart.getCount() : _readCartCount();
    const badges = [
      document.getElementById('cart-badge'),
      document.getElementById('mobile-cart-badge'),
    ];
    badges.forEach(badge => {
      if (!badge) return;
      badge.textContent = count;
      if (count > 0) {
        badge.classList.add('visible');
      } else {
        badge.classList.remove('visible');
      }
    });
  }

  /** Fallback: read count directly from localStorage if Cart isn't loaded yet */
  function _readCartCount() {
    try {
      const data = JSON.parse(localStorage.getItem('griffix_cart') || '{}');
      return (data.items || []).reduce((sum, item) => sum + (item.qty || 0), 0);
    } catch { return 0; }
  }

  updateBadge();
  window.addEventListener('griffix:cart-updated', updateBadge);

  // ── Cart button → open drawer ─────────────────────────────────────────────
  ['nav-cart-btn', 'mobile-cart-btn'].forEach(id => {
    const btn = document.getElementById(id);
    if (btn) btn.addEventListener('click', () => {
      window.Cart && window.Cart.openDrawer();
    });
  });

  // ── Search overlay ───────────────────────────────────────────────────────
  const searchBtn = document.getElementById('nav-search-btn');
  const searchOverlay = document.getElementById('search-overlay');
  const searchInput = document.getElementById('search-input');
  const searchClose = document.getElementById('search-close');
  const searchResults = document.getElementById('search-results');

  function openSearch() {
    if (!searchOverlay) return;
    searchOverlay.style.display = 'flex';
    searchInput && searchInput.focus();
    document.body.style.overflow = 'hidden';
  }
  function closeSearch() {
    if (!searchOverlay) return;
    searchOverlay.style.display = 'none';
    document.body.style.overflow = '';
    if (searchInput) searchInput.value = '';
    if (searchResults) searchResults.style.display = 'none';
  }

  if (searchBtn) searchBtn.addEventListener('click', openSearch);
  if (searchClose) searchClose.addEventListener('click', closeSearch);
  if (searchOverlay) searchOverlay.addEventListener('click', e => { if (e.target === searchOverlay) closeSearch(); });

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && searchOverlay && searchOverlay.style.display === 'flex') closeSearch();
  });

  let _searchProducts = null;
  if (searchInput) {
    searchInput.addEventListener('input', async () => {
      const q = searchInput.value.trim().toLowerCase();
      if (!q) { searchResults.style.display = 'none'; return; }

      // Lazy-load product list
      if (!_searchProducts) {
        try {
          const r = await fetch('/api/products');
          const d = await r.json();
          _searchProducts = d.products || [];
        } catch { _searchProducts = []; }
      }

      const matches = _searchProducts.filter(p =>
        [p.name, p.make, p.model, p.category].some(f => f && f.toLowerCase().includes(q))
      ).slice(0, 8);

      if (matches.length === 0) {
        searchResults.innerHTML = `<div style="padding:20px; color:#555; font-family:'Archivo Narrow',sans-serif; font-size:14px; text-align:center;">No products found for "${searchInput.value}"</div>`;
      } else {
        searchResults.innerHTML = matches.map(p => `
          <a href="/product.html?id=${p.id}" onclick="closeSearch()" style="display:flex; align-items:center; gap:14px; padding:14px 20px; border-bottom:1px solid rgba(255,255,255,.04); text-decoration:none; transition:background .15s ease;" onmouseover="this.style.background='rgba(255,107,0,.04)'" onmouseout="this.style.background=''">
            <div style="width:40px; height:40px; background:#222; flex-shrink:0; display:flex; align-items:center; justify-content:center;">
              <span style="font-family:'Oswald',sans-serif; font-weight:700; font-size:10px; color:#A39171; letter-spacing:.05em;">${(p.make||'KIT').substring(0,3).toUpperCase()}</span>
            </div>
            <div style="flex:1; min-width:0;">
              <div style="font-family:'Oswald',sans-serif; font-size:13px; color:#e5e5e5; font-weight:600; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${p.name}</div>
              <div style="font-family:'Archivo Narrow',sans-serif; font-size:11px; color:#555; margin-top:2px;">${p.make||''} ${p.model||''}</div>
            </div>
            <div style="font-family:'Oswald',sans-serif; font-weight:700; color:#FF6B00; font-size:14px; flex-shrink:0;">$${p.price}</div>
          </a>
        `).join('');
      }
      searchResults.style.display = 'block';
    });

    searchInput.addEventListener('keydown', e => {
      if (e.key === 'Enter') {
        const q = searchInput.value.trim();
        if (q) { window.location.href = `/shop.html?q=${encodeURIComponent(q)}`; closeSearch(); }
      }
    });
  }
  window.closeSearch = closeSearch;
})();
