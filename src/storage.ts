// Progress and settings in localStorage. Every call is wrapped so private mode or blocked storage never breaks the game.

const KEY = 'kitefight_v1';

export interface Save {
  beaten: Record<string, boolean>;   // opponent id -> beaten at least once
  settings: { sound: boolean; musicOn: boolean; kite: number; kite2: number; cuts: number; name: string };
}

const fresh = (): Save => ({ beaten: {}, settings: { sound: true, musicOn: true, kite: 0, kite2: 3, cuts: 3, name: '' } });

export function load(): Save {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return fresh();
    const d = JSON.parse(raw) as Partial<Save>;
    const f = fresh();
    return { beaten: { ...(d.beaten ?? {}) }, settings: { ...f.settings, ...(d.settings ?? {}) } };
  } catch {
    return fresh();
  }
}

export function save(s: Save) {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* storage unavailable: progress lasts this visit only */ }
}

export function resetProgress(s: Save): Save {
  const n = { ...fresh(), settings: s.settings };
  save(n);
  return n;
}

