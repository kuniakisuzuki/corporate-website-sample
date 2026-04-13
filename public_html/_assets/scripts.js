(() => {
  const header = document.querySelector('.site-header');
  const toggle = document.querySelector('.nav-toggle');
  const nav = document.getElementById('site-nav');
  const backdrop = document.querySelector('.nav-backdrop');
  const mqDesktop = window.matchMedia('(min-width: 961px)');

  function isPrivateIpv4(hostname) {
    const m = hostname.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
    if (!m) return false;
    const a = Number(m[1]);
    const b = Number(m[2]);
    if (a === 10) return true;
    if (a === 192 && b === 168) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    return false;
  }

  function isLocalDevHost(hostname) {
    return hostname === 'localhost'
      || hostname === '127.0.0.1'
      || hostname === '::1'
      || hostname.endsWith('.local')
      || isPrivateIpv4(hostname);
  }

  if (isLocalDevHost(window.location.hostname)) {
    window.dataLayer = window.dataLayer || [];
    // Mark local traffic as debug/dev traffic for GA4 filtering.
    window.dataLayer.push({ debug_mode: true });
    if (typeof window.gtag === 'function') {
      window.gtag('set', 'debug_mode', true);
    }
  }

  function setOpen(open) {
    if (!header || !toggle) return;
    header.dataset.navOpen = String(open);
    toggle.setAttribute('aria-expanded', String(open));
    if (backdrop) backdrop.hidden = !open;
    document.body.style.overflow = open && !mqDesktop.matches ? 'hidden' : '';
    if (open) {
      const firstLink = nav?.querySelector('a');
      firstLink && firstLink.focus({ preventScroll: true });
    } else {
      toggle.focus({ preventScroll: true });
    }
  }

  toggle?.addEventListener('click', () => {
    const open = toggle.getAttribute('aria-expanded') === 'true';
    setOpen(!open);
  });

  backdrop?.addEventListener('click', () => setOpen(false));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') setOpen(false); });

  (mqDesktop.addEventListener ? mqDesktop.addEventListener('change', () => setOpen(false)) : window.addEventListener('resize', () => setOpen(false)));

  // スムーズスクロール（ヘッダー分オフセット）
  const offset = () => (header ? header.getBoundingClientRect().height + 10 : 0);
  document.querySelectorAll('a[href^="#"]').forEach(a => {
    a.addEventListener('click', (e) => {
      const id = a.getAttribute('href');
      if (!id || id.length <= 1) return;
      const target = document.querySelector(id);
      if (!target) return;
      e.preventDefault();
      const y = window.scrollY + target.getBoundingClientRect().top - offset();
      window.scrollTo({ top: y, behavior: 'smooth' });
      setOpen(false);
    });
  });
})();
