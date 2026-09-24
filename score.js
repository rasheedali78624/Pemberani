import { openStore } from './store.js';
import { GROUPS, FIXTURES } from './config.js';
import {
  evalMatch, rulesFor, addPoint, undoPoint, resolveFixtures, courtNow, statusOf, pairName,
} from './logic.js';

const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const ls = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch {} },
};

const store = await openStore({ auth: true });
let state = {};
let user = null;
let court = +(ls.get('pt2-court') || 1);
let swapped = ls.get('pt2-swap') === '1';
let wakeLock = null;

function toast(msg) {
  const t = $('#toast');
  t.textContent = msg; t.classList.add('show');
  clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('show'), 2200);
}
const buzz = ms => navigator.vibrate?.(ms);

async function keepAwake(on) {
  try {
    if (on && !wakeLock && navigator.wakeLock) wakeLock = await navigator.wakeLock.request('screen');
    if (!on && wakeLock) { await wakeLock.release(); wakeLock = null; }
  } catch {}
}
// The browser drops the wake lock when the tab is hidden; re-acquire on return.
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') { wakeLock = null; render(); }
});

async function transact(id, fn, failMsg = 'Could not save — check your connection') {
  try {
    return await store.transactMatch(id, fn);
  } catch (e) {
    console.error(e);
    toast(e?.message?.includes('permission') ? 'No permission — is this account an admin?' : failMsg);
    return false;
  }
}

// ── Sheets ───────────────────────────────────────────────

function sheet(html) {
  $('#sheet').innerHTML = html;
  $('#sheetBg').classList.add('open');
}
function closeSheet() { $('#sheetBg').classList.remove('open'); }
$('#sheetBg').addEventListener('click', e => { if (e.target.id === 'sheetBg' || e.target.closest('[data-close]')) closeSheet(); });

function askStart(fx) {
  const a = pairName(fx.a), b = pairName(fx.b);
  sheet(`<h3>${esc(fx.label)}</h3><p>Who serves first?</p>
    <div class="opts">
      <button class="btn btn-quiet" data-serve="a">${esc(a)}</button>
      <button class="btn btn-quiet" data-serve="b">${esc(b)}</button>
      <button class="btn" data-close style="color:var(--muted)">Cancel</button>
    </div>`);
  $$('#sheet [data-serve]').forEach(btn => btn.onclick = async () => {
    closeSheet();
    const live = courtNow(state, court).live;
    if (live && live.id !== fx.id) return toast(`${live.label} is still live on this court`);
    const ok = await transact(fx.id, cur => (cur?.status ? undefined : {
      status: 'live', games: [''], serve: btn.dataset.serve, startedAt: Date.now(), court,
      ...(fx.stage === 'knockout' ? { a: fx.a, b: fx.b } : {}),
    }));
    if (ok) { buzz(30); toast('Match started — good luck!'); }
  });
}

// ── Main view ────────────────────────────────────────────

function renderQueue() {
  const { queue, next } = courtNow(state, court);
  return `<div class="card">
    ${queue.map(f => {
      const st = statusOf(state, f.id);
      const ready = f.a && f.b;
      const a = pairName(f.a) || f.placeholderA, b = pairName(f.b) || f.placeholderB;
      let action = '';
      if (st === 'done') {
        const ev = evalMatch(state.matches[f.id], rulesFor(f));
        action = `<span class="muted tnum" style="font-size:14px">${ev.games.map(g => `${g.a}–${g.b}`).join(', ')}</span>`;
      } else if (ready) {
        action = `<button class="btn btn-sm ${f.id === next?.id ? 'btn-primary' : 'btn-quiet'}" data-start="${f.id}">Start</button>`;
      } else {
        action = '<span class="muted" style="font-size:13px">Waiting</span>';
      }
      return `<div class="q-item ${st === 'done' ? 'done' : ''}">
        <span class="no">${esc(f.short)}</span>
        <span class="t">${esc(a)} <span>vs</span> ${esc(b)}</span>
        ${action}</div>`;
    }).join('')}
  </div>`;
}

function pad(fx, rec, ev, side) {
  const r = rulesFor(fx);
  const serving = ev.server === side;
  const dots = r.bestOf > 1 ? `<div class="pg">${Array.from({ length: ev.need }, (_, i) => `<i class="${i < ev.won[side] ? 'on' : ''}"></i>`).join('')}</div>` : '';
  return `<button class="pad ${serving ? 'serving' : ''}" data-point="${side}">
    ${serving ? `<span class="sv">● Serving · ${ev.serveCourt} court</span>` : ''}
    ${dots}
    <span class="pn">${esc(pairName(fx[side]))}</span>
    <span class="ps tnum">${ev.cur[side]}</span>
    ${ev.point[side] ? `<span class="fl flag">${ev.point[side]}</span>` : ''}
  </button>`;
}

function renderLive(fx) {
  const rec = state.matches[fx.id];
  const ev = evalMatch(rec, rulesFor(fx));
  const multi = rulesFor(fx).bestOf > 1;
  const sides = swapped ? ['b', 'a'] : ['a', 'b'];
  const prev = ev.games.slice(0, -1).map(g => `${g.a}–${g.b}`).join(', ');
  return `
    <div class="sc-head">
      <span class="lbl"><b>${esc(fx.label)}</b>${multi ? ` · Game ${ev.gameNo}` : ''}${prev ? ` · ${prev}` : ''}</span>
      <span class="status live"><span class="dot"></span>Live</span>
    </div>
    ${ev.interval ? `<div class="notice">Interval — 60 seconds.${ev.gameNo === 3 ? ' Change ends.' : ''}</div>` : ''}
    <div class="pads">${pad(fx, rec, ev, sides[0])}${pad(fx, rec, ev, sides[1])}</div>
    <div class="tools">
      <button class="btn btn-quiet" id="undo">↶ Undo</button>
      <button class="btn btn-quiet" id="swap">⇅ Swap</button>
      <button class="btn btn-quiet danger" id="abandon">Stop</button>
    </div>`;
}

function renderDone(fx) {
  const rec = state.matches[fx.id];
  const ev = evalMatch(rec, rulesFor(fx));
  const w = rec.winner, l = w === 'a' ? 'b' : 'a';
  return `<div class="card result">
      <small>${esc(fx.label)} · Final</small>
      <h2>${esc(pairName(fx[w]))} win</h2>
      <div class="gs tnum">${ev.games.map(g => `${g[w]}–${g[l]}`).join(', ')} vs ${esc(pairName(fx[l]))}</div>
      <div style="display:flex; gap:10px; justify-content:center; margin-top:20px; flex-wrap:wrap">
        <button class="btn btn-quiet" id="undoDone">↶ Undo last point</button>
        <button class="btn btn-primary" id="dismiss">Next match</button>
      </div>
    </div>`;
}

let justFinished = null;

function render() {
  if (!user) return;
  $$('#courtTabs button').forEach(b => b.setAttribute('aria-selected', +b.dataset.court === court));
  moveThumb($('#courtTabs'));

  const res = resolveFixtures(state);
  const { live } = courtNow(state, court);
  const main = $('#main');

  if (live) {
    main.innerHTML = renderLive(live);
    keepAwake(true);
    $$('[data-point]').forEach(b => b.onclick = () => point(live, b.dataset.point));
    $('#undo').onclick = () => undo(live);
    $('#swap').onclick = () => { swapped = !swapped; ls.set('pt2-swap', swapped ? '1' : '0'); render(); };
    $('#abandon').onclick = () => {
      sheet(`<h3>Stop this match?</h3><p>All points in ${esc(live.label)} will be cleared and it goes back to “not played”.</p>
        <div class="opts"><button class="btn danger" id="confirmStop">Stop and clear</button><button class="btn btn-quiet" data-close>Keep playing</button></div>`);
      $('#confirmStop').onclick = async () => { closeSheet(); if (await transact(live.id, () => null)) toast('Match cleared'); };
    };
  } else if (justFinished && res[justFinished]?.court === court && statusOf(state, justFinished) === 'done') {
    const fx = res[justFinished];
    main.innerHTML = renderDone(fx);
    keepAwake(false);
    $('#undoDone').onclick = () => undo(fx);
    $('#dismiss').onclick = () => { justFinished = null; render(); };
  } else {
    keepAwake(false);
    main.innerHTML = renderQueue();
    $$('[data-start]').forEach(b => b.onclick = () => askStart(res[b.dataset.start]));
  }
  renderAdmin(res);
}

async function point(fx, side) {
  buzz(12);
  const ok = await transact(fx.id, cur => addPoint(cur, side, rulesFor(fx)));
  if (ok && state.matches?.[fx.id]?.status === 'done') {
    justFinished = fx.id; buzz([40, 60, 40]); render();
  }
}
async function undo(fx) {
  buzz(8);
  const ok = await transact(fx.id, cur => undoPoint(cur));
  if (ok) { justFinished = null; toast('Point undone'); }
}

// ── Committee tools ──────────────────────────────────────

function renderAdmin(res) {
  const ko = FIXTURES.filter(f => f.stage === 'knockout');
  const opts = (sel) => '<option value="">Auto</option>' + GROUPS.map(g =>
    `<optgroup label="${esc(g.name)}">${g.pairs.map(p => `<option value="${p.id}" ${p.id === sel ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}</optgroup>`).join('');
  const box = $('#koAdmin');
  if (!box.contains(document.activeElement)) {
    box.innerHTML = ko.map(f => {
      const ov = state.ko?.[f.id] || {};
      const locked = statusOf(state, f.id) !== 'scheduled';
      return `<div class="ko-row"><b>${f.id}</b>
        <select class="select" data-ko="${f.id}" data-side="a" ${locked ? 'disabled' : ''} title="${esc(res[f.id].placeholderA)}">${opts(ov.a)}</select>
        <select class="select" data-ko="${f.id}" data-side="b" ${locked ? 'disabled' : ''} title="${esc(res[f.id].placeholderB)}">${opts(ov.b)}</select></div>`;
    }).join('');
    $$('[data-ko]').forEach(s => s.onchange = async () => {
      try { await store.setKo(s.dataset.ko, s.dataset.side, s.value); toast('Saved'); }
      catch (e) { console.error(e); toast('Could not save override'); }
    });
  }
  const played = FIXTURES.filter(f => statusOf(state, f.id) !== 'scheduled');
  const rs = $('#resetSel');
  if (document.activeElement !== rs) {
    rs.innerHTML = played.length
      ? played.map(f => `<option value="${f.id}">${esc(f.id)} · ${esc(pairName(res[f.id].a))} vs ${esc(pairName(res[f.id].b))}</option>`).join('')
      : '<option value="">No results yet</option>';
  }
}

$('#resetBtn').onclick = () => {
  const id = $('#resetSel').value;
  if (!id) return;
  sheet(`<h3>Reset ${esc(id)}?</h3><p>The score will be deleted and the match will show as not played. Standings and the bracket update immediately.</p>
    <div class="opts"><button class="btn danger" id="confirmReset">Reset match</button><button class="btn btn-quiet" data-close>Cancel</button></div>`);
  $('#confirmReset').onclick = async () => { closeSheet(); if (await transact(id, () => null)) toast(`${id} reset`); };
};

// ── Chrome ───────────────────────────────────────────────

function moveThumb(seg) {
  const on = seg.querySelector('[aria-selected="true"]');
  const th = seg.querySelector('.thumb');
  if (!on || !th) return;
  th.style.width = on.offsetWidth + 'px';
  th.style.transform = `translateX(${on.offsetLeft}px)`;
}

$('#courtTabs').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  court = +b.dataset.court; ls.set('pt2-court', court); justFinished = null; render();
});

$('#login').addEventListener('submit', async e => {
  e.preventDefault();
  $('#loginErr').textContent = '';
  try { await store.auth.signIn($('#email').value.trim(), $('#password').value); }
  catch (err) {
    console.error(err);
    const reasons = {
      'auth/invalid-credential': 'Wrong email or password, or this user doesn’t exist in Firebase → Authentication → Users.',
      'auth/invalid-email': 'That email address isn’t valid.',
      'auth/user-not-found': 'No user with this email in Firebase → Authentication → Users.',
      'auth/wrong-password': 'Wrong password.',
      'auth/operation-not-allowed': 'Email/Password sign-in is turned off. Enable it in Firebase → Authentication → Sign-in method.',
      'auth/configuration-not-found': 'Authentication isn’t set up yet. In Firebase → Authentication, click Get started and enable Email/Password.',
      'auth/unauthorized-domain': `This site (${location.hostname}) isn’t allowed. Add it in Firebase → Authentication → Settings → Authorized domains.`,
      'auth/too-many-requests': 'Too many attempts. Wait a few minutes and try again.',
      'auth/network-request-failed': 'No internet connection.',
      'auth/api-key-not-valid.-please-pass-a-valid-api-key.': 'The apiKey in js/firebase-config.js is wrong. Copy it again from Firebase → Project settings → Your apps.',
      'auth/invalid-api-key': 'The apiKey in js/firebase-config.js is wrong. Copy it again from Firebase → Project settings → Your apps.',
    };
    $('#loginErr').textContent = reasons[err?.code] || `Sign-in failed (${err?.code || err?.message || 'unknown error'}).`;
  }
});
$('#signOut').onclick = () => store.auth.signOut();

store.auth.onChange(u => {
  user = u;
  $('#login').classList.toggle('hide', !!u);
  $('#console').classList.toggle('hide', !u);
  $('#signOut').classList.toggle('hide', !u || store.mode === 'demo');
  render();
});
store.onConnection(ok => {
  $('#conn').className = 'status' + (ok ? ' done' : ' live');
  $('#conn').innerHTML = `<span class="dot"></span>${store.mode === 'demo' ? 'Demo' : ok ? 'Online' : 'Offline'}`;
});
if (store.mode === 'demo') store.auth.signIn('demo');
store.subscribe(s => { state = s || {}; render(); });
addEventListener('resize', () => moveThumb($('#courtTabs')));
