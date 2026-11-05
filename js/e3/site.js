// Edition 3.0 homepage wiring.
import {
  observeReveals, startScroll, wireStatement, wireNav, wireCursor, wireMagnetic, wireCountdown,
  dragScroll, optionalImages, reduced,
} from './motion.js';
import { mountLive } from './live.js';
import { TOURNAMENT, ROSTER, PHOTOS, GALLERY_COUNT } from '../config.js';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// Registered players wall
const names = $('#names');
if (names) {
  names.innerHTML = ROSTER.map(n => n ? `<span>${esc(n)}</span>` : '<span class="open">Open slot</span>').join('');
  $('#rosterCount').textContent = ROSTER.length;
  if (!reduced) {
    // a slow "spotlight" that wanders across the names once revealed
    const spans = $$('span:not(.open)', names);
    names.addEventListener('reveal', () => {
      let i = 0;
      const step = () => {
        spans.forEach(s => s.classList.remove('lit'));
        spans[i % spans.length].classList.add('lit');
        i += 5;
      };
      setInterval(step, 900);
    });
  }
}

// Format road: line fills as the section scrolls through, stages light up
const format = $('#format');
const road = $('#road');
const stages = road ? $$('.stage', road) : [];
const onScrollExtra = () => {
  if (!format || !road) return;
  const r = road.getBoundingClientRect();
  const vh = innerHeight;
  const p = Math.min(1, Math.max(0, (vh * 0.75 - r.top) / (r.height + vh * 0.2)));
  road.style.setProperty('--rp', reduced ? 1 : p.toFixed(3));
  const vertical = matchMedia('(max-width: 860px)').matches;
  stages.forEach((s, i) => {
    const at = vertical ? i / (stages.length - 1) * 0.92 : i / (stages.length - 1) * 0.95;
    s.classList.toggle('lit', reduced || p >= at);
  });
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
