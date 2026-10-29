// Progress and settings in localStorage. Every call is wrapped so private mode or blocked storage never breaks the game.

import type { KiteLook } from './opponents';

const KEY = 'kitefight_v1';

/** A beaten rival's kite, kept for show (it can't be flown). n = how many times you've won it. */
export interface Trophy { key: string; name: string; look: KiteLook; n: number }

export interface Save {
  beaten: Record<string, boolean>;   // opponent id -> beaten at least once
  trophies: Trophy[];
  settings: { sound: boolean; musicOn: boolean; kite: number; kite2: number; cuts: number; name: string };
}

const fresh = (): Save => ({ beaten: {}, trophies: [], settings: { sound: true, musicOn: true, kite: 0, kite2: 3, cuts: 3, name: '' } });

export function load(): Save {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return fresh();
    const d = JSON.parse(raw) as Partial<Save>;
    const f = fresh();
    return { beaten: { ...(d.beaten ?? {}) }, trophies: Array.isArray(d.trophies) ? d.trophies : [], settings: { ...f.settings, ...(d.settings ?? {}) } };
  } catch {
    return fresh();
  }
}

export function save(s: Save) {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* storage unavailable: progress lasts this visit only */ }
}

/** Keep the loser's kite. Returns the trophy. */
export function addTrophy(s: Save, key: string, name: string, look: KiteLook): Trophy {
  let t = s.trophies.find((x) => x.key === key);
  if (t) t.n++;
  else { t = { key, name, look: { a: look.a, b: look.b, tail: [...look.tail], shape: look.shape, deco: look.deco }, n: 1 }; s.trophies.push(t); }
  if (s.trophies.length > 60) s.trophies.splice(0, s.trophies.length - 60);
  save(s);
  return t;
}

export function resetProgress(s: Save): Save {
  const n = { ...fresh(), settings: s.settings };
  save(n);
  return n;
}

