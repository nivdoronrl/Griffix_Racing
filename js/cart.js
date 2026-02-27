/**
 * cart.js — localStorage cart CRUD + slide-in drawer UI
 *
 * Public API (window.Cart):
 *   Cart.addItem(item)        — add or increment qty
 *   Cart.removeItem(id)       — remove by item.id (SKU)
 *   Cart.updateQty(id, qty)   — set qty (0 = remove)
 *   Cart.getItems()           — returns array
 *   Cart.getCount()           — total units
 *   Cart.getSubtotal()        — dollar total
 *   Cart.clear()              — empty cart
 *   Cart.openDrawer()
 *   Cart.closeDrawer()
 *
 * Every mutation fires: new CustomEvent('griffix:cart-updated', { bubbles:true })
 */

(function () {
  const STORAGE_KEY = 'griffix_cart';

  // ── Persistence ─────────────────────────────────────────────────────────
  function _load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : { items: [] };
    } catch { return { items: [] }; }
  }

  function _save(cart) {
    cart.updatedAt = new Date().toISOString();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cart));
    window.dispatchEvent(new CustomEvent('griffix:cart-updated', { bubbles: true }));
    _renderDrawer();
  }

  // ── Public API ────────────────────────────────────────────────────────────
  const Cart = {
    getItems() { return _load().items; },

    getCount() {
      return _load().items.reduce((s, i) => s + (i.qty || 0), 0);
    },

    getSubtotal() {
      return _load().items.reduce((s, i) => s + (i.price * i.qty), 0);
    },

    addItem(item) {
      const cart = _load();
      const existing = cart.items.find(i => i.id === item.id);
      if (existing) {
        existing.qty += item.qty || 1;
      } else {
        cart.items.push({ ...item, qty: item.qty || 1 });
      }
      _save(cart);
      Cart.openDrawer();
    },

    removeItem(id) {
      const cart = _load();
      cart.items = cart.items.filter(i => i.id !== id);
      _save(cart);
    },

    updateQty(id, qty) {
      const cart = _load();
      if (qty <= 0) {
        cart.items = cart.items.filter(i => i.id !== id);
      } else {
        const item = cart.items.find(i => i.id === id);
        if (item) item.qty = qty;
      }
      _save(cart);
    },

    clear() {
      _save({ items: [] });
    },

    openDrawer() {
      const drawer = document.getElementById('cart-drawer');
      const overlay = document.getElementById('cart-overlay');
      if (drawer) drawer.classList.add('open');
      if (overlay) overlay.classList.add('open');
      document.body.style.overflow = 'hidden';
    },

    closeDrawer() {
      const drawer = document.getElementById('cart-drawer');
      const overlay = document.getElementById('cart-overlay');
      if (drawer) drawer.classList.remove('open');
      if (overlay) overlay.classList.remove('open');
      document.body.style.overflow = '';
    },
  };

  window.Cart = Cart;

  // ── Drawer HTML injection ─────────────────────────────────────────────────
  function _injectDrawer() {
    if (document.getElementById('cart-drawer')) return;

    const overlay = document.createElement('div');
    overlay.id = 'cart-overlay';
    overlay.className = 'cart-overlay';
    overlay.addEventListener('click', Cart.closeDrawer);

    const drawer = document.createElement('div');
    drawer.id = 'cart-drawer';
    drawer.className = 'cart-drawer';
    drawer.innerHTML = `
      <div class="cart-drawer-header">
        <h2 style="font-family:'Oswald',sans-serif; font-size:18px; font-weight:600; letter-spacing:.08em; text-transform:uppercase; color:#e5e5e5;">Your Cart</h2>
        <button id="cart-close-btn" aria-label="Close cart" style="color:#666; background:none; border:none; cursor:pointer; padding:4px;" class="hover:text-[#D4FF00] transition-colors duration-200">
          <svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>
      <div id="cart-items-list" class="cart-items-list"></div>
      <div id="cart-footer" class="cart-drawer-footer"></div>
    `;

    document.body.appendChild(overlay);
    document.body.appendChild(drawer);

    document.getElementById('cart-close-btn').addEventListener('click', Cart.closeDrawer);
    document.addEventListener('keydown', e => { if (e.key === 'Escape') Cart.closeDrawer(); });

    _renderDrawer();
  }

  function _renderDrawer() {
    const listEl = document.getElementById('cart-items-list');
    const footerEl = document.getElementById('cart-footer');
    if (!listEl || !footerEl) return;

    const items = Cart.getItems();

    if (items.length === 0) {
      listEl.innerHTML = `
        <div style="flex:1; display:flex; flex-direction:column; align-items:center; justify-content:center; padding:48px 24px; text-align:center; gap:16px;">
          <svg width="48" height="48" fill="none" stroke="#333" stroke-width="1.5" viewBox="0 0 24 24"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>
          <p style="color:#555; font-family:'Archivo Narrow',sans-serif; font-size:14px; line-height:1.6;">Your cart is empty.<br>Find the kit that fits your ride.</p>
          <a href="/shop.html" class="btn-primary" style="font-size:13px; padding:10px 24px; text-decoration:none;">Browse Shop</a>
        </div>
      `;
      footerEl.innerHTML = '';
      return;
    }

    listEl.innerHTML = items.map(item => `
      <div class="cart-item" data-id="${item.id}">
        <div class="cart-item-img">
          <img src="${item.image || 'https://placehold.co/72x72/1a1a1a/444?text=Kit'}" alt="${item.name}" style="width:72px; height:72px; object-fit:cover;">
        </div>
        <div class="cart-item-info">
          <div class="cart-item-name">${item.name}</div>
          ${item.make ? `<div class="cart-item-meta">${item.make} ${item.model || ''} ${item.year || ''}</div>` : ''}
          <div class="cart-item-price">$${(item.price * item.qty).toFixed(2)}</div>
          <div class="qty-stepper">
            <button class="qty-btn" data-action="dec" data-id="${item.id}" aria-label="Decrease quantity">−</button>
            <span class="qty-display">${item.qty}</span>
            <button class="qty-btn" data-action="inc" data-id="${item.id}" aria-label="Increase quantity">+</button>
          </div>
        </div>
        <button class="cart-item-remove" data-remove="${item.id}" aria-label="Remove item">
          <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>
    `).join('');

    // Qty buttons
    listEl.querySelectorAll('.qty-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.id;
        const current = Cart.getItems().find(i => i.id === id);
        if (!current) return;
        if (btn.dataset.action === 'inc') Cart.updateQty(id, current.qty + 1);
        else Cart.updateQty(id, current.qty - 1);
      });
    });

    // Remove buttons
    listEl.querySelectorAll('[data-remove]').forEach(btn => {
      btn.addEventListener('click', () => Cart.removeItem(btn.dataset.remove));
    });

    const subtotal = Cart.getSubtotal();
    footerEl.innerHTML = `
      <div class="cart-subtotal-row">
        <span style="font-family:'Archivo Narrow',sans-serif; color:#aaa; font-size:13px;">Subtotal (excl. shipping)</span>
        <span style="font-family:'Oswald',sans-serif; color:#D4FF00; font-size:20px; font-weight:600;">$${subtotal.toFixed(2)}</span>
      </div>
      <a href="/cart.html" class="btn-primary" style="display:block; text-align:center; text-decoration:none; margin-bottom:10px; font-size:14px; padding:14px;">View Cart</a>
      <a href="/checkout.html" style="display:block; text-align:center; text-decoration:none; padding:14px; font-size:14px; font-family:'Oswald',sans-serif; font-weight:600; letter-spacing:.08em; text-transform:uppercase; color:#0f0f0f; background:#A39171; border:none; cursor:pointer;">Checkout →</a>
    `;
  }

  // ── Additional CSS for drawer internals (layout only — theme.css handles shell) ──
  function _injectStyles() {
    if (document.getElementById('cart-internal-styles')) return;
    const style = document.createElement('style');
    style.id = 'cart-internal-styles';
    style.textContent = `
      .cart-drawer-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 20px 24px;
        border-bottom: 1px solid rgba(163,145,113,.2);
        flex-shrink: 0;
      }
      .cart-items-list {
        flex: 1;
        overflow-y: auto;
        padding: 8px 0;
      }
      .cart-items-list::-webkit-scrollbar { width: 4px; }
      .cart-items-list::-webkit-scrollbar-track { background: transparent; }
      .cart-items-list::-webkit-scrollbar-thumb { background: #333; border-radius: 2px; }
      .cart-item {
        display: flex;
        gap: 14px;
        padding: 16px 24px;
        border-bottom: 1px solid rgba(255,255,255,.04);
        position: relative;
      }
      .cart-item-img { flex-shrink: 0; }
      .cart-item-img img { display: block; border: 1px solid #222; }
      .cart-item-info { flex: 1; min-width: 0; }
      .cart-item-name { font-family: 'Oswald', sans-serif; font-size: 14px; font-weight: 500; color: #e5e5e5; letter-spacing: .04em; line-height: 1.3; margin-bottom: 3px; }
      .cart-item-meta { font-family: 'Archivo Narrow', sans-serif; font-size: 11px; color: #555; margin-bottom: 6px; }
      .cart-item-price { font-family: 'Oswald', sans-serif; font-size: 15px; font-weight: 600; color: #D4FF00; margin-bottom: 10px; }
      .cart-item-remove {
        position: absolute;
        top: 16px;
        right: 20px;
        background: none;
        border: none;
        color: #444;
        cursor: pointer;
        padding: 4px;
        transition: color .2s;
      }
      .cart-item-remove:hover { color: #D4FF00; }
      .cart-drawer-footer {
        padding: 20px 24px;
        border-top: 1px solid rgba(163,145,113,.2);
        flex-shrink: 0;
        display: flex;
        flex-direction: column;
        gap: 10px;
      }
      .cart-subtotal-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 4px;
      }
    `;
    document.head.appendChild(style);
  }

  // ── Init on DOM ready ─────────────────────────────────────────────────────
  function _init() {
    _injectStyles();
    _injectDrawer();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _init);
  } else {
    _init();
  }
})();
