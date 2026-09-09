/**
 * Griffix Racing — shared analytics loader (DRAFT)
 * Measurement IDs are public-by-design in frontend, but do NOT deploy
 * until NIv supplies real IDs and approves production.
 *
 * Load once via js/nav.js (dynamic script into <head>).
 * Skip on /admin/* paths.
 */
(function () {
  'use strict';

  var CONFIG = {
    // Replace after NIv creates GA4 property — e.g. 'G-XXXXXXXX'
    GA4_MEASUREMENT_ID: 'G-Y4HPSRMVMX',
    // Empty string = skip Meta Pixel
    META_PIXEL_ID: '',
    // Set true only after Vercel Web Analytics enabled in project UI + NIv OK
    ENABLE_VERCEL_ANALYTICS: false,
  };

  function pathIsAdmin() {
    try {
      return /^\/admin(\/|$)/i.test(location.pathname || '');
    } catch (e) {
      return false;
    }
  }

  function hasRealGa4Id(id) {
    return (
      typeof id === 'string' &&
      /^G-[A-Z0-9]+$/i.test(id) &&
      id.toUpperCase() !== 'G-XXXXXXXX'
    );
  }

  function loadScript(src, attrs) {
    if (document.querySelector('script[src="' + src + '"]')) return;
    var s = document.createElement('script');
    s.src = src;
    s.async = true;
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        s.setAttribute(k, attrs[k]);
      });
    }
    (document.head || document.documentElement).appendChild(s);
  }

  function initGa4(id) {
    window.dataLayer = window.dataLayer || [];
    function gtag() {
      window.dataLayer.push(arguments);
    }
    window.gtag = gtag;
    gtag('js', new Date());
    gtag('config', id, { send_page_view: true });
    loadScript('https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(id));
  }

  function initMetaPixel(id) {
    if (!id) return;
    if (window.fbq) return;
    !(function (f, b, e, v, n, t, s) {
      if (f.fbq) return;
      n = f.fbq = function () {
        n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments);
      };
      if (!f._fbq) f._fbq = n;
      n.push = n;
      n.loaded = true;
      n.version = '2.0';
      n.queue = [];
      t = b.createElement(e);
      t.async = true;
      t.src = v;
      s = b.getElementsByTagName(e)[0];
      s.parentNode.insertBefore(t, s);
    })(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js');
    window.fbq('init', id);
    window.fbq('track', 'PageView');
  }

  function initVercelAnalytics() {
    // Plain HTML static sites: inject Vercel's Web Analytics script when enabled in dashboard.
    // Exact snippet may match current Vercel docs — confirm at enable time.
    loadScript('https://cdn.vercel-insights.com/v1/script.js', { 'data-endpoint': '/_vercel/insights' });
  }

  function toNumber(value) {
    var n = Number(value);
    return isFinite(n) ? n : 0;
  }

  function gaEvent(name, params) {
    if (typeof window.gtag === 'function' && hasRealGa4Id(CONFIG.GA4_MEASUREMENT_ID)) {
      window.gtag('event', name, params || {});
    }
  }

  function fbTrack(name, params) {
    if (typeof window.fbq === 'function' && CONFIG.META_PIXEL_ID) {
      window.fbq('track', name, params || {});
    }
  }

  /** Public stubs — safe no-ops until IDs are real and hooks are wired */
  window.GriffixAnalytics = {
    config: CONFIG,
    viewItem: function (item) {
      item = item || {};
      gaEvent('view_item', {
        currency: item.currency || 'USD',
        value: toNumber(item.value),
        items: item.items || [],
      });
      fbTrack('ViewContent', {
        content_ids: item.content_ids || [],
        content_type: 'product',
        value: toNumber(item.value),
        currency: item.currency || 'USD',
      });
    },
    addToCart: function (item) {
      item = item || {};
      gaEvent('add_to_cart', {
        currency: item.currency || 'USD',
        value: toNumber(item.value),
        items: item.items || [],
      });
      fbTrack('AddToCart', {
        content_ids: item.content_ids || [],
        content_type: 'product',
        value: toNumber(item.value),
        currency: item.currency || 'USD',
      });
    },
    beginCheckout: function (cart) {
      cart = cart || {};
      gaEvent('begin_checkout', {
        currency: cart.currency || 'USD',
        value: toNumber(cart.value),
        items: cart.items || [],
      });
      fbTrack('InitiateCheckout', {
        value: toNumber(cart.value),
        currency: cart.currency || 'USD',
        num_items: cart.num_items,
      });
    },
    purchase: function (order) {
      order = order || {};
      gaEvent('purchase', {
        transaction_id: order.transaction_id,
        currency: order.currency || 'USD',
        value: toNumber(order.value),
        items: order.items || [],
      });
      fbTrack('Purchase', {
        value: toNumber(order.value),
        currency: order.currency || 'USD',
      });
    },
  };

  if (pathIsAdmin()) return;

  if (hasRealGa4Id(CONFIG.GA4_MEASUREMENT_ID)) {
    initGa4(CONFIG.GA4_MEASUREMENT_ID);
  }

  if (CONFIG.META_PIXEL_ID) {
    initMetaPixel(CONFIG.META_PIXEL_ID);
  }

  if (CONFIG.ENABLE_VERCEL_ANALYTICS) {
    initVercelAnalytics();
  }
})();
