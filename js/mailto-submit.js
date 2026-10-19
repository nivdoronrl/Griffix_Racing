/**
 * mailto-submit.js — no-backend form delivery.
 *
 * Contact, quote and checkout forms build a plain-text email and open the
 * visitor's mail app with a mailto: link to griffixracing@gmail.com. Nothing is
 * sent to a server and no env vars are needed. After submit the page shows a
 * confirmation panel with the summary, "Copy details", "Open email again" and
 * the address to write to manually.
 *
 *   GriffixMailto.TO                         'griffixracing@gmail.com'
 *   GriffixMailto.attribution(form?)         { utm_source, …, referrer, landing_page }
 *   GriffixMailto.attributionLines(attr)     ['utm_source: …', …]
 *   GriffixMailto.build(subject, body, opts) { href, body, fullBody, truncated }
 *   GriffixMailto.open(href)
 *   GriffixMailto.copy(text)                 Promise<boolean>
 *   GriffixMailto.renderConfirmation(el, opts)
 */
(function () {
  if (window.GriffixMailto) return;
  var TO = 'griffixracing@gmail.com';
  var MAX_HREF = 2000; // max encoded mailto: URL length before notes get truncated
  var ATTR_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'referrer', 'landing_page'];
  var STORE_KEY = 'griffix_attribution';

  // First-touch attribution, captured on any page that loads this script.
  function captureAttribution() {
    try {
      var params = new URLSearchParams(location.search);
      var stored = JSON.parse(localStorage.getItem(STORE_KEY) || 'null');
      var hasUtm = ATTR_KEYS.slice(0, 5).some(function (k) { return params.get(k); });
      if (!stored || hasUtm) {
        var a = {};
        ATTR_KEYS.slice(0, 5).forEach(function (k) { a[k] = params.get(k) || (stored && !hasUtm ? stored[k] : '') || ''; });
        var ref = document.referrer || '';
        a.referrer = ref && ref.indexOf(location.host) === -1 ? ref : (stored && stored.referrer) || '';
        a.landing_page = (stored && !hasUtm && stored.landing_page) || (location.pathname + location.search);
        localStorage.setItem(STORE_KEY, JSON.stringify(a));
      }
    } catch (e) { /* storage blocked — fine */ }
  }
  captureAttribution();

  function attribution(form) {
    var a = {};
    try { a = JSON.parse(localStorage.getItem(STORE_KEY) || '{}') || {}; } catch (e) {}
    if (window.GriffixAnalytics && window.GriffixAnalytics.fillAttributionFields && form) {
      try {
        var g = window.GriffixAnalytics.fillAttributionFields(form) || {};
        ATTR_KEYS.forEach(function (k) { if (g[k]) a[k] = g[k]; });
      } catch (e) {}
    }
    if (!a.landing_page) a.landing_page = location.pathname + location.search;
    return a;
  }

  function attributionLines(a) {
    return ATTR_KEYS.map(function (k) { return k + ': ' + ((a && a[k]) || '—'); });
  }

  /**
   * build(subject, body, { notes })
   * `body` contains the token {{NOTES}}. If the encoded mailto URL would be
   * longer than MAX_HREF (~2000 chars, safe for Outlook/Windows mail handlers),
   * the notes are shortened to fit and a line asks the customer to paste the
   * rest. fullBody always has the complete text (used by "Copy details").
   */
  function build(subject, body, opts) {
    opts = opts || {};
    var notes = opts.notes || '';
    var prefix = 'mailto:' + TO + '?subject=' + encodeURIComponent(subject) + '&body=';
    var make = function (n) { return body.replace('{{NOTES}}', n); };
    var fullBody = make(notes);
    var outBody = fullBody;
    var truncated = false;
    if ((prefix + encodeURIComponent(outBody)).length > MAX_HREF && notes) {
      var marker = '\n[…notes shortened to fit the email link — please paste the full text here (use "Copy details" on the page).]';
      var lo = 0, hi = notes.length;
      while (lo < hi) { // longest notes prefix that fits
        var mid = Math.ceil((lo + hi) / 2);
        if ((prefix + encodeURIComponent(make(notes.slice(0, mid) + marker))).length <= MAX_HREF) lo = mid; else hi = mid - 1;
      }
      outBody = make(notes.slice(0, lo) + marker);
      truncated = true;
    }
    var href = prefix + encodeURIComponent(outBody);
    return { href: href, subject: subject, body: outBody, fullBody: fullBody, truncated: truncated };
  }

  function open(href) {
    // Same-tab navigation is the most reliable way to hand a mailto: to the OS.
    window.location.href = href;
  }

  function copy(text) {
    if (navigator.clipboard && window.isSecureContext) {
      return navigator.clipboard.writeText(text).then(function () { return true; }, function () { return legacyCopy(text); });
    }
    return Promise.resolve(legacyCopy(text));
  }
  function legacyCopy(text) {
    var ta = document.createElement('textarea');
    ta.value = text; ta.setAttribute('readonly', '');
    ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    var ok = false;
    try { ok = document.execCommand('copy'); } catch (e) {}
    document.body.removeChild(ta);
    return ok;
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; });
  }

  /**
   * renderConfirmation(container, { title, intro, mail, attachNote, confirmLabel, onConfirm })
   * mail = result of build(); copy uses "Subject: …\n\n" + fullBody.
   */
  function renderConfirmation(container, o) {
    var mail = o.mail;
    var copyText = 'To: ' + TO + '\nSubject: ' + mail.subject + '\n\n' + mail.fullBody;
    var btn = 'display:inline-block;padding:13px 24px;font-family:Oswald,sans-serif;font-size:13px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;text-decoration:none;cursor:pointer;border:none;';
    container.innerHTML =
      '<div class="gx-mail-confirm" style="background:#181818;border:1px solid rgba(255,107,0,.3);border-left:3px solid #FF6B00;padding:28px;text-align:left;">' +
        '<h2 class="font-display" style="color:#fff;font-weight:700;font-size:22px;margin:0 0 8px;">' + esc(o.title || 'ALMOST DONE — SEND THE EMAIL') + '</h2>' +
        '<p style="font-family:\'Archivo Narrow\',sans-serif;color:#aaa;font-size:15px;line-height:1.7;margin:0 0 12px;">' +
          (o.intro || 'Your email app should have opened with everything filled in. <strong style="color:#e5e5e5;">Press send</strong> to get it to us.') + '</p>' +
        (o.attachNote ? '<p style="font-family:\'Archivo Narrow\',sans-serif;color:#FF6B00;font-size:14px;line-height:1.6;margin:0 0 12px;">' + esc(o.attachNote) + '</p>' : '') +
        (mail.truncated ? '<p style="font-family:\'Archivo Narrow\',sans-serif;color:#c0a0a0;font-size:13px;margin:0 0 12px;">Your notes were long, so the email has a shortened version. Use “Copy details” and paste the full text into the email.</p>' : '') +
        '<div style="display:flex;gap:10px;flex-wrap:wrap;margin:16px 0;">' +
          '<a class="gx-open-again" href="' + esc(mail.href) + '" style="' + btn + 'background:#FF6B00;color:#0f0f0f;">Open email again</a>' +
          '<button type="button" class="gx-copy" style="' + btn + 'background:#222;color:#e5e5e5;border:1px solid rgba(163,145,113,.35);">Copy details</button>' +
          '<span class="gx-copy-status" aria-live="polite" style="align-self:center;font-family:\'Archivo Narrow\',sans-serif;font-size:13px;color:#A39171;"></span>' +
        '</div>' +
        '<p style="font-family:\'Archivo Narrow\',sans-serif;color:#888;font-size:14px;margin:0 0 16px;">Didn’t open? Email us at <a href="mailto:' + TO + '" style="color:#FF6B00;font-weight:600;">' + TO + '</a> and paste the details below.</p>' +
        '<pre class="gx-summary" style="background:#0f0f0f;border:1px solid #2a2a2a;color:#ccc;font-size:12px;line-height:1.55;padding:14px;white-space:pre-wrap;word-break:break-word;max-height:360px;overflow:auto;margin:0;">' + esc(copyText) + '</pre>' +
        (o.confirmLabel ? '<button type="button" class="gx-confirm" style="' + btn + 'width:100%;margin-top:18px;background:#FF6B00;color:#0f0f0f;padding:16px;">' + esc(o.confirmLabel) + '</button>' : '') +
      '</div>';
    container.style.display = 'block';
    container.querySelector('.gx-copy').addEventListener('click', function () {
      var status = container.querySelector('.gx-copy-status');
      copy(copyText).then(function (ok) {
        status.textContent = ok ? 'Copied — paste it into an email to ' + TO : 'Copy failed — select the text below and copy it.';
      });
    });
    var c = container.querySelector('.gx-confirm');
    if (c && o.onConfirm) c.addEventListener('click', function () { o.onConfirm(c); });
    return { copyText: copyText };
  }

  window.GriffixMailto = { TO: TO, MAX_HREF: MAX_HREF, attribution: attribution, attributionLines: attributionLines, build: build, open: open, copy: copy, renderConfirmation: renderConfirmation };
})();
