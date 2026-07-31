/* ── LANDING HELPMEET v2 — scripts ── */
gsap.registerPlugin(ScrollTrigger, ScrollToPlugin);
const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ── Loader ── */
window.addEventListener('load', () => {
  setTimeout(() => document.getElementById('loader').classList.add('hide'), 260);
});

/* ── Theme toggle ── */
(function () {
  const btn = document.getElementById('themeToggle');
  const root = document.documentElement;
  const meta = document.querySelector('meta[name="theme-color"]');
  const colors = { dark: '#26201b', light: '#f4f7f5' };

  function apply(theme) {
    root.dataset.theme = theme;
    if (meta) meta.setAttribute('content', colors[theme] || colors.dark);
    try { localStorage.setItem('helpmeet-theme', theme); } catch (e) { /* storage unavailable */ }
  }

  if (btn) {
    btn.addEventListener('click', () => {
      apply(root.dataset.theme === 'light' ? 'dark' : 'light');
    });
  }
})();

/* ── Spotlight + Cursor ring ── */
(function () {
  const spotlight = document.getElementById('spotlight');
  const ring = document.getElementById('cursorRing');
  if (!spotlight && !ring) return;
  if (!window.matchMedia('(pointer:fine)').matches || prefersReduced) return;

  let mx = 0, my = 0, sx = 0, sy = 0, rx = 0, ry = 0, running = false, firstMove = true;

  function tick() {
    sx += (mx - sx) * 0.16; sy += (my - sy) * 0.16;
    if (spotlight) { spotlight.style.setProperty('--mx', sx + 'px'); spotlight.style.setProperty('--my', sy + 'px'); }
    rx += (mx - rx) * 0.28; ry += (my - ry) * 0.28;
    if (ring) {
      const size = ring.classList.contains('grow') ? 72 : ring.classList.contains('click') ? 26 : 38;
      ring.style.transform = `translate3d(${rx - size / 2}px, ${ry - size / 2}px, 0)`;
    }
    if (Math.abs(mx - sx) > 0.4 || Math.abs(my - sy) > 0.4 || Math.abs(mx - rx) > 0.4 || Math.abs(my - ry) > 0.4) {
      requestAnimationFrame(tick);
    } else { running = false; }
  }

  window.addEventListener('pointermove', e => {
    mx = e.clientX; my = e.clientY;
    if (firstMove) { sx = mx; sy = my; rx = mx; ry = my; if (ring) ring.classList.add('visible'); firstMove = false; }
    if (!running) { running = true; requestAnimationFrame(tick); }
  }, { passive: true });
  window.addEventListener('pointerleave', () => { if (ring) ring.classList.remove('visible'); });
  window.addEventListener('pointerenter', () => { if (ring && !firstMove) ring.classList.add('visible'); });

  if (ring) {
    const growSel = 'a, button, input[type="range"], label, [role="button"], [role="tab"], .faq-q, .plan, .model-card';
    document.addEventListener('pointerover', e => { if (e.target.closest && e.target.closest(growSel)) ring.classList.add('grow'); }, { passive: true });
    document.addEventListener('pointerout', e => { if (e.target.closest && e.target.closest(growSel)) ring.classList.remove('grow'); }, { passive: true });
    document.addEventListener('pointerdown', () => ring.classList.add('click'), { passive: true });
    document.addEventListener('pointerup', () => ring.classList.remove('click'), { passive: true });
  }
})();

/* ── Hero entrance ── */
if (!prefersReduced) {
  const heroTl = gsap.timeline({ defaults: { ease: 'power3.out' }, delay: .2 });
  heroTl
    .from('.hero-eyebrow', { y: 14, opacity: 0, duration: .5 })
    .from('.hero-title',   { y: 22, opacity: 0, duration: .65 }, '-=.25')
    .from('.hero-lead',    { y: 18, opacity: 0, duration: .55 }, '-=.4')
    .from('.hero-desc',    { y: 16, opacity: 0, duration: .5 },  '-=.35')
    .from('.hero-actions', { y: 16, opacity: 0, duration: .5 },  '-=.3')
    .from('.hero-micro',   { y: 12, opacity: 0, duration: .45 }, '-=.3')
    .from('#heroApp',      { y: 40, opacity: 0, duration: .7, ease: 'power3.out' }, '-=.3')
    .from('.hero-ring',    { scale: .85, opacity: 0, duration: 1.1, ease: 'power2.out' }, 0)
    .from('.hero-ring.r2', { scale: .8,  opacity: 0, duration: 1.15 }, 0.05)
    .from('.hero-ring.r3', { scale: .75, opacity: 0, duration: 1.2 }, 0.1)
    .from('.hero-orb',     { scale: .6,  opacity: 0, duration: 1.1 }, 0);
}

/* ── Hero parallax ── */
if (!prefersReduced) {
  gsap.to('.hero-ring', { yPercent: 22, ease: 'none', scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: 1 } });
  gsap.to('.hero-ring.r2', { yPercent: 14, ease: 'none', scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: 1.3 } });
  gsap.to('.hero-ring.r3', { yPercent: 8, ease: 'none', scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: 1.6 } });
  gsap.to('.hero-orb', { yPercent: 26, ease: 'none', scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: 1.8 } });
  gsap.to('.hero-grid', { yPercent: 10, opacity: .55, ease: 'none', scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: 1 } });
  gsap.to('#appWrap', { rotateX: 0, y: -20, ease: 'none', scrollTrigger: { trigger: '#heroApp', start: 'top 90%', end: 'top 30%', scrub: 1 } });
}

/* ── Nav scroll state ── */
ScrollTrigger.create({ start: 40, end: 99999, toggleClass: { targets: '#nav', className: 'scrolled' } });

/* ── Stat counters ── */
document.querySelectorAll('[data-target]').forEach(el => {
  const target = +el.dataset.target;
  ScrollTrigger.create({
    trigger: el, start: 'top 85%', once: true,
    onEnter: () => {
      gsap.to({ v: 0 }, { v: target, duration: 1.6, ease: 'power2.out', onUpdate() { el.textContent = Math.round(this.targets()[0].v); } });
    }
  });
});

/* ── Section heads ── */
gsap.utils.toArray('.sec-head').forEach(head => {
  gsap.from(head.children, { y: 40, opacity: 0, duration: .8, ease: 'power3.out', stagger: .15, scrollTrigger: { trigger: head, start: 'top 82%' } });
});

/* ── How it works ── */
const steps = document.querySelectorAll('#howSteps .how-step');
const frames = document.querySelectorAll('.how-viz-frame');
function setActive(idx) { steps.forEach((s, i) => s.classList.toggle('active', i === idx)); frames.forEach((f, i) => f.classList.toggle('on', i === idx)); }
steps.forEach((s, i) => {
  ScrollTrigger.create({ trigger: s, start: 'top 60%', end: 'bottom 60%', onEnter: () => setActive(i), onEnterBack: () => setActive(i) });
  s.addEventListener('click', () => setActive(i));
});

/* ── Bento features — lightweight reveal + mobile swipe ── */
(function initBento() {
  const section = document.querySelector('.features-section');
  const bento = document.getElementById('bento');
  if (!section || !bento) return;

  const cards = Array.from(bento.querySelectorAll('.b'));
  const bg = section.querySelector('.features-bg');
  if (bg) bg.style.opacity = 1;

  const isMobile = window.matchMedia('(max-width:640px)').matches;

  /* Reduced motion or no observer: show everything immediately */
  if (prefersReduced || !('IntersectionObserver' in window)) {
    cards.forEach(c => c.classList.add('in'));
  } else if (isMobile) {
    /* Horizontal carousel: cards scroll off-screen sideways, so reveal the
       whole set when the SECTION enters view (per-card viewport intersection
       would leave off-screen cards stuck at opacity 0). */
    cards.forEach((card, i) => card.style.setProperty('--b-delay', Math.min(i, 4) * 55 + 'ms'));
    const io = new IntersectionObserver((entries) => {
      if (entries.some(e => e.isIntersecting)) {
        cards.forEach(c => c.classList.add('in'));
        io.disconnect();
      }
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.05 });
    io.observe(section);
  } else {
    /* Desktop grid: cheap per-card fade-up as each scrolls in */
    cards.forEach((card, i) => card.style.setProperty('--b-delay', (i % 3) * 60 + 'ms'));
    const io = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('in');
          io.unobserve(entry.target);
        }
      });
    }, { rootMargin: '0px 0px -12% 0px', threshold: 0.15 });
    cards.forEach(card => io.observe(card));
  }
  /* Absolute safety net: never leave cards invisible */
  setTimeout(() => cards.forEach(c => c.classList.add('in')), 2500);

  /* Mobile swipe progress dots */
  const dotsWrap = document.getElementById('bentoDots');
  if (dotsWrap && window.matchMedia('(max-width:640px)').matches) {
    cards.forEach((card, i) => {
      const dot = document.createElement('button');
      dot.type = 'button';
      dot.className = 'bento-dot';
      dot.setAttribute('aria-label', 'Ir a la característica ' + (i + 1));
      dot.addEventListener('click', () => {
        bento.scrollTo({ left: card.offsetLeft - bento.offsetLeft, behavior: 'smooth' });
      });
      dotsWrap.appendChild(dot);
    });
    const dots = Array.from(dotsWrap.children);
    const setActive = () => {
      const center = bento.scrollLeft + bento.clientWidth / 2;
      let idx = 0, best = Infinity;
      cards.forEach((card, i) => {
        const cardCenter = card.offsetLeft - bento.offsetLeft + card.clientWidth / 2;
        const d = Math.abs(cardCenter - center);
        if (d < best) { best = d; idx = i; }
      });
      dots.forEach((d, i) => d.classList.toggle('on', i === idx));
    };
    setActive();
    let raf = 0;
    bento.addEventListener('scroll', () => {
      if (!raf) raf = requestAnimationFrame(() => { raf = 0; setActive(); });
    }, { passive: true });
  }
})();

/* ── Cost savings ── */
gsap.from('#costSection', { y: 60, opacity: 0, duration: 1, ease: 'power3.out', scrollTrigger: { trigger: '#costSection', start: 'top 78%' } });

/* ── Model comparison ── */
gsap.from('#modelGrid .model-card', { y: 50, opacity: 0, duration: .8, stagger: .15, ease: 'power3.out', scrollTrigger: { trigger: '#modelGrid', start: 'top 78%' } });

/* ── Quote ── */
gsap.from('#quote .quote-text', { y: 30, opacity: 0, duration: 1, ease: 'power3.out', scrollTrigger: { trigger: '#quote', start: 'top 78%' } });
gsap.from('#quote .quote-mark', { scale: .3, opacity: 0, duration: 1.1, ease: 'power4.out', scrollTrigger: { trigger: '#quote', start: 'top 80%' } });

/* ── Pricing ── */
gsap.from('#pricingGrid .plan', { y: 60, opacity: 0, duration: .8, stagger: .14, ease: 'power3.out', scrollTrigger: { trigger: '#pricingGrid', start: 'top 78%' } });

/* ── FAQ ── */
document.querySelectorAll('#faqList .faq').forEach(f => {
  const q = f.querySelector('.faq-q'), a = f.querySelector('.faq-a');
  q.addEventListener('click', () => {
    const isOpen = f.classList.contains('open');
    document.querySelectorAll('#faqList .faq').forEach(x => { x.classList.remove('open'); x.querySelector('.faq-a').style.maxHeight = '0px'; });
    if (!isOpen) { f.classList.add('open'); a.style.maxHeight = a.scrollHeight + 40 + 'px'; }
  });
});
gsap.from('#faqList .faq', { y: 25, opacity: 0, duration: .55, stagger: .08, ease: 'power3.out', scrollTrigger: { trigger: '#faqList', start: 'top 82%' } });

/* ── Final CTA ── */
gsap.fromTo('#finalCta h2, #finalCta p, #finalCta .cta-sub', { y: 30, opacity: 0 }, { y: 0, opacity: 1, duration: .8, stagger: .12, ease: 'power3.out', scrollTrigger: { trigger: '#finalCta', start: 'top 85%', once: true } });
gsap.fromTo('#finalCta .cta-mega', { opacity: 0, scale: .96 }, { opacity: 1, scale: 1, duration: .7, ease: 'power3.out', delay: .25, clearProps: 'scale', scrollTrigger: { trigger: '#finalCta', start: 'top 85%', once: true } });
gsap.to('#finalCta .final-glow', { scale: 1.15, opacity: .8, duration: 3, yoyo: true, repeat: -1, ease: 'sine.inOut' });

/* ── Smooth nav ── */
document.querySelectorAll('a[href^="#"]').forEach(a => {
  a.addEventListener('click', e => {
    const id = a.getAttribute('href');
    if (id.length > 1 && document.querySelector(id)) { e.preventDefault(); gsap.to(window, { duration: .9, scrollTo: { y: id, offsetY: 60 }, ease: 'power3.inOut' }); }
  });
});

/* ── Refresh on load ── */
window.addEventListener('load', () => { setTimeout(() => ScrollTrigger.refresh(), 350); });
