// Edition 3.0 live data: match centre, fixtures, standings, bracket,
// pair cards and pair profiles. Used by index.html and live.html.

import { openStore } from '../store.js';
import {
  TOURNAMENT, GROUPS, FIXTURES, PAIR_BY_ID, PAIRS, QUALIFIERS_PER_GROUP, COURT_LABEL, DB_ROOT,
} from '../config.js';
import {
  evalMatch, rulesFor, resolveFixtures, computeStandings, statusOf, courtNow, minutesFor,
} from '../logic.js';
import { t, locale } from './i18n.js';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const params = new URLSearchParams(location.search);

let state = {};
let res = {};
let fxFilter = 'all';
let fxShowAll = false;
const lastPts = {};

// ── Localised names ──────────────────────────────────────────
const num2 = id => String(PAIRS.findIndex(p => p.id === id) + 1).padStart(2, '0');
// Placeholder pairs ("Pair 01") follow the language; real pair names stay as written.
const name = id => {
  const p = PAIR_BY_ID[id];
  if (!p) return null;
  return p.players ? p.name : `${t('pair')} ${num2(id)}`;
};
const groupName = gid => `${t('group')} ${GROUPS.find(g => g.id === gid)?.name.slice(-1) ?? ''}`;
const courtName = n => `${t('court')} ${COURT_LABEL[n] ?? n}`;
const fxLabel = f => f.stage === 'group'
  ? `${groupName(f.group)} · ${t('match')} ${f.order}`
  : (f.id === 'FINAL' || f.id === 'BRONZE' ? t(f.id) : `${t(f.id.slice(0, 2))} ${f.id.slice(2)}`);
const slotText = s => s.group ? `${groupName(s.group)} #${s.rank}`
  : s.winnerOf ? `${t('winner')} ${s.winnerOf}` : `${t('loser')} ${s.loserOf}`;
const side = (f, s) => (f[s] ? name(f[s]) : f.stage === 'knockout' ? slotText(s === 'a' ? f.slotA : f.slotB) : t('tbd'));

// ── Approximate start times: cumulative per court ────────────
const START = new Date(TOURNAMENT.startsAt).getTime();
const approx = {};
for (const c of [1, 2]) {
  let at = START;
  FIXTURES.filter(f => f.court === c).sort((a, b) => a.order - b.order).forEach(f => {
    approx[f.id] = at;
    at += minutesFor(f) * 60000;
  });
}
const clock = ms => new Date(ms).toLocaleTimeString(locale(), { hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Kuala_Lumpur' });

function scoreLine(f) {
  const rec = state.matches?.[f.id];
  if (!rec) return null;
  return { ev: evalMatch(rec, rulesFor(f)), rec };
}

// ── Courts (broadcast scoreboards) ───────────────────────────
function courtCard(n) {
  const { live, next, after } = courtNow(state, n);
  const cur = live || next;
  const group = GROUPS.find(g => g.court === n);
  const stageName = !cur || cur.stage === 'group' ? groupName(group.id) : t('knockouts');
  const head = tag => `<div class="court-hd"><span class="cn">${esc(COURT_LABEL[n])}<small>${esc(t('court'))} · ${esc(stageName)}</small></span>${tag}</div>`;
  const vs = f => `<b>${esc(side(f, 'a'))}</b> ${t('v')} <b>${esc(side(f, 'b'))}</b>`;

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
      return `<span class="nm ${ev.server === s ? 'serving' : ''}"><i class="srv"></i><span>${esc(side(live, s))}</span></span>
        <span class="gs">${gs}</span>
        <span class="pts ${lead ? 'lead' : ''}"><span class="${bump ? 'bump' : ''}">${pts}</span></span>`;
    };
    const flag = ev.point.a || ev.point.b;
    return `<article class="court is-live">${head(`<span class="tag live">${t('live')}</span>`)}
      <div class="court-bd">
        <div class="ml">${esc(fxLabel(live))}${r.bestOf > 1 ? ` · ${t('game')} ${ev.gameNo}` : ''}${ev.interval ? ` · ${t('interval')}` : ''}</div>
        <div class="sb">${row('a')}${row('b')}</div>
        ${flag ? `<span class="flag">${esc(t(flag))}</span>` : ''}
      </div>
      <div class="court-ft">${next ? `${t('upnext')} · ${vs(next)}` : t('lastOnCourt')}</div>
    </article>`;
  }
  if (next) {
    return `<article class="court">${head(`<span class="tag">${t('upnext')}</span>`)}
      <div class="court-empty"><big>${esc(side(next, 'a'))}<br><span class="y">${t('v')}</span> ${esc(side(next, 'b'))}</big>
        ${esc(fxLabel(next))} · ≈ ${clock(approx[next.id])}</div>
      ${after ? `<div class="court-ft">${t('after')} · ${vs(after)}</div>` : ''}
    </article>`;
  }
  return `<article class="court">${head(`<span class="tag done">${t('done')}</span>`)}
    <div class="court-empty"><big>${t('allDone')}</big>${t('noMore')}</div></article>`;
}

// ── Fixtures list ────────────────────────────────────────────
function fxRow(f) {
  const st = statusOf(state, f.id);
  const sl = scoreLine(f);
  const w = st === 'done' ? state.matches[f.id].winner : null;
  const cls = s => [s, !f[s] ? 'tbd' : '', w ? (w === s ? 'win' : 'lose') : ''].join(' ');
  let mid = `<span class="mid vs">${t('v').toUpperCase()}</span>`;
  if (sl && st !== 'scheduled') {
    const r = rulesFor(f);
    const games = sl.ev.games.filter(g => g.a || g.b);
    const main = r.bestOf > 1 ? `${sl.ev.won.a}–${sl.ev.won.b}` : `${sl.ev.cur.a}–${sl.ev.cur.b}`;
    const detail = r.bestOf > 1 ? games.map(g => `${g.a}-${g.b}`).join(' · ') : '';
    mid = `<span class="mid">${main}${detail ? `<small>${detail}</small>` : ''}</span>`;
  }
  const tag = st === 'live' ? `<span class="tag live">${t('live')}</span>`
    : st === 'done' ? `<span class="tag done">${t('ft')}</span>` : `<span class="tag">${esc(f.short)}</span>`;
  return `<div class="fx ${st === 'live' ? 'is-live' : ''}">
    <span class="when"><b>≈ ${clock(approx[f.id])}</b>${esc(courtName(f.court))}</span>
    <span class="side ${cls('a')}">${esc(side(f, 'a'))}</span>${mid}<span class="side ${cls('b')}">${esc(side(f, 'b'))}</span>
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
  const capped = limit && !fxShowAll && fxFilter === 'all';
  if (capped) {
    // focus around "now": a couple of finished matches, then live and upcoming
    const firstOpen = list.findIndex(f => statusOf(state, f.id) !== 'done');
    const from = Math.max(0, Math.min((firstOpen < 0 ? list.length : firstOpen) - 2, list.length - limit));
    shown = list.slice(from, from + limit);
  }
  el.innerHTML = shown.length ? shown.map(fxRow).join('') : `<p class="prov">${t('noResults')}</p>`;
  const more = $('#fxMore');
  if (more) {
    more.hidden = !(limit && fxFilter === 'all');
    more.querySelector('.t').textContent = fxShowAll ? t('fewer') : t('allMatches', list.length);
  }
}

// ── Standings: gold top four, dimmed bottom two, movement arrows ──
const ROW_H = 56;
const prevRank = {};          // last rank shown for each pair
const moved = {};             // pairId → { by, until }
let baseline = false;         // arrows only for changes after the first real data arrives
const maxW = r => r.w + (r.scheduled - r.p);
// Certain outcomes only. Through: fewer than 4 other pairs can still reach this pair's wins.
// Out: 4 or more pairs already have more wins than this pair can still reach.
function qualStatus(list, r) {
  // group finished: the final table (with tiebreaks) decides
  if (list.every(o => o.p === o.scheduled)) return r.q ? 'in' : 'out';
  const others = list.filter(o => o.id !== r.id);
  if (r.p > 0 && others.filter(o => maxW(o) >= r.w).length < QUALIFIERS_PER_GROUP) return 'in';
  if (others.filter(o => o.w > maxW(r)).length >= QUALIFIERS_PER_GROUP) return 'out';
  return '';
}

function renderStandings() {
  const host = $('[data-standings]');
  if (!host) return;
  if (host.dataset.lang !== t('pair')) {
    host.innerHTML = GROUPS.map(g => `<div class="tbl" data-g="${g.id}">
      <h3>${esc(groupName(g.id))} <small>${esc(courtName(g.court))}</small></h3>
      <div class="head"><span>#</span><span>${t('hPair')}</span><span>${t('hP')}</span><span>${t('hW')}</span><span>${t('hL')}</span><span>+/−</span><span>${t('hPts')}</span></div>
      <div class="rows" style="height:${g.pairs.length * ROW_H}px"></div>
      <div class="note"><i></i>${t('top4')}</div>
      <div class="race" data-race="${g.id}"></div></div>`).join('');
    host.dataset.lang = t('pair');
  }
  const now = Date.now();
  for (const g of GROUPS) {
    const rowsEl = $(`.tbl[data-g="${g.id}"] .rows`, host);
    const list = computeStandings(state, g.id);
    list.forEach((r, i) => {
      let row = $(`[data-id="${r.id}"]`, rowsEl);
      if (!row) {
        row = document.createElement('button');
        row.type = 'button';
        row.className = 'r'; row.dataset.id = r.id;
        rowsEl.append(row);
      }
      // movement since the last update (shown for 8 seconds)
      if (baseline && prevRank[r.id] && prevRank[r.id] !== r.rank) moved[r.id] = { by: prevRank[r.id] - r.rank, until: now + 8000 };
      prevRank[r.id] = r.rank;
      const mv = moved[r.id] && moved[r.id].until > now ? moved[r.id].by : 0;
      const sig = `${r.p}|${r.w}|${r.diff}`;
      if (row.dataset.sig && row.dataset.sig !== sig) { row.classList.add('flash'); setTimeout(() => row.classList.remove('flash'), 1400); }
      row.dataset.sig = sig;
      const qs = qualStatus(list, r);
      row.classList.toggle('q', r.q);
      row.classList.toggle('dim', !r.q);
      row.classList.toggle('cut', i === QUALIFIERS_PER_GROUP - 1);
      row.classList.toggle('is-in', qs === 'in'); row.classList.toggle('is-out', qs === 'out');
      row.style.transform = `translateY(${i * ROW_H}px)`;
      row.setAttribute('aria-label', `${name(r.id)}: ${t('record')}`);
      row.innerHTML = `<span class="pos">${r.rank}${mv ? `<i class="mv ${mv > 0 ? 'up' : 'down'}">${mv > 0 ? '▲' : '▼'}${Math.abs(mv)}</i>` : ''}</span>
        <span class="nm">${esc(name(r.id))}${qs ? ` <i class="qs ${qs}">${qs === 'in' ? 'Q' : t('outTag')}</i>` : ''}</span>
        <span>${r.p}</span><span>${r.w}</span><span>${r.l}</span><span>${r.diff > 0 ? '+' : ''}${r.diff}</span><span class="pts">${r.pts}</span>`;
    });
    renderRace(g, list);
  }
  // clear arrows once they expire
  const next = Object.values(moved).filter(m => m.until > now).map(m => m.until - now);
  if (next.length) { clearTimeout(renderStandings.timer); renderStandings.timer = setTimeout(renderStandings, Math.min(...next) + 50); }
}

// ── Qualification race: wins, losses and matches still to play ──
function renderRace(g, list) {
  const el = $(`[data-race="${g.id}"]`);
  if (!el) return;
  const per = g.pairs.length - 1;                       // matches per pair in the group
  const left = FIXTURES.filter(f => f.group === g.id && statusOf(state, f.id) !== 'done').length;
  const cutW = list[QUALIFIERS_PER_GROUP - 1]?.w ?? 0;   // wins of the pair currently 4th
  el.innerHTML = `<div class="race-hd"><span class="label plain">${t('raceTitle')}</span>
      <span class="race-left">${left ? t('groupLeft', left) : t('groupDone')}</span></div>
    ${list.map(r => {
      const qs = qualStatus(list, r);
      const rem = r.scheduled - r.p;
      const st = qs === 'in' ? `<b class="rs in">${t('qualified')}</b>`
        : qs === 'out' ? `<b class="rs out">${t('eliminated')}</b>`
        : `<b class="rs">${t('inRace')}</b>`;
      const cells = [
        ...Array(r.w).fill('w'), ...Array(r.l).fill('l'), ...Array(rem).fill('o'),
      ].slice(0, per).map(c => `<i class="${c}"></i>`).join('');
      return `<button type="button" class="race-row ${qs}" data-id="${r.id}">
        <span class="rn">${esc(name(r.id))}</span>
        <span class="rb" style="--cut:${cutW}">${cells}<em class="cutline" style="left:calc(${cutW} / ${per} * 100%)"></em></span>
        <span class="rr">${st}<small>${rem ? t('left', rem) : ''}</small></span>
      </button>`;
    }).join('')}
    <div class="race-key"><span><i class="w"></i>${t('kWin')}</span><span><i class="l"></i>${t('kLoss')}</span><span><i class="o"></i>${t('kLeft')}</span><span><em></em>${t('kCut')}</span></div>`;
}

// ── Match of the day + highlights, from the rally-by-rally record ──
function matchStats(f) {
  const rec = state.matches[f.id];
  const r = rulesFor(f);
  const ev = evalMatch(rec, r);
  const games = ev.games.filter(g => g.a || g.b);
  let margin = 0, rallies = 0, comeback = null, deuce = false;
  games.forEach((g, gi) => {
    margin += Math.abs(g.a - g.b);
    rallies += g.a + g.b;
    if (Math.max(g.a, g.b) > r.target) deuce = true;
    if (!g.winner) return;
    const W = g.winner, L = W === 'a' ? 'b' : 'a';
    let a = 0, b = 0, worst = 0, at = null;
    for (const c of g.seq) {
      c === 'a' ? a++ : b++;
      const s = { a, b };
      const gap = s[L] - s[W];
      if (gap > worst) { worst = gap; at = { w: s[W], l: s[L], game: gi + 1 }; }
    }
    if (worst > 0 && (!comeback || worst > comeback.gap)) comeback = { gap: worst, side: W, ...at };
  });
  const fromGameDown = games.length > 1 && games[0].winner && games[0].winner !== rec.winner;
  // excitement: comebacks, tight finishes, deciding games and extra points all count
  const score = (comeback ? comeback.gap * 2 : 0) + Math.max(0, 12 - margin) + (games.length === 3 ? 6 : 0) + (deuce ? 5 : 0) + (fromGameDown ? 4 : 0);
  return { f, rec, games, margin, rallies, comeback, deuce, fromGameDown, score };
}

function renderHighlights() {
  const el = $('#highlights');
  if (!el) return;
  const done = FIXTURES.filter(f => statusOf(state, f.id) === 'done').map(f => matchStats(res[f.id]));
  if (!done.length) { el.innerHTML = `<p class="hl-empty">${t('hlEmpty')}</p>`; return; }
  // each card features a different match whenever there are enough matches to choose from
  const used = new Set();
  const pick = (list, key) => {
    const sorted = list.slice().sort((x, y) => key(y) - key(x) || (y.rec.endedAt || 0) - (x.rec.endedAt || 0));
    const d = sorted.find(x => !used.has(x.f.id)) || sorted[0];
    if (d) used.add(d.f.id);
    return d;
  };
  const motd = pick(done, d => d.score);
  const cb = pick(done.filter(d => d.comeback && d.comeback.gap >= 3), d => d.comeback.gap);
  const closest = pick(done, d => -d.margin);
  const longest = pick(done, d => d.rallies);
  const bigwin = pick(done, d => d.margin);

  const scoreTxt = d => d.games.map(g => `${g.a}–${g.b}`).join(' · ');
  const winner = d => side(d.f, d.rec.winner);
  const loser = d => side(d.f, d.rec.winner === 'a' ? 'b' : 'a');
  const why = d => {
    const bits = [];
    if (d.comeback && d.comeback.gap >= 3) bits.push(t('fromDown', d.comeback.l, d.comeback.w));
    if (d.fromGameDown) bits.push(t('fromGameDown'));
    if (d.deuce) bits.push(t('wentLong'));
    if (d.games.length === 3 && !d.fromGameDown) bits.push(t('decider'));
    if (!bits.length) bits.push(t('margin', d.margin));
    return bits.join(' · ');
  };
  const card = (label, d, big, extra) => `<button type="button" class="hl ${big ? 'motd' : ''}" data-id="${d.rec.winner === 'a' ? d.f.a : d.f.b}">
      <span class="hl-k">${label}</span>
      <span class="hl-m">${esc(fxLabel(d.f))} · ${esc(courtName(d.f.court))}</span>
      <span class="hl-w">${esc(winner(d))}</span>
      <span class="hl-v">${t('beat')} ${esc(loser(d))}</span>
      <span class="hl-s">${scoreTxt(d)}</span>
      <span class="hl-x">${extra}</span>
    </button>`;
  el.innerHTML = card(t('motd'), motd, true, why(motd))
    + `<div class="hl-grid">`
    + card(t('closest'), closest, false, t('margin', closest.margin))
    + (cb ? card(t('comeback'), cb, false, t('fromDown', cb.comeback.l, cb.comeback.w)) : '')
    + card(t('longest'), longest, false, t('rallies', longest.rallies))
    + card(t('bigwin'), bigwin, false, t('margin', bigwin.margin))
    + `</div>`;
}

// ── Homepage teaser: one line per court ──────────────────────
function renderTeaser() {
  const el = $('#mcTeaser');
  if (!el) return;
  el.innerHTML = [1, 2].map(n => {
    const { live, next } = courtNow(state, n);
    let body;
    if (live) {
      const { ev } = scoreLine(live);
      body = `<span class="tag live">${t('live')}</span><span class="tz-m">${esc(side(live, 'a'))} <b>${ev.cur.a}–${ev.cur.b}</b> ${esc(side(live, 'b'))}</span>`;
    } else if (next) {
      body = `<span class="tag">${t('upnext')}</span><span class="tz-m">${esc(side(next, 'a'))} ${t('v')} ${esc(side(next, 'b'))} <small>≈ ${clock(approx[next.id])}</small></span>`;
    } else {
      body = `<span class="tag done">${t('done')}</span><span class="tz-m">${t('noMore')}</span>`;
    }
    return `<a class="tz" href="live.html#courts-sec"><span class="tz-c">${esc(COURT_LABEL[n])}</span>${body}</a>`;
  }).join('');
}

// ── Bracket ──────────────────────────────────────────────────
function bm(id) {
  const f = res[id];
  const st = statusOf(state, id);
  const sl = scoreLine(f);
  const w = st === 'done' ? state.matches[id].winner : null;
  const row = s => {
    const known = !!f[s];
    const sc = sl && st !== 'scheduled' ? sl.ev.games.filter(g => g.a || g.b).map(g => g[s]).join(' ') : '';
    return `<div class="br ${w ? (w === s ? 'w' : 'l') : ''}"><span class="n ${known ? '' : 'tbd'}">${esc(side(f, s))}</span><span class="s">${sc}</span></div>`;
  };
  const tag = st === 'live' ? `<span class="tag live" style="padding:1px 6px">${t('live')}</span>` : `<span>${esc(COURT_LABEL[f.court])} · ≈ ${clock(approx[id])}</span>`;
  return `<div class="bm ${st} ${w ? 'has-winner' : ''}"><div class="bh"><span>${esc(fxLabel(f))}</span>${tag}</div>${row('a')}${row('b')}</div>`;
}
function renderBracket() {
  const el = $('#bracket');
  if (!el) return;
  const fin = state.matches?.FINAL;
  const champ = fin?.status === 'done' ? name(res.FINAL[fin.winner]) : null;
  el.innerHTML = `
    <div class="round"><h4>${t('QFs')}</h4><div class="slots">${['QF1', 'QF2', 'QF3', 'QF4'].map(bm).join('')}</div></div>
    <div class="round"><h4>${t('SFs')}</h4><div class="slots">${['SF1', 'SF2'].map(bm).join('')}</div></div>
    <div class="round final-col"><h4>${t('FINAL')}</h4><div class="slots">
      <div>${bm('FINAL')}
        <div class="champ-slot ${champ ? 'won' : ''}"><span class="label plain">${t('champsE3')}</span><b>${esc(champ || t('tbdecided'))}</b></div></div>
      <div><h4 style="margin:10px 0 12px">${t('BRONZE')}</h4>${bm('BRONZE')}</div>
    </div></div>`;
}

// ── Pair cards + profile ─────────────────────────────────────
function renderPairs() {
  const el = $('#pairs');
  if (!el) return;
  const g = el.dataset.group || 'G1';
  const group = GROUPS.find(x => x.id === g);
  const table = Object.fromEntries(computeStandings(state, g).map(r => [r.id, r]));
  el.innerHTML = group.pairs.map(p => {
    const r = table[p.id];
    return `<button class="pair" data-id="${p.id}">
      <span class="num" aria-hidden="true">${num2(p.id)}</span>
      <span class="meta">${esc(groupName(g))}</span>
      <span class="pn">${esc(name(p.id))}</span>
      <span class="pp">${p.players ? esc(p.players.join(' · ')) : t('playersTBA')}</span>
      <span class="stats"><span><b>${r.p}</b>${t('hP')}</span><span><b>${r.w}</b>${t('hW')}</span><span><b>${r.l}</b>${t('hL')}</span><span><b>${r.diff > 0 ? '+' : ''}${r.diff}</b>${t('diff')}</span></span>
    </button>`;
  }).join('');
}

let openId = null;
function renderProfile() {
  const dlg = $('#profile');
  if (!dlg || !openId) return;
  const id = openId;
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
      out = st === 'live' ? `${t('live')} ${g}` : `${won === me ? t('hW') : t('hL')} ${g}`;
    }
    return `<div class="row"><span><b>${esc(f.short)}</b> <span class="vs">${t('v')} ${esc(side(f, them))} · ${esc(courtName(f.court))}</span></span><span class="res">${esc(out)}</span></div>`;
  }).join('');
  dlg.innerHTML = `<div class="ph"><button class="close" aria-label="${t('close')}" data-close>✕</button>
      <div class="meta">${esc(groupName(group.id))} · ${esc(courtName(group.court))} · ${t('rank')} ${r.rank}</div>
      <h3 class="display">${esc(name(id))}</h3>
      <div class="meta" style="margin-top:8px">${p.players ? esc(p.players.join(' & ')) : t('playersTBA')}</div></div>
    <div class="pb">
      <div class="row"><span>${t('record')}</span><span class="res">${r.w}${t('hW')} – ${r.l}${t('hL')} · ${r.diff > 0 ? '+' : ''}${r.diff}</span></div>
      <h4 class="label" style="margin:22px 0 4px">${t('matches')}</h4>${rows}
    </div>`;
}
function openProfile(id) {
  const dlg = $('#profile');
  if (!dlg) return;
  openId = id;
  renderProfile();
  if (dlg.showModal) dlg.showModal(); else dlg.setAttribute('open', '');
  document.documentElement.classList.add('modal-open');
}
function closeProfile() {
  const dlg = $('#profile');
  openId = null;
  if (dlg.close) dlg.close(); else dlg.removeAttribute('open');
  document.documentElement.classList.remove('modal-open');
}

// ── Header bits: live pill ───────────────────────────────────
function renderMeta() {
  const liveCount = FIXTURES.filter(f => statusOf(state, f.id) === 'live').length;
  $$('.live-pill').forEach(p => { p.classList.toggle('on', liveCount > 0); p.innerHTML = `${liveCount}<span class="lp-t">&nbsp;${t('live')}</span>`; });
}

let connOk = null, demoBanner = null;
function renderConn() {
  $$('.conn').forEach(c => {
    c.classList.toggle('ok', connOk === true); c.classList.toggle('off', connOk === false);
    c.querySelector('span').textContent = connOk === null ? t('connecting') : connOk ? t('sync') : t('reconnect');
  });
  if (demoBanner) demoBanner.textContent = params.get('demo') === 'sim' ? t('demoSim') : t('demo');
}

function renderRecent() {
  const el = $('#recent');
  if (!el) return;
  const done = FIXTURES.filter(f => statusOf(state, f.id) === 'done')
    .sort((a, b) => (state.matches[b.id].endedAt || 0) - (state.matches[a.id].endedAt || 0)).slice(0, 4);
  el.hidden = !done.length;
  if (!done.length) return;
  el.innerHTML = `<h4 class="label">${t('latest')}</h4><div class="recent-row">${done.map(fx => {
    const f = res[fx.id];
    const { ev } = scoreLine(f);
    const w = state.matches[f.id].winner;
    const sc = rulesFor(f).bestOf > 1 ? ev.games.filter(g => g.a || g.b).map(g => `${g.a}-${g.b}`).join(' ') : `${ev.cur.a}-${ev.cur.b}`;
    return `<div class="rc"><span class="rc-l">${esc(fxLabel(f))}</span>
      <span class="rc-n ${w === 'a' ? 'w' : ''}">${esc(side(f, 'a'))}</span>
      <span class="rc-n ${w === 'b' ? 'w' : ''}">${esc(side(f, 'b'))}</span>
      <span class="rc-s">${sc}</span></div>`;
  }).join('')}</div>`;
}

function renderChampion() {
  const fin = state.matches?.FINAL;
  const champ = fin?.status === 'done' ? name(res.FINAL?.[fin.winner]) : null;
  $$('[data-champion]').forEach(el => {
    el.hidden = !champ;
    if (champ) el.innerHTML = `<div class="wrap"><img src="assets/e3/crest-240.webp" alt="" width="240" height="335">
      <div><span class="label plain">${t('champsE3')}</span><b>${esc(champ)}</b></div></div>`;
  });
}

function renderAll() {
  res = resolveFixtures(state);
  renderRecent();
  renderChampion();
  renderTeaser();
  renderHighlights();
  const courts = $('#courts');
  if (courts) courts.innerHTML = courtCard(1) + courtCard(2);
  renderFixtures();
  renderStandings();
  renderBracket();
  renderPairs();
  renderProfile();
  renderMeta();
  renderConn();
}

// ── Simulated results for ?demo=sim (local only) ─────────────
function seq(aPts, bPts, winner) {
  const arr = [...Array(aPts).fill('a'), ...Array(bPts).fill('b')];
  arr.splice(arr.lastIndexOf(winner), 1);
  for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; }
  return arr.join('') + winner;
}
async function simulate(store) {
  let rnd = 7;
  const r = () => (rnd = (rnd * 9301 + 49297) % 233280) / 233280;
  const play = (f, live) => {
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
  const snap = () => { try { return JSON.parse(localStorage.getItem(`${DB_ROOT}-demo-state`) || '{}'); } catch { return {}; } };
  for (const f of FIXTURES.filter(f => f.stage === 'group')) await store.transactMatch(f.id, () => play(f));
  for (const id of ['QF1', 'QF2', 'QF3', 'QF4']) {
    const cur = resolveFixtures(snap())[id];
    await store.transactMatch(id, () => ({ ...play(FIXTURES.find(f => f.id === id)), a: cur.a, b: cur.b }));
  }
  const cur = resolveFixtures(snap());
  await store.transactMatch('SF1', () => ({ ...play(FIXTURES.find(f => f.id === 'SF1'), true), a: cur.SF1.a, b: cur.SF1.b }));
}

// ── Mount ────────────────────────────────────────────────────
export async function mountLive() {
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
  // any pair button (cards, standings rows, race rows, highlights) opens that pair's match history
  document.addEventListener('click', e => {
    const c = e.target.closest('.pair, [data-standings] .r, .race-row, .hl');
    if (c?.dataset.id) openProfile(c.dataset.id);
  });
  const dlg = $('#profile');
  dlg?.addEventListener('click', e => { if (e.target === dlg || e.target.closest('[data-close]')) closeProfile(); });
  dlg?.addEventListener('close', () => { openId = null; document.documentElement.classList.remove('modal-open'); });
  addEventListener('langchange', renderAll);

  renderAll(); // draw placeholders immediately

  const store = await openStore();
  if (store.mode === 'demo') {
    demoBanner = document.createElement('div');
    demoBanner.className = 'demo-banner';
    document.body.append(demoBanner);
    if (params.get('demo') === 'sim' && !localStorage.getItem(`${DB_ROOT}-demo-state`)) await simulate(store);
  }
  store.onConnection(ok => { connOk = ok; renderConn(); });
  let first = true;
  store.subscribe(s => {
    state = s || {}; renderAll(); baseline = true;
    // links like live.html#standings-sec: jump again once the tables have their real height
    if (first && location.hash) {
      first = false;
      const target = document.querySelector(location.hash);
      if (target) requestAnimationFrame(() => target.scrollIntoView({ block: 'start' }));
    }
    first = false;
  });
  return store;
}
