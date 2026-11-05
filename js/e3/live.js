// Edition 3.0 live data: match centre, fixtures, standings, bracket,
// pair cards and pair profiles. Used by index.html and live.html.

import { openStore } from '../store.js';
import {
  TOURNAMENT, GROUPS, FIXTURES, PAIR_BY_ID, PAIRS, QUALIFIERS_PER_GROUP, DRAW_CONFIRMED, courtName,
} from '../config.js';
import {
  evalMatch, rulesFor, resolveFixtures, computeStandings, statusOf, courtNow, minutesFor,
} from '../logic.js';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const params = new URLSearchParams(location.search);

let state = {};
let res = {};
let fxFilter = 'all';
let fxShowAll = false;
const lastPts = {};

const name = id => PAIR_BY_ID[id]?.name ?? null;
const players = id => PAIR_BY_ID[id]?.players?.join(' & ') ?? null;

// ── Approximate start times: cumulative per court ────────────
const START = new Date(TOURNAMENT.startsAt).getTime();
const approx = {};
for (const c of [1, 2]) {
  let t = START;
  FIXTURES.filter(f => f.court === c).sort((a, b) => a.order - b.order).forEach(f => {
    approx[f.id] = t;
    t += minutesFor(f) * 60000;
  });
}
const clock = ms => new Date(ms).toLocaleTimeString('en-MY', { hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Kuala_Lumpur' });

function scoreLine(f) {
  const rec = state.matches?.[f.id];
  if (!rec) return null;
  const ev = evalMatch(rec, rulesFor(f));
  const games = ev.games.filter(g => g.a || g.b || g.winner);
  return { ev, rec, games };
}

// ── Courts (broadcast scoreboards) ───────────────────────────
function courtCard(n) {
  const { live, next, after } = courtNow(state, n);
  const group = GROUPS.find(g => g.court === n);
  const cur = live || next;
  const stageName = !cur || cur.stage === 'group' ? group?.name ?? '' : 'Knockouts';
  const head = (tag) => `<div class="court-hd"><span class="cn">${esc(courtName(n))}<small>${esc(stageName)}</small></span>${tag}</div>`;
  const side = (f, s) => f[s] ? name(f[s]) : (s === 'a' ? f.placeholderA : f.placeholderB) || 'TBD';

  if (live) {
    const { ev } = scoreLine(live);
    const r = rulesFor(live);
    const row = s => {
      const pts = ev.cur[s];
      const key = `${n}-${s}`;
      const bump = lastPts[key] !== undefined && lastPts[key] !== `${live.id}:${pts}`;
      lastPts[key] = `${live.id}:${pts}`;
      const lead = ev.cur[s] > ev.cur[s === 'a' ? 'b' : 'a'];
      const gs = r.bestOf > 1 ? ev.games.slice(0, -1).map(g => `<i class="${g.winner === s ? 'w' : ''}">${g[s]}</i>`).join('') : '';
      return `<span class="nm ${ev.server === s ? 'serving' : ''}"><i class="srv"></i>${esc(side(live, s))}</span>
        <span class="gs">${gs}</span>
        <span class="pts ${lead ? 'lead' : ''}"><span class="${bump ? 'bump' : ''}">${pts}</span></span>`;
    };
    const flag = ev.point.a || ev.point.b;
    return `<article class="court is-live">${head('<span class="tag live">Live</span>')}
      <div class="court-bd">
        <div class="ml">${esc(live.label)}${r.bestOf > 1 ? ` · Game ${ev.gameNo}` : ''}${ev.interval ? ' · Interval' : ''}</div>
        <div class="sb">${row('a')}${row('b')}</div>
        ${flag ? `<span class="flag">${esc(flag)}</span>` : ''}
      </div>
      <div class="court-ft">${next ? `Up next · <b>${esc(side(next, 'a'))}</b> v <b>${esc(side(next, 'b'))}</b>` : 'Last match on this court'}</div>
    </article>`;
  }
  if (next) {
    return `<article class="court">${head('<span class="tag">Up next</span>')}
      <div class="court-empty"><big>${esc(side(next, 'a'))}<br><span class="y">v</span> ${esc(side(next, 'b'))}</big>
        ${esc(next.label)} · ≈ ${clock(approx[next.id])}</div>
      ${after ? `<div class="court-ft">After that · <b>${esc(side(after, 'a'))}</b> v <b>${esc(side(after, 'b'))}</b></div>` : ''}
    </article>`;
  }
  return `<article class="court">${head('<span class="tag done">Done</span>')}
    <div class="court-empty"><big>All done</big>No more matches on this court.</div></article>`;
}

// ── Fixtures list ────────────────────────────────────────────
function fxRow(f) {
  const st = statusOf(state, f.id);
  const sl = scoreLine(f);
  const A = f.a ? name(f.a) : f.placeholderA || 'TBD';
  const B = f.b ? name(f.b) : f.placeholderB || 'TBD';
  const w = st === 'done' ? state.matches[f.id].winner : null;
  const cls = s => [s, !f[s] ? 'tbd' : '', w ? (w === s ? 'win' : 'lose') : ''].join(' ');
  let mid = '<span class="mid vs">VS</span>';
  if (sl && st !== 'scheduled') {
    const games = sl.ev.games.filter(g => g.a || g.b);
    const main = rulesFor(f).bestOf > 1 ? `${sl.ev.won.a}–${sl.ev.won.b}` : `${sl.ev.cur.a}–${sl.ev.cur.b}`;
    const detail = rulesFor(f).bestOf > 1 ? games.map(g => `${g.a}-${g.b}`).join(' · ') : '';
    mid = `<span class="mid">${main}${detail ? `<small>${detail}</small>` : ''}</span>`;
  }
  const tag = st === 'live' ? '<span class="tag live">Live</span>' : st === 'done' ? '<span class="tag done">FT</span>' : `<span class="tag">${esc(f.short)}</span>`;
  return `<div class="fx ${st === 'live' ? 'is-live' : ''}">
    <span class="when"><b>≈ ${clock(approx[f.id])}</b>${esc(courtName(f.court))}</span>
    <span class="side ${cls('a')}">${esc(A)}</span>${mid}<span class="side ${cls('b')}">${esc(B)}</span>
    <span class="st">${tag}</span></div>`;
}

function renderFixtures() {
  const el = $('#fixtures');
  if (!el) return;
  let list = FIXTURES.map(f => res[f.id]).sort((a, b) => approx[a.id] - approx[b.id] || a.court - b.court);
  if (fxFilter === 'G1' || fxFilter === 'G2') list = list.filter(f => f.group === fxFilter);
  if (fxFilter === 'ko') list = list.filter(f => f.stage === 'knockout');
  if (fxFilter === 'results') list = list.filter(f => statusOf(state, f.id) === 'done').reverse();
  const limit = el.dataset.limit ? +el.dataset.limit : 0;
  let shown = list;
  if (limit && !fxShowAll && fxFilter === 'all') {
    // focus around "now": live + upcoming first
    const firstOpen = list.findIndex(f => statusOf(state, f.id) !== 'done');
    const from = Math.max(0, (firstOpen < 0 ? list.length : firstOpen) - 2);
    shown = list.slice(from, from + limit);
  }
  el.innerHTML = shown.length ? shown.map(fxRow).join('') : '<p class="prov">No results yet.</p>';
  const more = $('#fxMore');
  if (more) more.hidden = !(limit && fxFilter === 'all' && list.length > shown.length) && !fxShowAll;
  if (more) more.querySelector('.t').textContent = fxShowAll ? 'Show fewer' : `All ${list.length} matches`;
}

// ── Standings (rows glide when the order changes) ────────────
const ROW_H = 56;
function renderStandings() {
  const host = $('[data-standings]');
  if (!host) return;
  if (!host.dataset.built) {
    host.innerHTML = GROUPS.map(g => `<div class="tbl" data-g="${g.id}">
      <h3>${esc(g.name)} <small>${esc(courtName(g.court))}</small></h3>
      <div class="head"><span>#</span><span>Pair</span><span>P</span><span>W</span><span>L</span><span>+/−</span><span>Pts</span></div>
      <div class="rows" style="height:${g.pairs.length * ROW_H}px"></div>
      <div class="note"><i></i>Top ${QUALIFIERS_PER_GROUP} go through to the quarter-finals</div></div>`).join('');
    host.dataset.built = 1;
  }
  for (const g of GROUPS) {
    const rowsEl = $(`.tbl[data-g="${g.id}"] .rows`, host);
    const list = computeStandings(state, g.id);
    list.forEach((r, i) => {
      let row = $(`[data-id="${r.id}"]`, rowsEl);
      if (!row) {
        row = document.createElement('div');
        row.className = 'r'; row.dataset.id = r.id;
        row.style.position = 'absolute'; row.style.left = 0; row.style.right = 0; row.style.top = 0;
        rowsEl.append(row);
      }
      const sig = `${r.p}|${r.w}|${r.diff}`;
      if (row.dataset.sig && row.dataset.sig !== sig) { row.classList.add('flash'); setTimeout(() => row.classList.remove('flash'), 1200); }
      row.dataset.sig = sig;
      row.classList.toggle('q', r.q);
      row.classList.toggle('cut', i === QUALIFIERS_PER_GROUP - 1);
      row.style.transform = `translateY(${i * ROW_H}px)`;
      row.innerHTML = `<span class="pos">${r.rank}</span><span class="nm">${esc(r.name)}</span>
        <span>${r.p}</span><span>${r.w}</span><span>${r.l}</span><span>${r.diff > 0 ? '+' : ''}${r.diff}</span><span class="pts">${r.pts}</span>`;
    });
  }
}

// ── Bracket ──────────────────────────────────────────────────
function bm(id) {
  const f = res[id];
  const st = statusOf(state, id);
  const sl = scoreLine(f);
  const w = st === 'done' ? state.matches[id].winner : null;
  const row = s => {
    const n = f[s] ? name(f[s]) : null;
    const sc = sl && st !== 'scheduled' ? sl.ev.games.filter(g => g.a || g.b).map(g => g[s]).join(' ') : '';
    return `<div class="br ${w ? (w === s ? 'w' : 'l') : ''}"><span class="n ${n ? '' : 'tbd'}">${esc(n || (s === 'a' ? f.placeholderA : f.placeholderB))}</span><span class="s">${sc}</span></div>`;
  };
  const tag = st === 'live' ? '<span class="tag live" style="padding:1px 6px">Live</span>' : `<span>${esc(courtName(f.court))} · ≈ ${clock(approx[id])}</span>`;
  return `<div class="bm ${st} ${w ? 'has-winner' : ''}"><div class="bh"><span>${esc(f.short)}</span>${tag}</div>${row('a')}${row('b')}</div>`;
}
function renderBracket() {
  const el = $('#bracket');
  if (!el) return;
  const fin = state.matches?.FINAL;
  const champ = fin?.status === 'done' ? name(res.FINAL[fin.winner]) : null;
  el.innerHTML = `
    <div class="round"><h4>Quarter-finals</h4><div class="slots">${['QF1', 'QF2', 'QF3', 'QF4'].map(bm).join('')}</div></div>
    <div class="round"><h4>Semi-finals</h4><div class="slots">${['SF1', 'SF2'].map(bm).join('')}</div></div>
    <div class="round final-col"><h4>Final</h4><div class="slots">
      <div>${bm('FINAL')}
        <div class="champ-slot ${champ ? 'won' : ''}"><span class="label plain">Champions · Edition 3.0</span><b>${esc(champ || 'To be decided')}</b></div></div>
      <div><h4 style="margin:10px 0 12px">Third place</h4>${bm('BRONZE')}</div>
    </div></div>`;
}

// ── Pair cards + profile ─────────────────────────────────────
function renderPairs() {
  const el = $('#pairs');
  if (!el) return;
  const g = el.dataset.group || 'G1';
  const group = GROUPS.find(x => x.id === g);
  const table = Object.fromEntries(computeStandings(state, g).map(r => [r.id, r]));
  el.innerHTML = group.pairs.map((p, i) => {
    const r = table[p.id];
    const num = PAIRS.findIndex(x => x.id === p.id) + 1;
    return `<button class="pair" data-id="${p.id}" aria-label="${esc(p.name)} profile">
      <span class="num">${String(num).padStart(2, '0')}</span>
      <span class="meta">${esc(group.name)}<br>${esc(courtName(group.court))}</span>
      <span class="pn">${esc(p.name)}</span>
      <span class="pp">${p.players ? esc(p.players.join(' · ')) : 'Players announced after the draw'}</span>
      <span class="stats"><span><b>${r.p}</b>P</span><span><b>${r.w}</b>W</span><span><b>${r.l}</b>L</span><span><b>${r.diff > 0 ? '+' : ''}${r.diff}</b>Diff</span></span>
    </button>`;
  }).join('');
}

function openProfile(id) {
  const dlg = $('#profile');
  if (!dlg) return;
  const p = PAIR_BY_ID[id];
  const group = GROUPS.find(g => g.id === p.group);
  const r = computeStandings(state, p.group).find(x => x.id === id);
  const mine = FIXTURES.map(f => res[f.id]).filter(f => f.a === id || f.b === id);
  const rows = mine.map(f => {
    const me = f.a === id ? 'a' : 'b', them = me === 'a' ? 'b' : 'a';
    const st = statusOf(state, f.id);
    const sl = scoreLine(f);
    let out = `≈ ${clock(approx[f.id])}`;
    if (st !== 'scheduled' && sl) {
      const won = state.matches[f.id].winner;
      const g = sl.ev.games.filter(x => x.a || x.b).map(x => `${x[me]}–${x[them]}`).join(', ');
      out = st === 'live' ? `LIVE ${g}` : `${won === me ? 'W' : 'L'} ${g}`;
    }
    return `<div class="row"><span><b>${esc(f.short)}</b> <span class="vs">v ${esc(name(f[them]) || 'TBD')} · ${esc(courtName(f.court))}</span></span><span class="res">${esc(out)}</span></div>`;
  }).join('');
  dlg.innerHTML = `<div class="ph"><button class="close" aria-label="Close" data-close>✕</button>
      <div class="meta">${esc(group.name)} · ${esc(courtName(group.court))} · Rank ${r.rank}</div>
      <h3 class="display">${esc(p.name)}</h3>
      <div class="meta" style="margin-top:8px">${p.players ? esc(p.players.join(' & ')) : 'Players announced after the draw'}</div></div>
    <div class="pb">
      <div class="row"><span>Record</span><span class="res">${r.w}W – ${r.l}L · ${r.diff > 0 ? '+' : ''}${r.diff}</span></div>
      <h4 class="label" style="margin:22px 0 4px">Group matches</h4>${rows}
    </div>`;
  dlg.showModal();
}

// ── Header bits: live pill, connection ───────────────────────
function renderMeta() {
  const liveCount = FIXTURES.filter(f => statusOf(state, f.id) === 'live').length;
  $$('.live-pill').forEach(p => { p.classList.toggle('on', liveCount > 0); p.textContent = `${liveCount} live`; });
}

function renderAll() {
  res = resolveFixtures(state);
  const courts = $('#courts');
  if (courts) courts.innerHTML = courtCard(1) + courtCard(2);
  renderFixtures();
  renderStandings();
  renderBracket();
  renderPairs();
  renderMeta();
}

// ── Simulated results for ?demo=sim (local only) ─────────────
function seq(aPts, bPts, winner) {
  // a random rally order that ends on the winner's last point
  const arr = [...Array(aPts).fill('a'), ...Array(bPts).fill('b')];
  const last = arr.lastIndexOf(winner);
  arr.splice(last, 1);
  for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; }
  return arr.join('') + winner;
}
async function simulate(store) {
  let rnd = 7;
  const r = () => (rnd = (rnd * 9301 + 49297) % 233280) / 233280;
  const done = (f, live) => {
    const rules = rulesFor(f);
    const need = Math.ceil(rules.bestOf / 2);
    const games = []; let wa = 0, wb = 0;
    while (wa < need && wb < need) {
      const w = r() < 0.5 ? 'a' : 'b';
      const lose = Math.floor(r() * (rules.target - 4)) + 3;
      games.push(w === 'a' ? seq(rules.target, lose, 'a') : seq(lose, rules.target, 'b'));
      w === 'a' ? wa++ : wb++;
    }
    if (live) { games[games.length - 1] = games[games.length - 1].slice(0, 13); return { status: 'live', games, serve: 'a', startedAt: Date.now() }; }
    return { status: 'done', games, serve: 'a', winner: wa > wb ? 'a' : 'b', startedAt: Date.now() - 6e5, endedAt: Date.now() };
  };
  for (const f of FIXTURES.filter(f => f.stage === 'group')) await store.transactMatch(f.id, () => done(f));
  for (const id of ['QF1', 'QF2', 'QF3', 'QF4']) {
    const cur = resolveFixtures(JSON.parse(localStorage.getItem('pt3-demo-state') || '{}'))[id];
    await store.transactMatch(id, () => ({ ...done(FIXTURES.find(f => f.id === id)), a: cur.a, b: cur.b }));
  }
  const cur = resolveFixtures(JSON.parse(localStorage.getItem('pt3-demo-state') || '{}'));
  await store.transactMatch('SF1', () => ({ ...done(FIXTURES.find(f => f.id === 'SF1'), true), a: cur.SF1.a, b: cur.SF1.b }));
}

// ── Mount ────────────────────────────────────────────────────
export async function mountLive() {
  // controls
  $$('[data-fx]').forEach(b => b.addEventListener('click', () => {
    fxFilter = b.dataset.fx; fxShowAll = false;
    $$('[data-fx]').forEach(x => x.setAttribute('aria-selected', String(x === b)));
    renderFixtures();
  }));
  $('#fxMore')?.addEventListener('click', () => { fxShowAll = !fxShowAll; renderFixtures(); });
  $$('[data-pg]').forEach(b => b.addEventListener('click', () => {
    $('#pairs').dataset.group = b.dataset.pg;
    $$('[data-pg]').forEach(x => x.setAttribute('aria-selected', String(x === b)));
    renderPairs();
  }));
  $('#pairs')?.addEventListener('click', e => { const c = e.target.closest('.pair'); if (c) openProfile(c.dataset.id); });
  const dlg = $('#profile');
  dlg?.addEventListener('click', e => { if (e.target === dlg || e.target.closest('[data-close]')) dlg.close(); });

  renderAll(); // draw placeholders immediately

  const store = await openStore();
  if (store.mode === 'demo') {
    const b = document.createElement('div');
    b.className = 'demo-banner';
    b.textContent = params.get('demo') === 'sim' ? 'Demo · simulated results' : 'Demo mode · nothing is saved';
    document.body.append(b);
    if (params.get('demo') === 'sim' && !localStorage.getItem('pt3-demo-state')) await simulate(store);
  }
  store.onConnection(ok => $$('.conn').forEach(c => { c.classList.toggle('ok', ok); c.classList.toggle('off', !ok); c.querySelector('span').textContent = ok ? 'Live sync' : 'Reconnecting…'; }));
  store.subscribe(s => { state = s || {}; renderAll(); });
  return store;
}

export { DRAW_CONFIRMED };
