// EN / BM language switch.
// Static text: any element with data-i18n="key". The English is whatever is in
// the HTML; BM below replaces it. Dynamic text (scores, labels): t('key').

const KEY = 'pt3-lang';
const read = () => { try { return localStorage.getItem(KEY); } catch { return null; } };
export let lang = read() || (/^ms/i.test(navigator.language || '') ? 'bm' : 'en');

// ── Static page text (BM) ────────────────────────────────────
const BM = {
  'nav.home': 'Utama', 'nav.event': 'Kejohanan', 'nav.players': 'Pemain', 'nav.mc': 'Pusat Perlawanan',
  'nav.standings': 'Kedudukan', 'nav.bracket': 'Carta', 'nav.prizes': 'Hadiah',
  'nav.courts': 'Gelanggang', 'nav.fixtures': 'Jadual', 'nav.pairs': 'Pasangan', 'nav.campaign': 'Laman Utama',
  'meta.line': 'Sab 05.12.2026 · Andalas Sports Complex',

  'hero.presents': 'Kelab Badminton Pemberani<br><b>mempersembahkan</b>',
  'hero.l1': 'Kejohanan', 'hero.l2': 'Pemberani', 'hero.l3': 'Edisi <span class="y">03</span>',
  'hero.tag': 'Lebih sengit. Lebih besar.<br><span class="y">Lebih kompetitif</span> dari sebelumnya.',
  'hero.tag2': 'Fiercer · Grander · More competitive',
  'cta.enter': 'Ikuti kejohanan', 'cta.explore': 'Terokai kejohanan', 'cta.full': 'Pusat perlawanan penuh',
  'cta.standings': 'Lihat kedudukan',
  'q.live': 'Skor langsung', 'q.table': 'Kedudukan',
  'tb.live': 'Langsung', 'tb.fx': 'Jadual', 'tb.table': 'Kedudukan', 'tb.bracket': 'Carta', 'tb.players': 'Pemain',
  'tb.courts': 'Gelanggang', 'tb.pairs': 'Pasangan',
  'k.date': 'Tarikh', 'k.time': 'Masa', 'k.venue': 'Lokasi', 'k.countdown': 'Kiraan detik', 'v.date': 'Sab 05.12.26',

  'st.k1': 'Kenyataan', 'st.1a': 'Ini bukan', 'st.1b': 'sekadar <span class="y">permainan.</span>',
  'st.k2': 'Keberanian', 'st.2a': 'Ini tentang', 'st.2b': 'keberanian', 'st.2c': 'untuk bersaing.',
  'st.k3': 'Kebanggaan', 'st.3a': 'Ini tentang', 'st.3b': 'kebanggaan', 'st.3c': 'kemenangan.',
  'st.4a': 'Inilah',

  'ch.k': 'Kejohanan', 'ch.h1': 'Pemberani', 'ch.h2': '<span class="y">terbesar</span> setakat ini.',
  'ch.lede': 'Satu hari. Dua gelanggang. Dua puluh empat pemain memburu satu mahkota. Setiap perlawanan penting dari servis pertama.',
  'n.players': 'Pemain', 'n.players2': 'Beregu', 'n.pairs': 'Pasangan', 'n.pairs2': 'Enam setiap kumpulan',
  'n.groups': 'Kumpulan', 'n.groups2': 'A dan B · liga', 'n.courts': 'Gelanggang', 'n.courts2': 'C4 dan C5',
  'n.matches': 'Perlawanan', 'n.matches2': '30 kumpulan · 8 kalah mati', 'n.edition': 'Edisi', 'n.edition2': 'Bab ketiga',
  'ch.prov': 'Pasangan dan kumpulan belum muktamad sehingga cabutan disahkan.',

  'def.stamp': 'Juara Edisi 2.0', 'def.k': 'Juara Bertahan',
  'def.lede': 'Juara Edisi 2.0. Mereka datang sebagai satu daripada dua belas pasangan dan pulang membawa mahkota. Kini setiap pasangan mahu merampasnya.',
  'def.next': 'Nama anda pula?',

  'b.g': 'Peringkat kumpulan', 'b.qf': 'Suku akhir', 'b.sf': 'Separuh akhir', 'b.f': 'Akhir', 'b.c': 'Juara',
  'fm.k': 'Format', 'fm.h1': 'Jalan ke', 'fm.h2': '<span class="y">puncak.</span>',
  'fm.s1': 'Dua kumpulan, enam pasangan setiap satu. Semua bertemu semua dalam kumpulan.',
  'fm.s2': 'Empat teratas setiap kumpulan bersilang: A1 lwn B4, B2 lwn A3, B1 lwn A4, A2 lwn B3.',
  'fm.s3': 'Tinggal empat pasangan. Yang kalah berebut tempat ketiga.',
  'fm.s4': 'Satu perlawanan untuk mahkota, serta perlawanan tempat ketiga.',
  'fm.s5': 'Wang tunai, trofi, dan nama anda di sebelah 1.0 dan 2.0.',
  'fm.r21': '1 set · 21 mata', 'fm.r15': 'Terbaik 3 set · 15 mata',
  'fm.c4': 'Gelanggang C4', 'fm.c5': 'Gelanggang C5', 'g.a': 'Kumpulan A', 'g.b': 'Kumpulan B',
  'fm.gp': 'Enam pasangan, lima belas perlawanan, satu gelanggang. Empat teratas mara.',

  'lu.k': 'Barisan Pemain', 'lu.h1': '24 pemain.', 'lu.h2': 'Satu mahkota.',
  'lu.lede': 'Dua pot untuk cabutan pasangan. Pot A ialah semua pemain yang pernah naik podium; Pot B ialah mereka yang memburu gelaran pertama.',
  'pot.a': 'Pilihan · pernah ke podium', 'pot.b': 'Pencabar', 'lu.ph': 'Pasangan',
  'lu.pp': 'Nama pasangan dipaparkan sebaik cabutan selesai. Tekan pasangan untuk melihat perlawanan dan keputusan mereka.',
  'lu.rk': 'Para pemain', 'lu.rh': 'Kesemua <span class="y">24</span>',

  'mc.h1': 'Di gelanggang', 'mc.h2': 'sekarang.', 'mc.fx': 'Jadual',
  'fx.all': 'Semua', 'fx.ko': 'Kalah mati', 'fx.res': 'Keputusan',

  'sd.k': 'Kedudukan Kumpulan', 'sd.h1': 'Rebut', 'sd.h2': 'tempat <span class="y">anda.</span>',
  'sd.lede': 'Disusun mengikut kemenangan, beza mata, jumlah mata, kemudian keputusan bersemuka. Dikemas kini selepas setiap perlawanan.',

  'bk.k': 'Kalah Mati', 'bk.h1': 'Lapan pasangan.', 'bk.h2': 'Tiada <span class="y">peluang kedua.</span>',
  'bk.swipe': 'Leret untuk ikuti carta →',

  'pz.k': 'Ganjaran', 'pz.h1': 'Berjuang untuk', 'pz.h2': 'sesuatu.',
  'pz.ru': 'Naib johan', 'pz.th': 'Tempat ketiga', 'pz.1': 'Tempat pertama', 'pz.2': 'Tempat kedua', 'pz.3': 'Tempat ketiga',
  'pz.cash': '<b>Wang tunai</b> · jumlah akan diumumkan',
  'pz.gh': 'Setiap penyertaan<br>dapat goody bag.',
  'pz.gp': 'Bernilai sehingga RM15 setiap penyertaan. Jumlah hadiah akan diumumkan kemudian.',

  'gl.k': 'Detik', 'gl.h1': 'Kisah', 'gl.h2': 'setakat ini.',
  'fn.1': 'Bermain dengan berani.', 'fn.2': 'Menang dengan bangga.',
  'ft.e2': 'Edisi 2.0', 'ft.score': 'Pencatat skor',

  'lv.h': 'Pemberani <span class="y">3.0</span><br>Langsung', 'lv.meta': '<span><b>Sab 05.12.2026</b></span><span>10 PG – 5 PTG</span><span>Andalas Sports Complex</span><span>Gelanggang C4 · C5</span>',
  'lv.oc': 'Di gelanggang', 'lv.now': 'Sekarang<span class="y">.</span>', 'lv.est': 'Masa adalah anggaran (kira-kira 12 minit setiap perlawanan kumpulan, 20 minit setiap perlawanan kalah mati) dan berubah mengikut rentak sebenar.',
  'lv.sk': 'Kedudukan kumpulan', 'lv.sh': '<span class="y">Kedudukan.</span>', 'lv.bh': '<span class="y">Carta.</span>', 'lv.ph': 'Barisan <span class="y">pemain.</span>',
};

// ── Dynamic text ─────────────────────────────────────────────
const DYN = {
  en: {
    live: 'Live', upnext: 'Up next', done: 'Done', ft: 'FT', court: 'Court', group: 'Group', match: 'Match',
    knockouts: 'Knockouts', game: 'Game', interval: 'Interval', 'Game point': 'Game point', 'Match point': 'Match point',
    lastOnCourt: 'Last match on this court', after: 'After that', allDone: 'All done', noMore: 'No more matches on this court.',
    noResults: 'No results yet.', pair: 'Pair', v: 'v', tbd: 'TBD', winner: 'Winner', loser: 'Loser',
    QF: 'Quarter-final', SF: 'Semi-final', FINAL: 'Final', BRONZE: 'Third place',
    QFs: 'Quarter-finals', SFs: 'Semi-finals', champsE3: 'Champions · Edition 3.0', tbdecided: 'To be decided',
    allMatches: n => `All ${n} matches`, fewer: 'Show fewer',
    hP: 'P', hW: 'W', hL: 'L', hPts: 'Pts', hPair: 'Pair', top4: 'Top 4 go through to the quarter-finals',
    playersTBA: 'Players announced after the draw', diff: 'Diff', rank: 'Rank', record: 'Record', groupMatches: 'Group matches',
    demoSim: 'Demo · simulated results', demo: 'Demo mode · nothing is saved', sync: 'Live sync', reconnect: 'Reconnecting…', connecting: 'Connecting…',
    days: 'Days', hrs: 'Hrs', min: 'Min', sec: 'Sec', countdown: 'Countdown', status: 'Status', finished: 'Finished',
    happening: 'Happening now', seeYou: 'See you at 4.0', liveNow: n => `${n} live`, openSlot: 'Open slot', close: 'Close',
    latest: 'Latest results', outTag: 'Out', qIn: 'sure of a quarter-final place', qOut: 'can no longer qualify', champ: 'Champion', ru: 'Runner-up', third: '3rd',
  },
  bm: {
    live: 'Langsung', upnext: 'Seterusnya', done: 'Selesai', ft: 'Tamat', court: 'Gelanggang', group: 'Kumpulan', match: 'Perlawanan',
    knockouts: 'Kalah mati', game: 'Set', interval: 'Rehat', 'Game point': 'Mata set', 'Match point': 'Mata perlawanan',
    lastOnCourt: 'Perlawanan terakhir di gelanggang ini', after: 'Selepas itu', allDone: 'Selesai', noMore: 'Tiada lagi perlawanan di gelanggang ini.',
    noResults: 'Belum ada keputusan.', pair: 'Pasangan', v: 'lwn', tbd: 'Belum ditentukan', winner: 'Pemenang', loser: 'Kalah',
    QF: 'Suku akhir', SF: 'Separuh akhir', FINAL: 'Akhir', BRONZE: 'Tempat ketiga',
    QFs: 'Suku akhir', SFs: 'Separuh akhir', champsE3: 'Juara · Edisi 3.0', tbdecided: 'Belum ditentukan',
    allMatches: n => `Kesemua ${n} perlawanan`, fewer: 'Tunjuk kurang',
    hP: 'P', hW: 'M', hL: 'K', hPts: 'Mata', hPair: 'Pasangan', top4: '4 teratas mara ke suku akhir',
    playersTBA: 'Pemain diumumkan selepas cabutan', diff: 'Beza', rank: 'Kedudukan', record: 'Rekod', groupMatches: 'Perlawanan kumpulan',
    demoSim: 'Demo · keputusan simulasi', demo: 'Mod demo · tiada yang disimpan', sync: 'Langsung', reconnect: 'Menyambung semula…', connecting: 'Menyambung…',
    days: 'Hari', hrs: 'Jam', min: 'Min', sec: 'Saat', countdown: 'Kiraan detik', status: 'Status', finished: 'Tamat',
    happening: 'Sedang berlangsung', seeYou: 'Jumpa di 4.0', liveNow: n => `${n} langsung`, openSlot: 'Slot kosong', close: 'Tutup',
    latest: 'Keputusan terkini', outTag: 'Terkeluar', qIn: 'pasti ke suku akhir', qOut: 'tidak lagi boleh layak', champ: 'Juara', ru: 'Naib johan', third: 'Ketiga',
  },
};

export function t(key, ...args) {
  const v = DYN[lang][key] ?? DYN.en[key] ?? key;
  return typeof v === 'function' ? v(...args) : v;
}
export const locale = () => (lang === 'bm' ? 'ms-MY' : 'en-MY');

export function applyStatic(root = document) {
  root.querySelectorAll('[data-i18n]').forEach(el => {
    if (el.dataset.en === undefined) el.dataset.en = el.innerHTML;
    const next = lang === 'bm' ? (BM[el.dataset.i18n] ?? el.dataset.en) : el.dataset.en;
    if (el.innerHTML !== next) el.innerHTML = next;
  });
  document.documentElement.lang = lang === 'bm' ? 'ms' : 'en';
  document.querySelectorAll('.lang button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.lang === lang)));
}

export function setLang(next) {
  if (next === lang) return;
  lang = next;
  try { localStorage.setItem(KEY, lang); } catch {}
  applyStatic();
  dispatchEvent(new CustomEvent('langchange'));
}

export function wireLang() {
  document.querySelectorAll('.lang button').forEach(b => b.addEventListener('click', () => setLang(b.dataset.lang)));
  applyStatic();
}
