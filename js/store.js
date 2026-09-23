// Data layer. Talks to Firebase Realtime Database, or — with ?demo in
// the URL — to localStorage so the site can be tried without Firebase.
//
// Shape under DB_ROOT:
//   matches/{fixtureId}: { status: 'live'|'done', games: ['abba…', …],
//                          serve: 'a'|'b', startedAt, endedAt, winner }
//   ko/{fixtureId}:      { a?: pairId, b?: pairId }   (manual overrides)

import { firebaseConfig } from './firebase-config.js';
import { DB_ROOT } from './config.js';

const FB = 'https://www.gstatic.com/firebasejs/10.12.2';
const params = new URLSearchParams(location.search);
const DEMO = params.has('demo') || !firebaseConfig.apiKey;

function createDemoStore() {
  const KEY = 'pt2-demo-state';
  const listeners = new Set();
  const authListeners = new Set();
  let user = null;
  const read = () => { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; } };
  const write = s => {
    try { localStorage.setItem(KEY, JSON.stringify(s)); } catch {}
    listeners.forEach(cb => cb(s));
  };
  addEventListener('storage', e => { if (e.key === KEY) listeners.forEach(cb => cb(read())); });

  return {
    mode: 'demo',
    subscribe(cb) { listeners.add(cb); cb(read()); return () => listeners.delete(cb); },
    onConnection(cb) { cb(true); },
    async transactMatch(id, fn) {
      const s = read();
      s.matches ||= {};
      const next = fn(s.matches[id] ?? null);
      if (next === undefined) return false;
      if (next === null) delete s.matches[id]; else s.matches[id] = next;
      write(s);
      return true;
    },
    async setKo(id, side, pairId) {
      const s = read();
      s.ko ||= {}; s.ko[id] ||= {};
      if (pairId) s.ko[id][side] = pairId; else delete s.ko[id][side];
      write(s);
    },
    async resetAll() { write({}); },
    auth: {
      onChange(cb) { authListeners.add(cb); cb(user); },
      async signIn(email) { user = { email: email || 'demo@local' }; authListeners.forEach(cb => cb(user)); },
      async signOut() { user = null; authListeners.forEach(cb => cb(user)); },
    },
  };
}

async function createFirebaseStore() {
  const [{ initializeApp }, db, au] = await Promise.all([
    import(`${FB}/firebase-app.js`),
    import(`${FB}/firebase-database.js`),
    import(`${FB}/firebase-auth.js`),
  ]);
  const app = initializeApp(firebaseConfig);
  const database = db.getDatabase(app);
  const auth = au.getAuth(app);
  const root = db.ref(database, DB_ROOT);

  return {
    mode: 'live',
    subscribe(cb) { return db.onValue(root, snap => cb(snap.val() || {})); },
    onConnection(cb) { db.onValue(db.ref(database, '.info/connected'), s => cb(!!s.val())); },
    async transactMatch(id, fn) {
      const res = await db.runTransaction(db.ref(database, `${DB_ROOT}/matches/${id}`), cur => fn(cur));
      return res.committed;
    },
    async setKo(id, side, pairId) {
      await db.set(db.ref(database, `${DB_ROOT}/ko/${id}/${side}`), pairId || null);
    },
    async resetAll() { await db.set(root, null); },
    auth: {
      onChange(cb) { au.onAuthStateChanged(auth, cb); },
      async signIn(email, password) { await au.signInWithEmailAndPassword(auth, email, password); },
      async signOut() { await au.signOut(auth); },
    },
  };
}

export const store = DEMO ? createDemoStore() : await createFirebaseStore().catch(err => {
  console.error('Firebase failed to load, falling back to demo mode', err);
  return createDemoStore();
});
