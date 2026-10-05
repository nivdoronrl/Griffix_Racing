/**
 * Griffix Racing — shared analytics loader
 * GA4 + optional Vercel Web Analytics + first-touch UTM attribution.
 * Loaded once via js/nav.js. Skips /admin/* paths.
 */
(function () {
  'use strict';

  var CONFIG = {
    GA4_MEASUREMENT_ID: 'G-Y4HPSRMVMX',
    META_PIXEL_ID: '',
    // Script 404s harmlessly until NIv enables Web Analytics in the Vercel dashboard
    ENABLE_VERCEL_ANALYTICS: true,
  };

  var ATTR_KEY = 'griffix_attribution';
  var ATTR_KEYS = [
    'utm_source',
    'utm_medium',
    'utm_campaign',
    'utm_term',
    'utm_content',
    'referrer',
    'landing_page',
  ];

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
    // Standard Vercel Web Analytics queue + script for static HTML sites
    window.va =
      window.va ||
      function () {
        (window.vaq = window.vaq || []).push(arguments);
      };
    loadScript('/_vercel/insights/script.js', { defer: 'defer' });
  }

  function readStoredAttribution() {
    try {
      var raw = localStorage.getItem(ATTR_KEY);
      if (!raw) return null;
      var parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? parsed : null;
    } catch (e) {
      return null;
    }
  }

  function writeStoredAttribution(data) {
    try {
      localStorage.setItem(ATTR_KEY, JSON.stringify(data));
    } catch (e) {
      /* ignore quota / private mode */
    }
  }

  /**
   * Capture first-touch UTMs + referrer + landing page.
   * Does NOT strip the query string — GA4 reads location.search itself.
   */
  function captureAttribution() {
    var params;
    try {
      params = new URLSearchParams(location.search || '');
    } catch (e) {
      params = { get: function () { return null; } };
    }

    var existing = readStoredAttribution() || {};
    var next = {};
    ATTR_KEYS.forEach(function (k) {
      next[k] = existing[k] || '';
    });

    var hasUtm = false;
    ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'].forEach(function (k) {
      var v = (params.get(k) || '').trim();
      if (v) {
        hasUtm = true;
        // First-touch: only set if empty
        if (!next[k]) next[k] = v.slice(0, 200);
      }
    });

    if (!next.referrer) {
      try {
        var ref = document.referrer || '';
        if (ref && ref.indexOf(location.hostname) === -1) {
          next.referrer = ref.slice(0, 500);
        }
      } catch (e) { /* ignore */ }
    }

    if (!next.landing_page) {
      try {
        next.landing_page = (location.pathname + location.search).slice(0, 500);
      } catch (e) {
        next.landing_page = '/';
      }
    }

    // Always persist on first visit or when new first-touch UTMs arrive
    if (hasUtm || !existing.landing_page) {
      writeStoredAttribution(next);
    }

    return next;
  }

  function getAttribution() {
    return readStoredAttribution() || captureAttribution();
  }

  /** Fill hidden inputs named after ATTR_KEYS inside a form */
  function fillAttributionFields(form) {
    if (!form || !form.querySelector) return getAttribution();
    var attr = getAttribution();
    ATTR_KEYS.forEach(function (k) {
      var el = form.querySelector('[name="' + k + '"]');
      if (el) el.value = attr[k] || '';
    });
    return attr;
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

  window.GriffixAnalytics = {
    config: CONFIG,
    getAttribution: getAttribution,
    fillAttributionFields: fillAttributionFields,
    generateLead: function (params) {
      params = params || {};
      var attr = getAttribution();
      gaEvent('generate_lead', {
        lead_type: params.lead_type || '',
        source: params.source || '',
        utm_source: params.utm_source || attr.utm_source || '',
        currency: 'USD',
        value: toNumber(params.value),
      });
    },
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

  // Capture UTMs before GA4 config so first-touch is stored; do not strip location.search
  captureAttribution();

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
