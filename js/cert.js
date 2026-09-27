// E-certificate generator: draws the recipient's name onto the right
// certificate template in the browser and offers it as PDF or image.
// Nothing is uploaded or stored anywhere.

import { GROUPS } from './config.js';

// Final standings → which certificate each pair receives.
const AWARDS = {
  g2p2: 'champions',   // Pok & Daus
  g1p3: 'runners-up',  // Sol & Aizat
  g1p5: 'third',       // Paul & Jai
};
const KINDS = {
  participation: { title: 'Certificate of Participation', note: 'Thanks for playing in Edition 2.0.', color: '#e3b341' },
  champions: { title: 'Certificate of Achievement · Champions', note: 'Gold seal: 1st place.', color: 'radial-gradient(circle at 35% 30%, #fff4c2, #e3b341 55%, #7d5a0e)' },
  'runners-up': { title: 'Certificate of Achievement · Runners-up', note: 'Silver seal: 2nd place.', color: 'radial-gradient(circle at 35% 30%, #fff, #c9ccd2 55%, #5f636b)' },
  third: { title: 'Certificate of Achievement · Third Place', note: 'Bronze seal: 3rd place.', color: 'radial-gradient(circle at 35% 30%, #ffe2c4, #c8814a 55%, #6a3a14)' },
};

// Where the name sits on the 3508 × 2480 template (A4 at 300 dpi).
const NAME = { cx: 1754, cy: 1110, maxWidth: 2000, size: 224, minSize: 110 };

const $ = s => document.querySelector(s);
const canvas = $('#cert');
const ctx = canvas.getContext('2d');
const templates = {};

function toast(msg) {
  const t = $('#toast');
  t.textContent = msg; t.classList.add('show');
  clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('show'), 2400);
}

// "MOHD FAREEZ BIN SUHAILI" or "mohd fareez bin suhaili" → "Mohd Fareez bin Suhaili".
// Mixed-case input is left exactly as typed.
const PARTICLES = new Set(['bin', 'binti', 'bt', 'bte', 'a/l', 'a/p']);
function tidyName(raw) {
  const s = raw.replace(/\s+/g, ' ').trim();
  if (s !== s.toUpperCase() && s !== s.toLowerCase()) return s;
  return s.toLowerCase().split(' ')
    .map((w, i) => (i > 0 && PARTICLES.has(w) ? w : w.replace(/(^|[-'’])(\p{L})/gu, (_, p, c) => p + c.toUpperCase())))
    .join(' ');
}

function loadTemplate(kind) {
  templates[kind] ||= new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = `assets/cert/${kind}.jpg`;
  });
  return templates[kind];
}

function currentKind() {
  return AWARDS[$('#pair').value] || 'participation';
}

let drawSeq = 0;
let latest = Promise.resolve();
// Every change triggers a redraw; only the newest one paints.
function draw() {
  latest = paint(++drawSeq);
  return latest;
}
// Resolves once the most recent redraw has finished (used before exporting).
async function settled() {
  let p;
  do { p = latest; await p; } while (p !== latest);
}

async function paint(seq) {
  const kind = currentKind();
  $('#busy').classList.add('on');
  const [img] = await Promise.all([loadTemplate(kind), document.fonts.load(`${NAME.size}px "Great Vibes"`)]);
  if (seq !== drawSeq) return;
  $('#busy').classList.remove('on');

  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  const name = tidyName($('#name').value);
  if (!name) return;

  let size = NAME.size;
  ctx.font = `${size}px "Great Vibes"`;
  while (ctx.measureText(name).width > NAME.maxWidth && size > NAME.minSize) {
    size -= 4;
    ctx.font = `${size}px "Great Vibes"`;
  }
  const grad = ctx.createLinearGradient(0, NAME.cy - size * 0.55, 0, NAME.cy + size * 0.45);
  grad.addColorStop(0, '#c99a2e');
  grad.addColorStop(0.55, '#a47a1c');
  grad.addColorStop(1, '#7c5a10');
  ctx.fillStyle = grad;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(name, NAME.cx, NAME.cy, size <= NAME.minSize ? NAME.maxWidth : undefined);
}

function updateUi() {
  const pair = $('#pair').value;
  const ready = pair && tidyName($('#name').value).length >= 3;
  ['#pdfBtn', '#imgBtn', '#shareBtn'].forEach(id => { $(id).disabled = !ready; });
  const k = KINDS[currentKind()];
  $('#award').style.setProperty('--c', pair ? k.color : '#3a3a3e');
  $('#award div').innerHTML = pair
    ? `<b>${k.title}</b><small>${k.note}</small>`
    : '<b>Choose your pair</b><small>We\'ll pick the right certificate for you.</small>';
}

const fileBase = () => `Pemberani-2.0-E-Certificate-${tidyName($('#name').value).replace(/[^\p{L}\p{N}]+/gu, '-')}`;
const jpegBlob = () => new Promise(res => canvas.toBlob(res, 'image/jpeg', 0.92));

function saveBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement('a'), { href: url, download: filename });
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

async function pdfBlob() {
  const { jsPDF } = window.jspdf;
  const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  pdf.addImage(canvas.toDataURL('image/jpeg', 0.92), 'JPEG', 0, 0, 297, 210);
  pdf.setProperties({ title: `Pemberani 2.0 E-Certificate — ${tidyName($('#name').value)}` });
  return pdf.output('blob');
}

async function withBusy(fn) {
  $('#busy').textContent = 'Preparing…'; $('#busy').classList.add('on');
  try { draw(); await settled(); await fn(); } catch (e) { console.error(e); toast('Something went wrong, please try again.'); }
  finally { $('#busy').classList.remove('on'); }
}

$('#pdfBtn').onclick = () => withBusy(async () => { saveBlob(await pdfBlob(), fileBase() + '.pdf'); toast('Certificate downloaded'); });
$('#imgBtn').onclick = () => withBusy(async () => { saveBlob(await jpegBlob(), fileBase() + '.jpg'); toast('Image saved'); });
$('#shareBtn').onclick = () => withBusy(async () => {
  const file = new File([await jpegBlob()], fileBase() + '.jpg', { type: 'image/jpeg' });
  try { await navigator.share({ files: [file], title: 'My Pemberani 2.0 certificate' }); } catch {}
});

// Pair list from the tournament config, grouped like the site.
$('#pair').innerHTML = '<option value="">Select your pair…</option>' + GROUPS.map(g =>
  `<optgroup label="${g.name}">${g.pairs.map(p => `<option value="${p.id}">${p.name}</option>`).join('')}</optgroup>`).join('');

// Only offer Share where the phone can share files (most iPhones and Androids).
try {
  if (navigator.canShare?.({ files: [new File([''], 'x.jpg', { type: 'image/jpeg' })] })) $('#shareBtn').classList.remove('hide');
} catch {}

let t;
$('#name').addEventListener('input', () => { updateUi(); clearTimeout(t); t = setTimeout(draw, 120); });
$('#name').addEventListener('blur', () => { const v = tidyName($('#name').value); if (v !== $('#name').value) { $('#name').value = v; draw(); } });
$('#pair').addEventListener('change', () => { updateUi(); draw(); });

updateUi();
draw();
