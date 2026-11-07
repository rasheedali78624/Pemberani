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

// ── Standings (rows glide when the order changes) ────────────
const ROW_H = 56;
function renderStandings() {
  const host = $('[data-standings]');
  if (!host) return;
  if (host.dataset.lang !== t('pair')) {
    host.innerHTML = GROUPS.map(g => `<div class="tbl" data-g="${g.id}">
      <h3>${esc(groupName(g.id))} <small>${esc(courtName(g.court))}</small></h3>
      <div class="head"><span>#</span><span>${t('hPair')}</span><span>${t('hP')}</span><span>${t('hW')}</span><span>${t('hL')}</span><span>+/−</span><span>${t('hPts')}</span></div>
      <div class="rows" style="height:${g.pairs.length * ROW_H}px"></div>
      <div class="note"><i></i>${t('top4')}</div><div class="note legend"><b class="qs in">Q</b> ${t('qIn')} &nbsp; <b class="qs out">${t('outTag')}</b> ${t('qOut')}</div></div>`).join('');
    host.dataset.lang = t('pair');
  }
  for (const g of GROUPS) {
    const rowsEl = $(`.tbl[data-g="${g.id}"] .rows`, host);
    const list = computeStandings(state, g.id);
    // Certain outcomes only. Through: fewer than 4 other pairs can still reach this pair's wins.
    // Out: 4 or more pairs already have more wins than this pair can still reach.
    const maxW = r => r.w + (r.scheduled - r.p);
    const status = r => {
      const others = list.filter(o => o.id !== r.id);
      if (others.filter(o => maxW(o) >= r.w).length < QUALIFIERS_PER_GROUP && r.p > 0) return 'in';
      if (others.filter(o => o.w > maxW(r)).length >= QUALIFIERS_PER_GROUP) return 'out';
      return '';
    };
    list.forEach((r, i) => {
      let row = $(`[data-id="${r.id}"]`, rowsEl);
      if (!row) {
        row = document.createElement('div');
        row.className = 'r'; row.dataset.id = r.id;
        rowsEl.append(row);
      }
      const sig = `${r.p}|${r.w}|${r.diff}`;
      if (row.dataset.sig && row.dataset.sig !== sig) { row.classList.add('flash'); setTimeout(() => row.classList.remove('flash'), 1200); }
      row.dataset.sig = sig;
      row.classList.toggle('q', r.q);
      row.classList.toggle('cut', i === QUALIFIERS_PER_GROUP - 1);
      row.style.transform = `translateY(${i * ROW_H}px)`;
      const qs = status(r);
      row.classList.toggle('is-in', qs === 'in'); row.classList.toggle('is-out', qs === 'out');
      row.innerHTML = `<span class="pos">${r.rank}</span><span class="nm">${esc(name(r.id))}${qs ? ` <i class="qs ${qs}">${qs === 'in' ? 'Q' : t('outTag')}</i>` : ''}</span>
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
      <h4 class="label" style="margin:22px 0 4px">${t('groupMatches')}</h4>${rows}
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
  $('#pairs')?.addEventListener('click', e => { const c = e.target.closest('.pair'); if (c) openProfile(c.dataset.id); });
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
  store.subscribe(s => { state = s || {}; renderAll(); });
  return store;
}
