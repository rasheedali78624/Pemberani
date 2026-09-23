// Pure tournament logic: scoring rules, standings, knockout resolution.

import { RULES, GROUPS, FIXTURES, FIXTURE_BY_ID, PAIR_BY_ID, QUALIFIERS_PER_GROUP, TOURNAMENT } from './config.js';

export const rulesFor = fx => (fx.stage === 'group' ? RULES.group : RULES.knockout);
const other = s => (s === 'a' ? 'b' : 'a');

export function gameWinner(a, b, r) {
  if (!r.deuce) return a >= r.target ? 'a' : b >= r.target ? 'b' : null;
  if (a >= r.cap) return 'a';
  if (b >= r.cap) return 'b';
  if ((a >= r.target || b >= r.target) && Math.abs(a - b) >= 2) return a > b ? 'a' : 'b';
  return null;
}

// Expand a stored match record into everything the UI needs.
export function evalMatch(rec, r) {
  const seqs = rec?.games?.length ? rec.games : [''];
  const need = Math.ceil(r.bestOf / 2);
  const won = { a: 0, b: 0 };
  let firstServer = rec?.serve || 'a';
  const games = seqs.map(seq => {
    seq = seq || '';
    let a = 0, b = 0;
    for (const c of seq) c === 'a' ? a++ : b++;
    const winner = gameWinner(a, b, r);
    if (winner) won[winner]++;
    const g = { a, b, seq, winner, firstServer };
    if (winner) firstServer = winner;
    return g;
  });
  const cur = games[games.length - 1];
  const server = cur.seq ? cur.seq[cur.seq.length - 1] : cur.firstServer;
  const winner = won.a >= need ? 'a' : won.b >= need ? 'b' : null;

  // Game point / match point flags for the side that could close it next rally.
  const flag = side => {
    if (winner || cur.winner) return null;
    const next = { a: cur.a, b: cur.b }; next[side]++;
    if (gameWinner(next.a, next.b, r) !== side) return null;
    return won[side] + 1 >= need ? 'Match point' : 'Game point';
  };
  const last = cur.seq[cur.seq.length - 1];
  const half = Math.ceil(r.target / 2);
  return {
    games, won, need, winner, cur,
    gameNo: games.length,
    server,
    serveCourt: cur[server] % 2 === 0 ? 'right' : 'left',
    point: { a: flag('a'), b: flag('b') },
    // True right after the leader first reaches 11 — the mid-game interval.
    interval: !winner && !!last && cur[last] === half && cur[other(last)] < half,
    totals: games.reduce((t, g) => ({ a: t.a + g.a, b: t.b + g.b }), { a: 0, b: 0 }),
  };
}

export function addPoint(rec, side, r) {
  if (!rec || rec.status !== 'live') return undefined;
  const games = [...(rec.games?.length ? rec.games : [''])].map(s => s || '');
  games[games.length - 1] += side;
  const ev = evalMatch({ ...rec, games }, r);
  const next = { ...rec, games };
  if (ev.winner) {
    Object.assign(next, { status: 'done', winner: ev.winner, endedAt: Date.now() });
  } else if (ev.cur.winner) {
    games.push('');
  }
  return next;
}

export function undoPoint(rec) {
  if (!rec?.games) return undefined;
  const games = rec.games.map(s => s || '');
  if (games.length > 1 && games[games.length - 1] === '') games.pop();
  const last = games.length - 1;
  if (!games[last]) return undefined;
  games[last] = games[last].slice(0, -1);
  return { ...rec, games, status: 'live', winner: null, endedAt: null };
}

// ── Knockout slot resolution ──────────────────────────────────

export function groupComplete(state, groupId) {
  return FIXTURES.filter(f => f.group === groupId).every(f => state.matches?.[f.id]?.status === 'done');
}

// Returns fixtures with a/b filled in where known, plus a readable
// placeholder for slots still waiting on results.
export function resolveFixtures(state) {
  const standings = Object.fromEntries(GROUPS.map(g => [g.id, computeStandings(state, g.id)]));
  const resolved = {};
  const slotText = s => s.group ? `${GROUPS.find(g => g.id === s.group).name} #${s.rank}`
    : s.winnerOf ? `Winner ${s.winnerOf}` : `Loser ${s.loserOf}`;

  const resolveSlot = slot => {
    if (slot.group) {
      if (!groupComplete(state, slot.group)) return null;
      return standings[slot.group][slot.rank - 1]?.id ?? null;
    }
    const ref = resolved[slot.winnerOf || slot.loserOf];
    const rec = state.matches?.[ref?.id];
    if (!ref || rec?.status !== 'done' || !ref.a || !ref.b) return null;
    const w = ref[rec.winner];
    return slot.winnerOf ? w : ref[other(rec.winner)];
  };

  for (const f of FIXTURES) {
    if (f.stage === 'group') { resolved[f.id] = f; continue; }
    // Once a knockout match starts, the pairs are saved on the match itself.
    const rec = state.matches?.[f.id];
    const ov = state.ko?.[f.id] || {};
    resolved[f.id] = {
      ...f,
      a: rec?.a || ov.a || resolveSlot(f.slotA),
      b: rec?.b || ov.b || resolveSlot(f.slotB),
      placeholderA: slotText(f.slotA),
      placeholderB: slotText(f.slotB),
    };
  }
  return resolved;
}

// ── Standings ────────────────────────────────────────────────

export function computeStandings(state, groupId) {
  const g = GROUPS.find(x => x.id === groupId);
  const rows = Object.fromEntries(g.pairs.map((p, i) => [p.id, {
    id: p.id, name: p.name, seed: i + 1, scheduled: 0, p: 0, w: 0, l: 0, pf: 0, pa: 0, form: [],
  }]));
  const h2h = {};
  for (const f of FIXTURES.filter(f => f.group === groupId)) {
    rows[f.a].scheduled++; rows[f.b].scheduled++;
    const rec = state.matches?.[f.id];
    if (rec?.status !== 'done') continue;
    const ev = evalMatch(rec, rulesFor(f));
    const A = rows[f.a], B = rows[f.b];
    A.p++; B.p++;
    A.pf += ev.totals.a; A.pa += ev.totals.b;
    B.pf += ev.totals.b; B.pa += ev.totals.a;
    const [W, L] = rec.winner === 'a' ? [A, B] : [B, A];
    W.w++; L.l++;
    W.form.push({ r: 'W', at: rec.endedAt || 0 }); L.form.push({ r: 'L', at: rec.endedAt || 0 });
    h2h[`${W.id}>${L.id}`] = true;
  }
  const list = Object.values(rows).map(r => ({
    ...r, diff: r.pf - r.pa, pts: r.w * 2,
    form: r.form.sort((x, y) => x.at - y.at).map(f => f.r),
  }));
  // Wins → point difference → points scored → head-to-head → poster order.
  list.sort((x, y) =>
    y.w - x.w || y.diff - x.diff || y.pf - x.pf ||
    (h2h[`${x.id}>${y.id}`] ? -1 : h2h[`${y.id}>${x.id}`] ? 1 : 0) ||
    x.seed - y.seed);
  list.forEach((r, i) => { r.rank = i + 1; r.q = i < QUALIFIERS_PER_GROUP; });
  return list;
}

// ── Helpers for the UI ───────────────────────────────────────

export const pairName = id => PAIR_BY_ID[id]?.name ?? null;

export function statusOf(state, id) {
  return state.matches?.[id]?.status || 'scheduled';
}

// Matches for a court in order of play (with KO slots resolved).
export function courtQueue(state, court) {
  const res = resolveFixtures(state);
  return FIXTURES.filter(f => f.court === court)
    .sort((x, y) => x.order - y.order)
    .map(f => res[f.id]);
}

export function courtNow(state, court) {
  const q = courtQueue(state, court);
  const live = q.find(f => statusOf(state, f.id) === 'live');
  const upcoming = q.filter(f => statusOf(state, f.id) === 'scheduled');
  return { live, next: upcoming[0], after: upcoming[1], queue: q };
}

export function minutesFor(fx) {
  return fx.stage === 'group' ? TOURNAMENT.minutesPerGroupMatch : TOURNAMENT.minutesPerKnockoutMatch;
}

export { FIXTURE_BY_ID };
