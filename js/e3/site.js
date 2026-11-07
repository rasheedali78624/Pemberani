// Edition 3.0 homepage wiring.
import {
  observeReveals, startScroll, wireStatement, wireNav, wireCursor, wireMagnetic, wireCountdown,
  dragScroll, optionalImages, reduced,
} from './motion.js';
import { mountLive } from './live.js';
import { wireLang, t } from './i18n.js';
import { TOURNAMENT, POTS, PHOTOS, GALLERY_COUNT } from '../config.js';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// Language first, so everything below renders in the right one
wireLang();

// The two pots: Pot A with each player's titles, Pot B as a wall of names
const potA = $('#potA');
const names = $('#potB');
const titleText = ([place, ed]) => `${t(place === 1 ? 'champ' : place === 2 ? 'ru' : 'third')} ${ed}`;
function renderPots() {
  if (potA) potA.innerHTML = POTS.A.map(p => `<div class="seed">
      <span class="sn">${esc(p.name)}</span>
      <span class="chips">${p.titles.map(tt => `<span class="chip c${tt[0]}">${esc(titleText(tt))}</span>`).join('')}</span>
    </div>`).join('');
  if (names) names.innerHTML = POTS.B.map(p => `<span>${esc(p.name)}</span>`).join('');
}
renderPots();
addEventListener('langchange', renderPots);
if (names && !reduced) {
  // a slow spotlight that wanders across the names once they are on screen
  (names.closest('.pot') || names).addEventListener('reveal', function start() {
    this.removeEventListener('reveal', start);
    let i = 0;
    setInterval(() => {
      const spans = $$('span:not(.open)', names);
      spans.forEach(s => s.classList.remove('lit'));
      spans[i % spans.length]?.classList.add('lit');
      i += 5;
    }, 900);
  });
}

// Format road: line fills as the section scrolls through, stages light up
const road = $('#road');
const stages = road ? $$('.stage', road) : [];
let lastRp = -1;
const onScrollExtra = () => {
  if (!road) return;
  const r = road.getBoundingClientRect();
  const vh = innerHeight;
  if (r.bottom < -vh || r.top > vh * 1.5) return;
  const p = Math.round(Math.min(1, Math.max(0, (vh * 0.75 - r.top) / (r.height + vh * 0.2))) * 100) / 100;
  if (p === lastRp) return;
  lastRp = p;
  road.style.setProperty('--rp', p);
  stages.forEach((s, i) => s.classList.toggle('lit', p >= i / (stages.length - 1) * 0.92));
};

// Uploaded photos (listed in config.js) replace the built-in artwork.
function usePhotos() {
  $$('img[data-photo]').forEach(img => {
    if (!PHOTOS.includes(img.dataset.photo)) return;
    img.src = `assets/e3/${img.dataset.photo}.jpg`;
    img.closest('.photo')?.classList.remove('missing');
  });
}

// Gallery: the known photos, then any further gallery-NN.jpg found in order (stops at the first gap)
async function buildGallery() {
  const track = $('#gTrack');
  if (!track) return;
  const src = n => `assets/e3/gallery-${String(n).padStart(2, '0')}.jpg`;
  const item = s => `<figure class="g-item" style="margin:0"><img src="${s}" alt="Pemberani tournament moment" loading="lazy" draggable="false"></figure>`;
  const exists = s => new Promise(ok => { const i = new Image(); i.onload = () => ok(true); i.onerror = () => ok(false); i.src = s; });
  let n = 0;
  const known = [];
  while (n < GALLERY_COUNT) known.push(src(++n));
  if (known.length) { track.innerHTML = known.map(item).join(''); $('#gallery').hidden = false; dragScroll(track); }
  // look for newly uploaded photos once the page has settled
  await new Promise(r => setTimeout(r, 1500));
  while (n < 60 && await exists(src(n + 1))) {
    n++;
    track.insertAdjacentHTML('beforeend', item(src(n)));
    if ($('#gallery').hidden) { $('#gallery').hidden = false; dragScroll(track); }
  }
}

// Champions: rotate Edition 2.0 ⇄ 1.0 every 3 s while on screen; tap 1.0 / 2.0 to choose
const CHAMP_MS = 3000;
function wireChampions() {
  const box = $('[data-champs]');
  if (!box) return;
  const order = ['e2', 'e1'];
  let cur = 'e2', timer = null, visible = false, pausedUntil = 0;
  const show = id => {
    cur = id;
    $$('[data-slide]', box).forEach(el => {
      const on = el.dataset.slide === id;
      el.classList.toggle('on', on);
      el.setAttribute('aria-hidden', String(!on));
      if (on) el.querySelectorAll('.ln, [data-reveal]').forEach(x => x.classList.add('in'));
    });
    $$('.hof-b', box).forEach(btn => {
      const on = btn.dataset.show === id;
      btn.classList.toggle('on', on);
      btn.setAttribute('aria-pressed', String(on));
      // restart the progress bar on the active edition
      const bar = btn.querySelector('.bar');
      bar.classList.remove('run'); void bar.offsetWidth;
      if (on && running()) bar.classList.add('run');
    });
  };
  const running = () => !reduced && visible && Date.now() >= pausedUntil;
  const tick = () => {
    clearTimeout(timer);
    if (!running()) { $$('.hof-b .bar', box).forEach(b => b.classList.remove('run')); return; }
    timer = setTimeout(() => { show(order[(order.indexOf(cur) + 1) % order.length]); tick(); }, CHAMP_MS);
  };
  $$('.hof-b', box).forEach(btn => btn.addEventListener('click', () => {
    pausedUntil = Date.now() + 12000;           // a tap holds that edition for 12 s
    show(btn.dataset.show); tick();
    setTimeout(() => { show(cur); tick(); }, 12050);
  }));
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; show(cur); tick(); }, { threshold: 0.35 }).observe(box);
  document.addEventListener('visibilitychange', () => { visible = visible && !document.hidden; tick(); });
}

// Boot
wireChampions();
usePhotos();
optionalImages();
observeReveals();
wireStatement($('#statement'));
const navScroll = wireNav();
startScroll({ onScroll: (y, dy) => { navScroll?.(y, dy); onScrollExtra(); } });
wireCursor();
wireMagnetic();
wireCountdown($('#countdown'), TOURNAMENT.startsAt, TOURNAMENT.endsAt);
dragScroll($('#bracketScroll'));
buildGallery();
mountLive();
