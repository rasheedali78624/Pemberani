import { store } from './store.js';
import { TOURNAMENT, GROUPS, FIXTURES, PAIR_BY_ID } from './config.js';
import {
  evalMatch, rulesFor, resolveFixtures, computeStandings, courtNow, statusOf, pairName, minutesFor,
} from './logic.js';

const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const ls = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch {} },
};

let state = {};
let fxTab = ls.get('pt2-fxTab') || 'G1';
let followId = ls.get('pt2-follow') || '';
const lastScores = {};

const SHUTTLE = '<svg class="shuttle" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 22a3 3 0 01-3-3v-1h6v1a3 3 0 01-3 3zM8.2 16.5L4 4.2A1 1 0 015.3 3l3.2 1.3L12 2l3.5 2.3L18.7 3A1 1 0 0120 4.2l-4.2 12.3z"/></svg>';

function toast(msg) {
  const t = $('#toast');
  t.textContent = msg; t.classList.add('show');
  clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('show'), 2200);
}

// ── Live courts ──────────────────────────────────────────

function sparkline(seq) {
  if (!seq || seq.length < 2) return '';
  let d = 0; const pts = [0];
  for (const c of seq) { d += c === 'a' ? 1 : -1; pts.push(d); }
  const max = Math.max(3, ...pts.map(Math.abs));
  const W = 300, H = 44, step = W / Math.max(pts.length - 1, 1);
  const path = pts.map((v, i) => `${i ? 'L' : 'M'}${(i * step).toFixed(1)},${(H / 2 - (v / max) * (H / 2 - 3)).toFixed(1)}`).join('');
  return `<svg class="momentum" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-label="Momentum"><line x1="0" x2="${W}" y1="${H / 2}" y2="${H / 2}"/><path class="line" d="${path}" vector-effect="non-scaling-stroke"/></svg>`;
}

function teamRow(fx, side, ev, rec, key) {
  const id = fx[side];
  const name = pairName(id) || fx['placeholder' + side.toUpperCase()] || 'TBD';
  // A finished best-of-three shows games won; the game scores go underneath.
  const score = rec.status === 'done' && rulesFor(fx).bestOf > 1 ? ev.won[side] : ev.cur[side];
  const k = `${key}-${side}`;
  const bump = lastScores[k] !== undefined && lastScores[k] !== score ? ' bump' : '';
  lastScores[k] = score;
  const opp = side === 'a' ? 'b' : 'a';
  const cls = rec.status === 'done' ? (rec.winner === side ? 'won' : 'trail') : ev.cur[side] >= ev.cur[opp] ? 'lead' : 'trail';
  const dots = rulesFor(fx).bestOf > 1
    ? `<span class="games-won">${Array.from({ length: ev.need }, (_, i) => `<i class="${i < ev.won[side] ? 'on' : ''}"></i>`).join('')}</span>` : '';
  const flag = ev.point[side] ? `<span class="flag">${ev.point[side]}</span>` : '';
  const serving = rec.status === 'live' && ev.server === side;
  return `<div class="team ${cls}">
    <div class="team-name">${SHUTTLE.replace('class="shuttle"', `class="shuttle${serving ? ' on' : ''}"`)}<span class="n">${esc(name)}</span>${dots}${flag}</div>
    <div class="score tnum${bump}">${score}</div>
  </div>`;
}

function matchLine(fx) {
  if (!fx) return '';
  const a = pairName(fx.a) || fx.placeholderA || 'TBD';
  const b = pairName(fx.b) || fx.placeholderB || 'TBD';
  return `<b>${esc(a)}</b> vs <b>${esc(b)}</b>`;
}

function courtCard(n, key) {
  const { live, next, after } = courtNow(state, n);
  const group = GROUPS.find(g => g.court === n);
  const lastDone = FIXTURES.filter(f => f.court === n && statusOf(state, f.id) === 'done')
    .sort((x, y) => (state.matches[y.id].endedAt || 0) - (state.matches[x.id].endedAt || 0))[0];
  const res = resolveFixtures(state);
  const shown = live || next || lastDone;
  const stage = shown?.stage === 'knockout' ? 'Knockout' : group?.name || '';
  const title = `<div class="court-top"><span class="court-name"><b>Court ${n}</b> · ${esc(stage)}</span>`;

  if (live) {
    const rec = state.matches[live.id];
    const ev = evalMatch(rec, rulesFor(live));
    const prev = ev.games.slice(0, -1).map(g => `${g.a}–${g.b}`).join(', ');
    return `<article class="card court is-live">
      ${title}<span class="status live"><span class="dot"></span>Live</span></div>
      <div class="court-label">${esc(live.label)}${rulesFor(live).bestOf > 1 ? ` · Game ${ev.gameNo}` : ''}${ev.interval ? ' · <span class="gold">Interval</span>' : ''}</div>
      <div class="teams">${teamRow(live, 'a', ev, rec, key + n)}${teamRow(live, 'b', ev, rec, key + n)}</div>
      ${prev ? `<div class="prev-games">Previous games: ${prev}</div>` : ''}
      ${sparkline(ev.cur.seq)}
      <div class="court-foot">${next ? `<span>Up next · ${matchLine(next)}</span>` : '<span>Last match on this court</span>'}</div>
    </article>`;
  }

  if (lastDone && (!next || Date.now() - (state.matches[lastDone.id].endedAt || 0) < 3 * 60 * 1000)) {
    // Show the result that just finished for a few minutes before flipping to "up next".
    const f = res[lastDone.id];
    const rec = state.matches[f.id];
    const ev = evalMatch(rec, rulesFor(f));
    return `<article class="card court">
      ${title}<span class="status done">Final</span></div>
      <div class="court-label">${esc(f.label)}</div>
      <div class="teams">${teamRow(f, 'a', ev, rec, key + n)}${teamRow(f, 'b', ev, rec, key + n)}</div>
      ${ev.games.length > 1 ? `<div class="prev-games">${ev.games.map(g => `${g.a}–${g.b}`).join(', ')}</div>` : ''}
      <div class="court-foot">${next ? `<span>Up next · ${matchLine(next)}</span>` : '<span>No more matches on this court.</span>'}</div>
    </article>`;
  }

  return `<article class="card court">
    ${title}<span class="status">${next ? 'Up next' : 'Idle'}</span></div>
    <div class="court-empty">${next
      ? `<big>${esc(pairName(next.a) || next.placeholderA)}<br><span class="muted">vs</span><br>${esc(pairName(next.b) || next.placeholderB)}</big>${esc(next.label)}`
      : '<big>All done here.</big>No more matches on this court.'}</div>
    ${after ? `<div class="court-foot"><span>After that · ${matchLine(after)}</span></div>` : ''}
  </article>`;
}

function renderCourts() {
  $('#courts').innerHTML = courtCard(1, 'm') + courtCard(2, 'm');
  if ($('#tv').classList.contains('open')) $('#tvCourts').innerHTML = courtCard(1, 't') + courtCard(2, 't');

  const liveCount = FIXTURES.filter(f => statusOf(state, f.id) === 'live').length;
  const pill = $('#navLive');
  pill.classList.toggle('off', !liveCount);
  pill.lastElementChild.textContent = liveCount ? `${liveCount} live now` : 'No matches live';

  const res = resolveFixtures(state);
  const done = FIXTURES.filter(f => statusOf(state, f.id) === 'done')
    .sort((x, y) => (state.matches[y.id].endedAt || 0) - (state.matches[x.id].endedAt || 0)).slice(0, 8);
  $('#ticker').classList.toggle('hide', !done.length);
  $('#tickerTrack').innerHTML = done.map(f => {
    const fx = res[f.id], rec = state.matches[f.id], ev = evalMatch(rec, rulesFor(fx));
    const w = rec.winner, l = w === 'a' ? 'b' : 'a';
    const score = ev.games.map(g => `${g[w]}–${g[l]}`).join(', ');
    return `<span><b>${esc(pairName(fx[w]))}</b> beat ${esc(pairName(fx[l]))} · ${score}</span>`;
  }).join('');
}

// ── Follow a pair ────────────────────────────────────────

function renderFollowSelect() {
  $('#followSelect').innerHTML = '<option value="">Choose a pair…</option>' + GROUPS.map(g =>
    `<optgroup label="${esc(g.name)}">${g.pairs.map(p => `<option value="${p.id}" ${p.id === followId ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}</optgroup>`).join('');
}

function renderFollow() {
  const card = $('#followCard');
  if (!followId) {
    card.innerHTML = `<div class="stat wide"><small>Nothing selected</small><b>Pick a pair to see their journey.</b><span>Their matches will glow gold across the page.</span></div>`;
    return;
  }
  const p = PAIR_BY_ID[followId];
  const table = computeStandings(state, p.group);
  const row = table.find(r => r.id === followId);
  const res = resolveFixtures(state);
  const theirs = Object.values(res).filter(f => f.a === followId || f.b === followId).sort((x, y) => x.order - y.order);
  const live = theirs.find(f => statusOf(state, f.id) === 'live');
  const next = theirs.find(f => statusOf(state, f.id) === 'scheduled');
  let headline, detail;
  if (live) {
    const ev = evalMatch(state.matches[live.id], rulesFor(live));
    const me = live.a === followId ? 'a' : 'b', them = me === 'a' ? 'b' : 'a';
    headline = `Playing now · ${ev.cur[me]}–${ev.cur[them]}`;
    detail = `${live.label} on Court ${live.court} vs ${pairName(live[them])}`;
  } else if (next) {
    const ahead = courtNow(state, next.court).queue.filter(f => f.order < next.order && statusOf(state, f.id) !== 'done').length;
    const them = next.a === followId ? next.b : next.a;
    headline = ahead === 0 ? 'Up next — get ready!' : `${ahead} match${ahead > 1 ? 'es' : ''} before they play`;
    detail = `${next.label} · Court ${next.court} vs ${pairName(them) || 'TBD'}`;
  } else {
    const champ = state.matches?.FINAL?.status === 'done' && res.FINAL[state.matches.FINAL.winner] === followId;
    headline = champ ? 'Champions! 🏆' : theirs.length ? 'All matches played' : 'Waiting for the draw';
    detail = champ ? 'Edition 2.0 winners.' : row.q ? 'Check the bracket for what comes next.' : 'Thanks for playing.';
  }
  card.innerHTML = `
    <div class="stat"><small>Position</small><b class="tnum ${row.q ? 'gold' : ''}">#${row.rank}</b></div>
    <div class="stat"><small>Record</small><b class="tnum">${row.w}–${row.l}</b></div>
    <div class="stat"><small>Diff</small><b class="tnum">${row.diff > 0 ? '+' : ''}${row.diff}</b></div>
    <div class="stat wide"><small>${esc(p.name)}</small><b>${esc(headline)}</b><span>${esc(detail)}</span></div>`;
}

// ── Fixtures ─────────────────────────────────────────────

function approxStart(fx) {
  if (!TOURNAMENT.startsAt) return '';
  const q = courtNow(state, fx.court).queue;
  const mins = q.filter(f => f.order < fx.order).reduce((m, f) => m + minutesFor(f), 0);
  const t = new Date(new Date(TOURNAMENT.startsAt).getTime() + mins * 60000);
  return `~${t.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`;
}

function fxRow(fx) {
  const rec = state.matches?.[fx.id];
  const st = rec?.status || 'scheduled';
  const ev = rec ? evalMatch(rec, rulesFor(fx)) : null;
  const multi = rulesFor(fx).bestOf > 1;
  const side = s => {
    const name = pairName(fx[s]);
    const cls = !name ? 'tbd' : st === 'done' ? (rec.winner === s ? 'w' : 'l') : '';
    let pts = '';
    if (ev && (st === 'done' || st === 'live')) {
      pts = multi
        ? `${ev.won[s]}<small>${ev.games.filter(g => g.a + g.b).map(g => g[s]).join(' ')}</small>`
        : `${ev.cur[s]}`;
    }
    return `<div class="fx-team ${cls}"><span class="n">${esc(name || fx['placeholder' + s.toUpperCase()] || 'TBD')}</span><span class="pts tnum">${pts}</span></div>`;
  };
  const { next } = courtNow(state, fx.court);
  const badge = st === 'live' ? '<span class="status live"><span class="dot"></span>Live</span>'
    : st === 'done' ? '<span class="status done">Final</span>'
    : next?.id === fx.id ? '<span class="status">Up next</span>'
    : `<span class="muted" style="font-size:13px">${approxStart(fx) || `Court ${fx.court}`}</span>`;
  const mine = followId && (fx.a === followId || fx.b === followId);
  return `<li class="fx${mine ? ' mine' : ''}">
    <div class="fx-no">${esc(fx.short)}</div>
    <div class="fx-teams">${side('a')}${side('b')}</div>
    <div class="fx-side">${badge}</div>
  </li>`;
}

function renderFixtures() {
  const res = resolveFixtures(state);
  const list = FIXTURES.filter(f => (fxTab === 'KO' ? f.stage === 'knockout' : f.group === fxTab)).map(f => res[f.id]);
  const played = list.filter(f => statusOf(state, f.id) === 'done').length;
  const g = GROUPS.find(x => x.id === fxTab);
  $('#fxMeta').innerHTML = `<span>${played} of ${list.length} played</span><span>${g ? `All on Court ${g.court} · one game to 21, no deuce` : 'Best of three · games to 21'}</span>`;
  $('#fxList').innerHTML = list.map(fxRow).join('');
  $$('#fxTabs button').forEach(b => b.setAttribute('aria-selected', b.dataset.tab === fxTab));
  moveThumb($('#fxTabs'));
}

function moveThumb(seg) {
  const on = seg.querySelector('[aria-selected="true"]');
  const th = seg.querySelector('.thumb');
  if (!on || !th) return;
  th.style.width = on.offsetWidth + 'px';
  th.style.transform = `translateX(${on.offsetLeft}px)`;
}

// ── Standings ────────────────────────────────────────────

function renderStandings() {
  $('#tables').innerHTML = GROUPS.map((g, gi) => {
    const rows = computeStandings(state, g.id);
    const played = FIXTURES.filter(f => f.group === g.id && statusOf(state, f.id) === 'done').length;
    return `<div class="card table-card reveal in" data-delay="${gi}">
      <h3>${esc(g.name)} <small>Court ${g.court} · ${played}/8 played</small></h3>
      <table class="st tnum">
        <thead><tr><th></th><th>Pair</th><th title="Played">P</th><th title="Won">W</th><th title="Lost">L</th><th class="hide-sm" title="Points for">PF</th><th title="Point difference">+/−</th><th title="Points">Pts</th></tr></thead>
        <tbody>${rows.map((r, i) => `<tr class="${r.q ? 'q' : ''}${i === 4 ? ' cut' : ''}${r.id === followId ? ' mine' : ''}">
          <td class="pos">${r.rank}</td>
          <td>${esc(r.name)}<span class="form">${r.form.map(f => `<i class="${f}"></i>`).join('')}</span></td>
          <td>${r.p}<span class="muted">/${r.scheduled}</span></td><td>${r.w}</td><td>${r.l}</td>
          <td class="hide-sm">${r.pf}</td><td>${r.diff > 0 ? '+' : ''}${r.diff}</td><td class="pts">${r.pts}</td></tr>`).join('')}
        </tbody>
      </table>
      <div class="legend">Gold numbers qualify. Win = 2 pts.</div>
    </div>`;
  }).join('');
}

// ── Bracket ──────────────────────────────────────────────

function bracketMatch(fx, extra = '') {
  const rec = state.matches?.[fx.id];
  const st = rec?.status;
  const ev = rec ? evalMatch(rec, rulesFor(fx)) : null;
  const row = s => {
    const name = pairName(fx[s]);
    const cls = !name ? 'tbd' : st === 'done' ? (rec.winner === s ? 'w' : 'l') : '';
    const g = ev && st ? ev.games.filter(x => x.a + x.b).map(x => x[s]).join(' ') : '';
    return `<div class="bm-row ${cls}"><span class="n">${esc(name || fx['placeholder' + s.toUpperCase()])}</span><span class="g tnum">${g}</span></div>`;
  };
  return `<div class="bm ${extra}${st === 'live' ? ' is-live' : ''}">
    <div class="bm-head"><span>${esc(fx.label)}</span><span>${st === 'live' ? '<span class="gold">● Live</span>' : `Court ${fx.court}`}</span></div>
    ${row('a')}${row('b')}
  </div>`;
}

function renderBracket() {
  const res = resolveFixtures(state);
  const qf = ['QF1', 'QF2', 'QF3', 'QF4'].map(id => res[id]);
  const sf = ['SF1', 'SF2'].map(id => res[id]);
  const fin = res.FINAL, br = res.BRONZE;
  const champ = state.matches?.FINAL?.status === 'done' ? pairName(fin[state.matches.FINAL.winner]) : null;
  $('#bracketEl').innerHTML = `
    <div class="round"><h4>Quarter-finals</h4><div class="round-matches">${qf.map(f => bracketMatch(f)).join('')}</div></div>
    <div class="round"><h4>Semi-finals</h4><div class="round-matches">${sf.map(f => bracketMatch(f)).join('')}</div></div>
    <div class="round"><h4>Finals</h4><div class="round-matches final-col">
      ${champ ? `<div class="champ-banner"><small>Champions</small><b class="gold-text">${esc(champ)}</b></div>` : ''}
      ${bracketMatch(fin, 'final')}${bracketMatch(br)}
    </div></div>`;

  if (champ) {
    $('#hofNext').innerHTML = `<img src="assets/crest.png" alt=""><h3>Edition 2.0 champions.<br><span class="gold-text">${esc(champ)}</span></h3><p>Congratulations — your names join the hall of fame.</p>`;
  }
}

// ── Render all ───────────────────────────────────────────

function render() {
  renderCourts();
  renderFollow();
  renderFixtures();
  renderStandings();
  renderBracket();
}

// ── Scroll effects ───────────────────────────────────────

const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

function setupStatement() {
  const p = $('#statementText');
  p.innerHTML = p.textContent.split(' ').map(w => {
    const accent = w.startsWith('*');
    return `<span class="w${accent ? ' accent' : ''}">${esc(w.replace(/\*/g, ''))}</span>`;
  }).join(' ');
}

function onScroll() {
  const y = scrollY, vh = innerHeight;
  $('#nav').classList.toggle('scrolled', y > 10);
  $('#chips').classList.toggle('show', y > vh * 0.7);

  const hero = $('#heroInner');
  const k = Math.min(y / vh, 1);
  if (!reduced) hero.style.transform = `translateY(${k * 120}px) scale(${1 - k * 0.12})`;
  hero.style.opacity = 1 - k * 1.2;

  const st = $('#statement');
  const r = st.getBoundingClientRect();
  const prog = Math.min(Math.max(-r.top / (r.height - vh), 0), 1);
  const words = $$('#statementText .w');
  const lit = Math.round(prog * words.length * 1.15);
  words.forEach((w, i) => w.classList.toggle('on', i < lit));

  if (reduced) return;
  const img = $('#hofImg');
  const ir = img.parentElement.getBoundingClientRect();
  if (ir.top < vh && ir.bottom > 0) img.style.transform = `translateY(${((ir.top + ir.height / 2 - vh / 2) / vh) * -40}px)`;
}

function setupReveal() {
  const io = new IntersectionObserver(entries => entries.forEach(e => {
    if (!e.isIntersecting) return;
    e.target.classList.add('in');
    io.unobserve(e.target);
    const n = e.target.querySelector('[data-count]');
    if (n) countUp(n);
  }), { threshold: 0, rootMargin: '0px 0px -12% 0px' });
  $$('.reveal').forEach(el => io.observe(el));

  const sections = ['live', 'fixtures', 'standings', 'bracket', 'format', 'champions'];
  const spy = new IntersectionObserver(entries => entries.forEach(e => {
    if (!e.isIntersecting) return;
    $$('.nav-links a, .chips a').forEach(a => a.classList.toggle('active', a.getAttribute('href') === '#' + e.target.id));
  }), { rootMargin: '-45% 0px -50% 0px' });
  sections.forEach(id => spy.observe(document.getElementById(id)));
}

function countUp(el) {
  const to = +el.dataset.count, t0 = performance.now(), dur = 1200;
  const step = t => {
    const p = Math.min((t - t0) / dur, 1);
    el.textContent = Math.round(to * (1 - Math.pow(1 - p, 3)));
    if (p < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

function setupCountdown() {
  if (!TOURNAMENT.startsAt) return;
  const el = $('#countdown');
  const target = new Date(TOURNAMENT.startsAt).getTime();
  const tick = () => {
    const ms = target - Date.now();
    if (ms <= 0) { el.classList.add('hide'); return; }
    el.classList.remove('hide');
    const d = Math.floor(ms / 864e5), h = Math.floor(ms / 36e5) % 24, m = Math.floor(ms / 6e4) % 60, s = Math.floor(ms / 1e3) % 60;
    el.innerHTML = [[d, 'days'], [h, 'hours'], [m, 'mins'], [s, 'secs']].map(([v, l]) => `<span><b class="tnum">${v}</b>${l}</span>`).join('');
    setTimeout(tick, 1000);
  };
  tick();
}

// ── TV mode & share ──────────────────────────────────────

function openTv() {
  $('#tv').classList.add('open');
  renderCourts();
  document.documentElement.requestFullscreen?.().catch(() => {});
  navigator.wakeLock?.request('screen').catch(() => {});
}
function closeTv() {
  $('#tv').classList.remove('open');
  if (document.fullscreenElement) document.exitFullscreen();
}

async function share() {
  const data = { title: 'Pemberani Tournament 2.0 — Live', text: 'Live scores from Pemberani Tournament 2.0', url: location.href.split('#')[0] };
  if (navigator.share) { try { await navigator.share(data); } catch {} return; }
  try { await navigator.clipboard.writeText(data.url); toast('Link copied'); } catch { toast(data.url); }
}

// ── Boot ─────────────────────────────────────────────────

setupStatement();
setupReveal();
setupCountdown();
renderFollowSelect();
addEventListener('scroll', () => requestAnimationFrame(onScroll), { passive: true });
addEventListener('resize', () => moveThumb($('#fxTabs')));
onScroll();

$('#fxTabs').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  fxTab = b.dataset.tab; ls.set('pt2-fxTab', fxTab); renderFixtures();
});
$('#followSelect').addEventListener('change', e => {
  followId = e.target.value; ls.set('pt2-follow', followId); render();
  if (followId) toast(`Following ${PAIR_BY_ID[followId].name}`);
});
$('#tvBtn').addEventListener('click', openTv);
$('#tvClose').addEventListener('click', closeTv);
addEventListener('keydown', e => { if (e.key === 'Escape') closeTv(); });
$('#shareBtn').addEventListener('click', share);

store.onConnection(ok => {
  const s = $('#connStatus');
  s.className = 'status' + (ok ? ' done' : '');
  s.innerHTML = `<span class="dot"></span>${ok ? (store.mode === 'demo' ? 'Demo mode' : 'Connected · live') : 'Reconnecting…'}`;
});
if (store.mode === 'demo') document.body.insertAdjacentHTML('beforeend', '<div class="demo-banner">Demo mode — scores stay in this browser</div>');

store.subscribe(s => { state = s || {}; render(); });
// Re-render once a minute so "just finished" results roll over to "up next".
setInterval(renderCourts, 60000);
if (new URLSearchParams(location.search).has('tv')) openTv();
