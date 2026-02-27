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
      badge.style.display = count > 0 ? 'flex' : 'none';
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
})();
