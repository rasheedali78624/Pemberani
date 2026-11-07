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
  (names.closest('.pot') || names).addEventListener('reveal', () => {
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

function buildGallery() {
  const track = $('#gTrack');
  if (!track || !GALLERY_COUNT) return;
  const list = Array.from({ length: GALLERY_COUNT }, (_, i) => `assets/e3/gallery-${String(i + 1).padStart(2, '0')}.jpg`);
  track.innerHTML = list.map(src => `<figure class="g-item" style="margin:0"><img src="${src}" alt="Pemberani tournament moment" loading="lazy" draggable="false"></figure>`).join('');
  $('#gallery').hidden = false;
  dragScroll(track);
}

// Boot
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
