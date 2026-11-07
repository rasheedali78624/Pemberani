// Edition 3.0 motion layer: one passive scroll loop drives CSS variables,
// IntersectionObserver drives reveals. No animation library needed.

import { t } from './i18n.js';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
export const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const finePointer = matchMedia('(hover: hover) and (pointer: fine)').matches;

// ── Reveals ──────────────────────────────────────────────────
export function observeReveals(root = document) {
  const io = new IntersectionObserver(entries => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      e.target.classList.add('in');
      e.target.dispatchEvent(new CustomEvent('reveal'));
      io.unobserve(e.target);
    }
  }, { rootMargin: '0px 0px -12% 0px', threshold: 0.05 });
  $$('[data-reveal], .ln[data-reveal-self], .def-grid, .podium', root).forEach(el => {
    io.observe(el);
  });
  // count-up numbers
  $$('[data-count]', root).forEach(el => {
    const to = +el.dataset.count, pad = el.dataset.pad ? +el.dataset.pad : 2;
    const fmt = n => String(Math.round(n)).padStart(pad, '0');
    if (reduced) { el.textContent = fmt(to); return; }
    el.textContent = fmt(0);
    const run = () => {
      const t0 = performance.now(), dur = 1400;
      const step = t => {
        const k = clamp((t - t0) / dur);
        el.textContent = fmt(to * (1 - Math.pow(1 - k, 4)));
        if (k < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    };
    const o = new IntersectionObserver(([e]) => { if (e.isIntersecting) { run(); o.disconnect(); } }, { threshold: .4 });
    o.observe(el);
  });
}

// ── Scroll loop ──────────────────────────────────────────────
// Kept deliberately cheap so phones scroll smoothly:
//  - the progress bar and back-to-top ring are updated directly (no page-wide CSS variable)
//  - on touch screens there is no per-frame parallax; sections animate when they come
//    into view instead, and the marquee bands run on a CSS loop
//  - on desktop, [data-scene] gets --p (0 → 1 as it passes) and bands follow the scroll
export const touch = matchMedia('(hover: none), (pointer: coarse)').matches;
if (touch) document.documentElement.classList.add('touch');

export function startScroll({ onScroll } = {}) {
  const scrub = !reduced && !touch;
  const scenes = scrub ? $$('[data-scene]') : [];
  const bands = scrub ? $$('.band .track') : [];
  const pins = $$('[data-pin]');
  const bar = $('.progress i');
  const ring = $('.to-top .ring circle');
  const root = document.documentElement;
  let ticking = false, lastY = scrollY, lastP = -1;

  const update = () => {
    ticking = false;
    const vh = innerHeight, y = scrollY;
    const max = root.scrollHeight - vh;
    const sp = max > 0 ? Math.round(y / max * 500) / 500 : 0;
    if (sp !== lastP) {
      lastP = sp;
      if (bar) bar.style.transform = `scaleX(${sp})`;
      if (ring) ring.style.strokeDashoffset = String(163 - 163 * sp);
    }
    for (const el of scenes) {
      const r = el.getBoundingClientRect();
      if (r.bottom < 0 || r.top > vh) continue;
      el.style.setProperty('--p', clamp((vh - r.top) / (r.height + vh)).toFixed(3));
    }
    bands.forEach((t, i) => {
      const w = t.scrollWidth / 2 || 1;
      const off = (y * 0.45) % w;
      t.style.transform = `translate3d(${i % 2 ? off - w : -off}px,0,0)`;
    });
    for (const el of pins) {
      const r = el.getBoundingClientRect();
      if (r.bottom < -vh || r.top > vh) continue;
      const p = clamp(-r.top / Math.max(1, r.height - vh));
      if (scrub) el.style.setProperty('--p', p.toFixed(3));
      const n = +el.dataset.steps || 1;
      const phase = Math.min(n - 1, Math.floor(p * n * 0.999));
      if (el.dataset.phase !== String(phase)) {
        el.dataset.phase = phase;
        el.dispatchEvent(new CustomEvent('phase', { detail: phase }));
      }
    }
    onScroll?.(y, y - lastY);
    lastY = y;
  };
  const req = () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } };
  addEventListener('scroll', req, { passive: true });
  addEventListener('resize', req);
  update();
  return req;
}

// ── Pinned statement: phases → line classes ──────────────────
export function wireStatement(sec) {
  if (!sec) return;
  const lines = $$('.st', sec);
  const ticks = $$('.meter i', sec);
  const set = n => {
    lines.forEach((l, i) => { l.classList.toggle('on', i === n); l.classList.toggle('past', i < n); });
    ticks.forEach((t, i) => t.classList.toggle('on', i <= n));
  };
  sec.addEventListener('phase', e => set(e.detail));
  set(+sec.dataset.phase || 0);
}

// ── Nav: solid after hero, hides on scroll down, active link ──
export function wireNav() {
  const nav = $('.nav');
  if (!nav) return;
  const hero = $('.hero') || $('.live-hero');
  const links = $$('.nav-links a[href^="#"], .menu a[href^="#"], .tabbar a[href^="#"]');
  const tabbar = $('.tabbar');
  const targets = links.map(a => $(a.getAttribute('href'))).filter(Boolean);
  let travel = 0, hidden = false;
  const onScroll = (y, dy) => {
    const heroH = hero ? hero.offsetHeight * 0.6 : 80;
    nav.classList.toggle('solid', y > 40);
    // hysteresis: hide only after ~40px of deliberate downward scrolling, show after ~20px up
    // (iPhone momentum/bounce produces tiny back-and-forth deltas that made the bar flicker)
    if (Math.sign(dy) !== Math.sign(travel)) travel = 0;
    travel += dy;
    if (travel > 40) hidden = true;
    if (travel < -20 || y < heroH) hidden = false;
    nav.classList.toggle('hidden', !document.body.classList.contains('menu-open') && hidden);
    // active section
    // the section whose top most recently passed 40% of the screen
    let cur = null, best = -Infinity;
    for (const t of targets) {
      const top = t.getBoundingClientRect().top;
      if (top < innerHeight * 0.4 && top > best) { best = top; cur = t.id; }
    }
    links.forEach(a => a.classList.toggle('active', a.getAttribute('href') === '#' + cur));
    $('.to-top')?.classList.toggle('show', y > innerHeight * 1.2);
    if (tabbar && !tabbar.classList.contains('always')) tabbar.classList.toggle('show', y > heroH * 0.5);
    document.body.classList.toggle('tabbar-on', !!tabbar && (tabbar.classList.contains('always') || tabbar.classList.contains('show')));
  };
  // mobile menu
  const btn = $('.menu-btn');
  const menu = $('.menu');
  const close = () => { document.body.classList.remove('menu-open'); btn?.setAttribute('aria-expanded', 'false'); menu?.setAttribute('aria-hidden', 'true'); };
  btn?.addEventListener('click', () => {
    const open = !document.body.classList.contains('menu-open');
    document.body.classList.toggle('menu-open', open);
    btn.setAttribute('aria-expanded', String(open));
    menu?.setAttribute('aria-hidden', String(!open));
  });
  $$('.menu a').forEach(a => a.addEventListener('click', close));
  addEventListener('keydown', e => { if (e.key === 'Escape') close(); });
  $('.to-top')?.addEventListener('click', () => scrollTo({ top: 0, behavior: reduced ? 'auto' : 'smooth' }));
  return onScroll;
}

// ── Custom cursor (desktop only) ─────────────────────────────
export function wireCursor() {
  if (!finePointer || reduced) return;
  const dot = document.createElement('div'); dot.className = 'cursor';
  const ring = document.createElement('div'); ring.className = 'cursor-ring';
  document.body.append(dot, ring);
  document.body.classList.add('has-cursor');
  let x = -100, y = -100, rx = -100, ry = -100;
  addEventListener('pointermove', e => { x = e.clientX; y = e.clientY; dot.style.transform = `translate(${x}px,${y}px)`; }, { passive: true });
  const loop = () => {
    rx += (x - rx) * 0.18; ry += (y - ry) * 0.18;
    ring.style.transform = `translate(${rx}px,${ry}px)`;
    requestAnimationFrame(loop);
  };
  loop();
  const hot = 'a, button, [role="tab"], .pair, .bm, .g-item, .names span';
  document.addEventListener('pointerover', e => ring.classList.toggle('hover', !!e.target.closest(hot)));
  document.addEventListener('pointerleave', () => { dot.classList.add('hide'); ring.classList.add('hide'); });
  document.addEventListener('pointerenter', () => { dot.classList.remove('hide'); ring.classList.remove('hide'); });
}

// ── Magnetic buttons ─────────────────────────────────────────
export function wireMagnetic() {
  if (!finePointer || reduced) return;
  $$('.magnetic').forEach(el => {
    el.addEventListener('pointermove', e => {
      const r = el.getBoundingClientRect();
      const dx = (e.clientX - r.left - r.width / 2) / r.width;
      const dy = (e.clientY - r.top - r.height / 2) / r.height;
      el.style.transform = `translate(${dx * 14}px, ${dy * 12}px)`;
    });
    el.addEventListener('pointerleave', () => { el.style.transform = ''; });
  });
}

// ── Countdown ────────────────────────────────────────────────
export function wireCountdown(el, iso, endIso) {
  if (!el || !iso) return;
  const target = new Date(iso).getTime();
  const end = endIso ? new Date(endIso).getTime() : target + 7 * 3600e3;
  let cells = {};
  const build = () => {
    const parts = { d: t('days'), h: t('hrs'), m: t('min'), s: t('sec') };
    el.innerHTML = Object.entries(parts).map(([k, l]) => `<span><b data-k="${k}">00</b><i>${l}</i></span>`).join('');
    cells = Object.fromEntries($$('b', el).map(b => [b.dataset.k, b]));
  };
  let timer;
  const tick = () => {
    clearTimeout(timer);
    const now = Date.now();
    if (now >= target) {
      el.innerHTML = now < end
        ? `<span><b style="color:var(--y)">${t('live').toUpperCase()}</b><i>${t('happening')}</i></span>`
        : `<span><b>${t('ft').toUpperCase()}</b><i>${t('seeYou')}</i></span>`;
      return;
    }
    let t = Math.floor((target - now) / 1000);
    const v = { d: Math.floor(t / 86400), h: Math.floor(t % 86400 / 3600), m: Math.floor(t % 3600 / 60), s: t % 60 };
    for (const k in v) {
      const s = String(v[k]).padStart(2, '0');
      if (cells[k].textContent !== s) {
        cells[k].textContent = s;
        if (!reduced) { cells[k].classList.remove('tick'); void cells[k].offsetWidth; cells[k].classList.add('tick'); }
      }
    }
    timer = setTimeout(tick, 1000 - (Date.now() % 1000));
  };
  build();
  tick();
  addEventListener('langchange', () => { build(); tick(); });
}

// ── Drag-to-scroll (gallery / bracket on desktop) ────────────
export function dragScroll(el) {
  if (!el) return;
  let down = false, sx = 0, sl = 0, moved = false;
  el.addEventListener('pointerdown', e => {
    if (e.pointerType !== 'mouse') return;
    down = true; moved = false; sx = e.clientX; sl = el.scrollLeft; el.classList.add('drag');
  });
  addEventListener('pointermove', e => {
    if (!down) return;
    const dx = e.clientX - sx;
    if (Math.abs(dx) > 3) moved = true;
    el.scrollLeft = sl - dx;
  });
  addEventListener('pointerup', () => { down = false; el.classList.remove('drag'); });
  el.addEventListener('click', e => { if (moved) { e.preventDefault(); e.stopPropagation(); } }, true);
}

// Optional photos: hide <img> and show the art-directed fallback if missing.
export function optionalImages(root = document) {
  $$('.photo img', root).forEach(img => {
    const box = img.closest('.photo');
    const fail = () => box.classList.add('missing');
    if (img.complete && img.naturalWidth === 0 && img.getAttribute('src')) fail();
    img.addEventListener('error', fail);
  });
}
