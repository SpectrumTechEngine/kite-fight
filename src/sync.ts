import { A, Fight, type FEvent, type Phase, type PickupType } from './physics';

// Online snapshots: the host packs the match into a small object ~15 times a second;
// the guest unpacks it into its own copy of the match and moves the kites smoothly in between.

const PHASES: Phase[] = ['count', 'fight', 'cut', 'over'];
const PU: PickupType[] = ['glass', 'boost', 'mend', 'shield'];
const r1 = (n: number) => Math.round(n * 10) / 10;

export interface Snap {
  id: number; ph: number; pt: number; rt: number; rd: number; sc: [number, number]; w: number; n: number; wn: number;
  k: number[][]; pu: number[][]; e: [number, FEvent][]; lk: [number, number]; nm: [string, string]; g: number[];
}

export function pack(f: Fight, id: number, events: [number, FEvent][], lk: [number, number], nm: [string, string]): Snap {
  return {
    id, ph: PHASES.indexOf(f.phase), pt: r1(f.phaseT), rt: r1(f.roundT), rd: f.round, sc: f.score, w: Math.round(f.wind * 100) / 100, n: f.notches, wn: f.winner,
    k: f.kites.map((k) => [Math.round(k.x), Math.round(k.y), Math.round(k.vx), Math.round(k.vy), Math.round(k.heading * 100) / 100, k.pulling ? 1 : 0, k.health,
      r1(k.sharpT), r1(k.boostT), r1(k.invT), k.cut ? 1 : 0, k.cutAt ? Math.round(k.cutAt.x) : 0, k.cutAt ? Math.round(k.cutAt.y) : 0, r1(k.downT), k.shield ? 1 : 0, Math.ceil(k.safeT)]),
    pu: f.pickups.map((p) => [Math.round(p.x), Math.round(p.y), PU.indexOf(p.type), r1(p.t)]),
    e: events, lk, nm, g: [r1(f.gustWarn), Math.round(f.gustOn * 100) / 100, f.gustDir],
  };
}

/** Firebase drops empty lists, so a snapshot can arrive with no pickups or events at all. */
export function tidy(s: Snap) {
  s.e = Array.isArray(s.e) ? s.e : []; s.pu = Array.isArray(s.pu) ? s.pu : []; s.g = Array.isArray(s.g) ? s.g : [0, 0, 1];
  return s;
}

/** Copy a snapshot into the guest's match. Kites are nudged towards the host's position so they don't jump. */
export function apply(f: Fight, s: Snap) {
  const ph = PHASES[s.ph] ?? 'fight';
  const newRound = ph === 'count' && (f.phase !== 'count' || s.rd !== f.round);
  f.phase = ph; f.phaseT = s.pt; f.roundT = s.rt; f.round = s.rd; f.score = [s.sc[0], s.sc[1]];
  f.wind = s.w; f.winner = s.wn as -1 | 0 | 1;
  f.gustWarn = Number(s.g[0]) || 0; f.gustOn = Number(s.g[1]) || 0; f.gustDir = s.g[2] === -1 ? -1 : 1;
  f.kites.forEach((k, i) => {
    const d = s.k[i]; if (!d) return;
    const [x, y, vx, vy, hd, pl, hp, sh, bo, inv, cut, cx, cy, dn, sd, sf] = d;
    const far = Math.hypot(x - k.x, y - k.y) > 80 || newRound || (cut === 1) !== k.cut;
    if (far) { k.x = x; k.y = y; } else { k.x += (x - k.x) * 0.5; k.y += (y - k.y) * 0.5; }
    k.vx = vx; k.vy = vy; k.heading = hd; k.pulling = pl === 1; k.health = hp;
    k.sharpT = sh; k.boostT = bo; k.invT = inv; k.cut = cut === 1; k.cutAt = k.cut ? { x: cx, y: cy } : null;
    k.downT = Number(dn) || 0; k.shield = sd === 1; k.safeT = Number(sf) || 0;
    if (newRound) k.place(x, y, hd);
  });
  f.pickups = s.pu.map(([x, y, t, pt]) => ({ x, y, type: PU[t] ?? 'glass', t: pt }));
}

/** Guest: keep things moving between snapshots (no rules, just motion). */
export function coast(f: Fight, hold: [boolean, boolean]) {
  const dt = A.step;
  f.t += dt; f.phaseT += dt;
  if (f.phase === 'fight') f.roundT += dt;
  for (const p of f.pickups) p.t += dt;
  if (f.gustOn > 0) f.gustOn = Math.max(0, f.gustOn - dt);
  const g = f.gustForce();
  f.kites.forEach((k, i) => {
    if (f.phase === 'count') { k.stepTail(dt, f.wind, f.t); return; }
    k.step(dt, f.phase === 'fight' && hold[i], f.wind, f.t, g);
    if (k.y < 14 && !k.cut) { k.y = 14; k.vy = Math.abs(k.vy); }
  });
}
