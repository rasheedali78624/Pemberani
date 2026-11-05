// ─────────────────────────────────────────────────────────────
//  Pemberani Tournament · Edition 2.0 — tournament data
//  Everything the committee might want to change lives here.
// ─────────────────────────────────────────────────────────────

export const TOURNAMENT = {
  // ISO date-time of the first serve, e.g. '2026-10-04T08:00:00+08:00'.
  // Leave empty to hide the countdown.
  startsAt: '',
  // Rough minutes per match, used for "approx. start" estimates.
  minutesPerGroupMatch: 12,
  minutesPerKnockoutMatch: 25,
};

// Firebase path everything for this edition is stored under.
export const DB_ROOT = 'pt2';

export const RULES = {
  // Group stage: one game to 21, no deuce (first to 21 wins).
  group: { bestOf: 1, target: 21, deuce: false, cap: 21 },
  // Knockout: best of three games to 21, deuce up to 30.
  knockout: { bestOf: 3, target: 21, deuce: true, cap: 30 },
};

export const GROUPS = [
  {
    id: 'G1', name: 'Group A', court: 1,
    pairs: [
      { id: 'g1p1', name: 'Abdel & Azlan' },
      { id: 'g1p2', name: 'Ical & Syafiq' },
      { id: 'g1p3', name: 'Sol & Aizat' },
      { id: 'g1p4', name: 'Nizam & Poknik' },
      { id: 'g1p5', name: 'Paul & Jai' },
      { id: 'g1p6', name: 'Zam & Fahmi' },
    ],
  },
  {
    id: 'G2', name: 'Group B', court: 2,
    pairs: [
      { id: 'g2p1', name: 'Azzam & Saiful' },
      { id: 'g2p2', name: 'Pok & Daus' },
      { id: 'g2p3', name: 'Herman & Nataman' },
      { id: 'g2p4', name: 'Rasheed & Haziq' },
      { id: 'g2p5', name: 'Fareez & Awie' },
      { id: 'g2p6', name: 'Charlie & Fizan' },
    ],
  },
];

// Full round robin: 15 matches per group, every pair plays the other
// five once. Each group stays on its own court. Numbers are the pair
// numbers from the group poster (1–6), in the captain's order of play;
// nobody plays two matches back to back.
const GROUP_ORDER = [
  [1, 2], [3, 6], [4, 5],
  [1, 3], [2, 4], [5, 6],
  [1, 4], [3, 5], [2, 6],
  [1, 5], [4, 6], [2, 3],
  [1, 6], [2, 5], [3, 4],
];

// Top 4 of each group go through to the quarter-finals.
export const QUALIFIERS_PER_GROUP = 4;

export const KNOCKOUT = [
  { id: 'QF1', label: 'Quarter-final 1', round: 'QF', court: 1, a: { group: 'G1', rank: 1 }, b: { group: 'G2', rank: 4 } },
  { id: 'QF2', label: 'Quarter-final 2', round: 'QF', court: 1, a: { group: 'G2', rank: 2 }, b: { group: 'G1', rank: 3 } },
  { id: 'QF3', label: 'Quarter-final 3', round: 'QF', court: 2, a: { group: 'G2', rank: 1 }, b: { group: 'G1', rank: 4 } },
  { id: 'QF4', label: 'Quarter-final 4', round: 'QF', court: 2, a: { group: 'G1', rank: 2 }, b: { group: 'G2', rank: 3 } },
  { id: 'SF1', label: 'Semi-final 1', round: 'SF', court: 1, a: { winnerOf: 'QF1' }, b: { winnerOf: 'QF2' } },
  { id: 'SF2', label: 'Semi-final 2', round: 'SF', court: 2, a: { winnerOf: 'QF3' }, b: { winnerOf: 'QF4' } },
  { id: 'BRONZE', label: 'Third place', round: '3RD', court: 2, a: { loserOf: 'SF1' }, b: { loserOf: 'SF2' } },
  { id: 'FINAL', label: 'Final', round: 'F', court: 1, a: { winnerOf: 'SF1' }, b: { winnerOf: 'SF2' } },
];

// ── Derived lists (no need to edit below) ─────────────────────

export const PAIRS = GROUPS.flatMap(g => g.pairs.map((p, i) => ({ ...p, group: g.id, seed: i + 1 })));
export const PAIR_BY_ID = Object.fromEntries(PAIRS.map(p => [p.id, p]));

export const FIXTURES = [
  ...GROUPS.flatMap(g => GROUP_ORDER.map(([x, y], i) => ({
    id: `${g.id}-M${i + 1}`,
    stage: 'group',
    group: g.id,
    label: `${g.name} · Match ${i + 1}`,
    short: `M${i + 1}`,
    court: g.court,
    order: i + 1,
    a: g.pairs[x - 1].id,
    b: g.pairs[y - 1].id,
  }))),
  ...KNOCKOUT.map((k, i) => ({
    ...k,
    stage: 'knockout',
    short: k.id === 'BRONZE' ? '3RD' : k.id,
    order: 100 + i,
    slotA: k.a,
    slotB: k.b,
    a: null,
    b: null,
  })),
];
export const FIXTURE_BY_ID = Object.fromEntries(FIXTURES.map(f => [f.id, f]));
