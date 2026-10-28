import { A, Fight, type FEvent, type Phase, type PickupType } from './physics';

// Online snapshots: the host packs the match into a small object ~15 times a second;
// the guest unpacks it into its own copy of the match and moves the kites smoothly in between.

const PHASES: Phase[] = ['count', 'fight', 'cut', 'over'];
const PU: PickupType[] = ['glass', 'boost', 'mend'];
const r1 = (n: number) => Math.round(n * 10) / 10;

export interface Snap {
  id: number; ph: number; pt: number; rt: number; rd: number; sc: [number, number]; w: number; n: number; wn: number;
  k: number[][]; pu: number[][]; e: [number, FEvent][]; lk: [number, number]; nm: [string, string];
}

export function pack(f: Fight, id: number, events: [number, FEvent][], lk: [number, number], nm: [string, string]): Snap {
  return {
    id, ph: PHASES.indexOf(f.phase), pt: r1(f.phaseT), rt: r1(f.roundT), rd: f.round, sc: f.score, w: Math.round(f.wind * 100) / 100, n: f.notches, wn: f.winner,
    k: f.kites.map((k) => [Math.round(k.x), Math.round(k.y), Math.round(k.vx), Math.round(k.vy), Math.round(k.heading * 100) / 100, k.pulling ? 1 : 0, k.health,
      r1(k.sharpT), r1(k.boostT), r1(k.invT), k.cut ? 1 : 0, k.cutAt ? Math.round(k.cutAt.x) : 0, k.cutAt ? Math.round(k.cutAt.y) : 0]),
    pu: f.pickups.map((p) => [Math.round(p.x), Math.round(p.y), PU.indexOf(p.type), r1(p.t)]),
    e: events, lk, nm,
  };
}

/** Copy a snapshot into the guest's match. Kites are nudged towards the host's position so they don't jump. */
export function apply(f: Fight, s: Snap) {
  const ph = PHASES[s.ph] ?? 'fight';
  const newRound = ph === 'count' && (f.phase !== 'count' || s.rd !== f.round);
  f.phase = ph; f.phaseT = s.pt; f.roundT = s.rt; f.round = s.rd; f.score = [s.sc[0], s.sc[1]];
  f.wind = s.w; f.winner = s.wn as -1 | 0 | 1;
  f.kites.forEach((k, i) => {
    const d = s.k[i]; if (!d) return;
    const [x, y, vx, vy, hd, pl, hp, sh, bo, inv, cut, cx, cy] = d;
    const far = Math.hypot(x - k.x, y - k.y) > 80 || newRound || (cut === 1) !== k.cut;
    if (far) { k.x = x; k.y = y; } else { k.x += (x - k.x) * 0.5; k.y += (y - k.y) * 0.5; }
    k.vx = vx; k.vy = vy; k.heading = hd; k.pulling = pl === 1; k.health = hp;
    k.sharpT = sh; k.boostT = bo; k.invT = inv; k.cut = cut === 1; k.cutAt = k.cut ? { x: cx, y: cy } : null;
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
  f.kites.forEach((k, i) => {
    if (f.phase === 'count') { k.stepTail(dt, f.wind, f.t); return; }
    k.step(dt, f.phase === 'fight' && hold[i], f.wind, f.t);
    if (k.y < 14 && !k.cut) { k.y = 14; k.vy = Math.abs(k.vy); }
  });
}
