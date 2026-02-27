/**
 * reveal.js — IntersectionObserver scroll-reveal for .reveal elements.
 * Elements already in the viewport (or close to it) trigger immediately.
 * Hard fallback ensures everything is visible after 2 s even if IO fails.
 */

(function () {
  function initReveal() {
    const els = document.querySelectorAll('.reveal');
    if (!els.length) return;

    // Trigger elements already visible or near the top
    els.forEach(el => {
      const rect = el.getBoundingClientRect();
      if (rect.top < window.innerHeight + 200 && rect.bottom > 0) {
        el.classList.add('show');
      }
    });

    const io = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        if (e.isIntersecting) {
          e.target.classList.add('show');
          io.unobserve(e.target); // fire once
        }
      });
    }, { threshold: 0.05, rootMargin: '120px 0px 0px 0px' });

    els.forEach(el => {
      if (!el.classList.contains('show')) io.observe(el);
    });

    // Hard fallback
    setTimeout(() => els.forEach(el => el.classList.add('show')), 2000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initReveal);
  } else {
    initReveal();
  }
})();
