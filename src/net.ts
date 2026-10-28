// Online duels, the same way Archer Duel and Clay Duel do them:
// "rooms" in Chop the Check's Firebase Realtime Database, under rooms/kite-fight-<name>.
// Each player has an entry in the room's peers list holding their "presence" (a small object
// they keep updating); it removes itself when they leave or lose signal.
// The challenger's phone (host) runs the real game and publishes snapshots; the other phone
// (guest) sends its hold/let-go and draws the snapshots.

const FIREBASE_CONFIG = {
  apiKey: 'AIzaSyCFKyTr_-0QC7Vl-HjUpfMibi5Eu4IgKz0',
  authDomain: 'chopthecheck.firebaseapp.com',
  databaseURL: 'https://chopthecheck-default-rtdb.europe-west1.firebasedatabase.app',
  projectId: 'chopthecheck',
  appId: '1:506847790153:web:109788afc2ad8afc31eb98',
};
const RECAPTCHA_SITE_KEY = '6LeJiNAtAAAAAHozjgInBddSFOPOPBOMRsPwQ6qH'; // App Check, same key as Chop the Check
const FB = 'https://www.gstatic.com/firebasejs/12.19.0/';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;
export interface Peer { peer: string; isMe: boolean; presence: Any; since: number }
export interface Room {
  me: string;
  peers(): Peer[];
  presence(o: Record<string, unknown>): Promise<void>;
  onPeers(ok: (peers: Peer[]) => void, err?: () => void): () => void;
  leave(): Promise<void>;
}

let clock = 0;                                           // Firebase clock minus this phone's clock
export const netNow = () => Date.now() + clock;
const load = (f: string) => import(/* @vite-ignore */ FB + f) as Promise<Any>;

let core: Promise<{ dbM: Any; db: Any }> | null = null;
function base() {
  if (!core) core = (async () => {
    const [appM, dbM] = await Promise.all([load('firebase-app.js'), load('firebase-database.js')]);
    const app = appM.initializeApp(FIREBASE_CONFIG, 'kite-fight');
    if (/thespectrumtechengine\.com$/.test(location.hostname)) {
      try { const ac = await load('firebase-app-check.js'); ac.initializeAppCheck(app, { provider: new ac.ReCaptchaEnterpriseProvider(RECAPTCHA_SITE_KEY), isTokenAutoRefreshEnabled: true }); } catch { /* App Check is optional */ }
    }
    const db = dbM.getDatabase(app);
    dbM.onValue(dbM.ref(db, '.info/serverTimeOffset'), (s: Any) => { clock = Number(s.val()) || 0; });
    return { dbM, db };
  })().catch((e) => { core = null; throw e; });
  return core;
}

/** Firebase refuses undefined values. */
const clean = (o: unknown) => JSON.parse(JSON.stringify(o));

export async function joinRoom(name: string): Promise<Room> {
  const { dbM, db } = await base();
  const me = Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
  const peersRef = dbM.ref(db, 'rooms/kite-fight-' + name + '/peers'), mine = dbM.child(peersRef, me);
  let list: Peer[] = [], myP: Record<string, unknown> = {}, subs: { ok: (p: Peer[]) => void; err?: () => void }[] = [];
  const off = dbM.onValue(peersRef, (snap: Any) => {
    list = Object.entries((snap.val() || {}) as Record<string, Any>).map(([id, d]) => ({ peer: id, isMe: id === me, presence: (d && d.p) || {}, since: Number(d && d.t) || 0 }));
    subs.forEach((s) => s.ok(withMe()));
  }, () => subs.forEach((s) => s.err && s.err()));
  await dbM.onDisconnect(mine).remove();
  await dbM.set(mine, { p: {}, t: dbM.serverTimestamp() });
  const withMe = () => (list.some((q) => q.isMe) ? list : [...list, { peer: me, isMe: true, presence: myP, since: 0 }]);
  return {
    me,
    peers: withMe,
    presence: (o) => { myP = { ...myP, ...o }; return dbM.update(mine, { p: clean(myP) }); },
    onPeers: (ok, err) => { const s = { ok, err }; subs.push(s); ok(withMe()); return () => { subs = subs.filter((x) => x !== s); }; },
    leave: async () => { off(); subs = []; try { await dbM.onDisconnect(mine).cancel(); } catch { /* already gone */ } await dbM.remove(mine); },
  };
}
