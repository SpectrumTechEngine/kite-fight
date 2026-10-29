// Kite Fight physics. Arena is 960 x 540 units; y is height above the ground (up is positive).
//
// The core move, like real kite fighting: let go and your kite SPINS on the spot;
// hold and it DASHES in the direction its nose points. Dash your kite through the
// other kite's string to put a notch in it; enough notches (you choose: 1 to 7) and it's cut.
// Ram the other KITE at full dash and it's knocked to the grass for 2 seconds.

export interface Vec { x: number; y: number }
export interface TailPt { x: number; y: number; px: number; py: number }
export type PickupType = 'glass' | 'mend' | 'boost' | 'shield';
export interface Pickup { x: number; y: number; type: PickupType; t: number }

export const A = {
  W: 960, TOP: 500,
  step: 1 / 120,
  thrust: 1400,     // dash push while holding
  drag: 2.6,        // air drag (top speed = thrust / drag)
  gravity: 90,      // slow sink while spinning
  spin: 3.6,        // radians per second while released
  maxSpeed: 540,
  kiteR: 16,
  hitSpeed: 230,    // a pass only counts if the kite is dashing at least this fast
  hitFrom: 0.4,     // only the string beyond this fraction (towards the kite) can be notched
  hitCooldown: 0.5, // seconds before the same kite can score again
  ramSpeed: 200,    // dashing into the other kite at least this fast knocks it down...
  downTime: 2,      // ...for this long (no control)
  gust: 700,        // sideways push of a gust of wind
  gustWarn: 1.6, gustLen: 1.6,
};

const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

/** Small seeded random generator, so matches can be replayed and tested. */
export function rng(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const TAIL_N = 12, TAIL_SEG = 9;

export class Kite {
  x = 0; y = 0; vx = 0; vy = 0;
  heading = 0;            // 0 = nose up, positive = clockwise
  pulling = false; pull = 0;
  health = 3;             // notches left before the string is cut
  max = 3;                // notches a full string has (the match's cut setting)
  hitCD = 0; px = 0; py = 0;
  scripted = false; sx = 0; sy = 0;   // intro reel: the kite follows (sx, sy) instead of physics
  sharpT = 0; boostT = 0; invT = 0;
  downT = 0;              // knocked down: seconds left lying on the grass
  shield = false;         // blocks the next notch
  cut = false; cutAt: Vec | null = null;
  tail: TailPt[] = [];
  spinDir: 1 | -1;

  constructor(public side: 0 | 1, public hand: Vec) { this.spinDir = side === 0 ? 1 : -1; }

  get dir(): Vec { return { x: Math.sin(this.heading), y: Math.cos(this.heading) }; }
  get speed() { return Math.hypot(this.vx, this.vy); }
  get bottom(): Vec { const d = this.dir; return { x: this.x - d.x * 30, y: this.y - d.y * 30 }; }

  place(x: number, y: number, heading: number) {
    this.x = x; this.y = y; this.vx = 0; this.vy = 0; this.heading = heading;
    this.pulling = false; this.pull = 0; this.health = this.max; this.hitCD = 0; this.px = x; this.py = y;
    this.sharpT = 0; this.boostT = 0; this.invT = 0; this.downT = 0; this.shield = false; this.cut = false; this.cutAt = null;
    const b = this.bottom;
    this.tail = Array.from({ length: TAIL_N }, (_, i) => ({ x: b.x, y: b.y - i * TAIL_SEG, px: b.x, py: b.y - i * TAIL_SEG }));
  }

  /** Points along the string from hand to kite (a sagging curve, tighter when pulling). */
  stringPts(n = 10): Vec[] {
    const h = this.hand, dx = this.x - h.x, dy = this.y - h.y;
    const sag = Math.hypot(dx, dy) * (0.03 + 0.15 * (1 - this.pull));
    const cx = h.x + dx / 2, cy = h.y + dy / 2 - sag;
    const pts: Vec[] = [];
    for (let i = 0; i <= n; i++) {
      const t = i / n, u = 1 - t;
      pts.push({ x: u * u * h.x + 2 * u * t * cx + t * t * this.x, y: Math.max(3, u * u * h.y + 2 * u * t * cy + t * t * this.y) });
    }
    return pts;
  }

  step(dt: number, hold: boolean, wind: number, t: number, gust = 0) {
    if (this.cut) {
      // Cut loose: tumble away on the wind
      this.vx += (wind * 90 + (this.side ? 40 : -40) - this.vx) * 0.8 * dt;
      this.vy += (-25 - this.vy) * 0.8 * dt;
      this.heading += 2.5 * this.spinDir * dt;
      this.x += this.vx * dt; this.y += this.vy * dt;
      this.stepTail(dt, wind, t);
      return;
    }
    if (this.scripted) {
      this.px = this.x; this.py = this.y;
      this.vx = (this.sx - this.x) / dt; this.vy = (this.sy - this.y) / dt;
      this.x = this.sx; this.y = this.sy;
      this.hitCD = Math.max(0, this.hitCD - dt);
      this.stepTail(dt, wind, t);
      return;
    }
    this.px = this.x; this.py = this.y;
    if (this.downT > 0) {
      // Knocked down: tumble to the grass and lie there, then pop back up
      this.downT -= dt;
      this.pulling = false; this.pull += (0 - this.pull) * Math.min(1, dt * 12);
      if (this.y > 15) { this.vy += (-520 - this.vy) * 3 * dt; this.vx *= 1 - 2 * dt; this.heading += this.spinDir * 9 * dt; }
      else {
        this.vy = 0; this.vx *= 1 - 6 * dt;
        const h = wrap(this.heading), flat = h >= 0 ? 1.5 : -1.5;
        this.heading = h + (flat - h) * Math.min(1, dt * 10);
      }
      this.x += this.vx * dt; this.y = Math.max(14, this.y + this.vy * dt);
      this.x = Math.max(20, Math.min(A.W - 20, this.x));
      if (this.downT <= 0) { this.downT = 0; this.vy = 360; this.vx = 0; this.heading = 0; this.invT = 1; }
      this.sharpT = Math.max(0, this.sharpT - dt); this.boostT = Math.max(0, this.boostT - dt); this.hitCD = Math.max(0, this.hitCD - dt);
      this.stepTail(dt, wind, t);
      return;
    }
    this.pulling = hold;
    this.pull += ((hold ? 1 : 0) - this.pull) * Math.min(1, dt * 12);
    let ax: number, ay: number;
    if (hold) {
      const th = A.thrust * (this.boostT > 0 ? 1.35 : 1), d = this.dir;
      ax = d.x * th; ay = d.y * th - 40;
    } else {
      this.heading += this.spinDir * A.spin * dt;
      ax = wind * 70; ay = -A.gravity;
    }
    ax += gust * A.gust;
    this.vx += (ax - this.vx * A.drag) * dt;
    this.vy += (ay - this.vy * A.drag) * dt;
    this.x += this.vx * dt; this.y += this.vy * dt;
    // Soft walls on the sides and top
    if (this.x < 20) { this.x = 20; this.vx = Math.abs(this.vx) * 0.4; }
    if (this.x > A.W - 20) { this.x = A.W - 20; this.vx = -Math.abs(this.vx) * 0.4; }
    if (this.y > A.TOP) { this.y = A.TOP; this.vy = -Math.abs(this.vy) * 0.4; }
    this.sharpT = Math.max(0, this.sharpT - dt);
    this.boostT = Math.max(0, this.boostT - dt);
    this.invT = Math.max(0, this.invT - dt);
    this.hitCD = Math.max(0, this.hitCD - dt);
    this.stepTail(dt, wind, t);
  }

  stepTail(dt: number, wind: number, t: number) {
    const pts = this.tail, b = this.bottom, dt2 = dt * dt;
    pts[0].x = b.x; pts[0].y = b.y;
    for (let i = 1; i < pts.length; i++) {
      const p = pts[i];
      const vx = (p.x - p.px) * 0.97, vy = (p.y - p.py) * 0.97;
      p.px = p.x; p.py = p.y;
      p.x += vx + (wind * 160 + Math.sin(t * 9 - i * 0.8 + this.side) * 200) * dt2;
      p.y += vy - 300 * dt2;
    }
    for (let k = 0; k < 4; k++) for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1], c = pts[i], dx = c.x - a.x, dy = c.y - a.y, d = Math.hypot(dx, dy) || 1, f = (d - TAIL_SEG) / d;
      if (i === 1) { c.x -= dx * f; c.y -= dy * f; }
      else { a.x += dx * f * 0.5; a.y += dy * f * 0.5; c.x -= dx * f * 0.5; c.y -= dy * f * 0.5; }
    }
  }
}

function segHit(a: Vec, b: Vec, c: Vec, d: Vec): Vec | null {
  const r = { x: b.x - a.x, y: b.y - a.y }, s = { x: d.x - c.x, y: d.y - c.y };
  const den = r.x * s.y - r.y * s.x;
  if (Math.abs(den) < 1e-9) return null;
  const t = ((c.x - a.x) * s.y - (c.y - a.y) * s.x) / den, u = ((c.x - a.x) * r.y - (c.y - a.y) * r.x) / den;
  return t >= 0 && t <= 1 && u >= 0 && u <= 1 ? { x: a.x + r.x * t, y: a.y + r.y * t } : null;
}

/** Where the path a -> b passes through a string, if it does. */
export function through(a: Vec, b: Vec, str: Vec[]): Vec | null {
  for (let j = 1; j < str.length; j++) {
    const h = segHit(a, b, str[j - 1], str[j]);
    if (h) return h;
  }
  return null;
}

export type FEvent =
  | { kind: 'count'; n: number } | { kind: 'fight' }
  | { kind: 'hit'; by: 0 | 1; at: Vec; left: number; double: boolean }
  | { kind: 'cut'; loser: 0 | 1; at: Vec }
  | { kind: 'scrape'; who: 0 | 1 } | { kind: 'pickup'; who: 0 | 1; type: PickupType; at: Vec }
  | { kind: 'bump'; at: Vec }
  | { kind: 'knock'; who: 0 | 1; at: Vec } | { kind: 'block'; who: 0 | 1; at: Vec }
  | { kind: 'gust'; dir: 1 | -1; on: boolean };

export type Phase = 'count' | 'fight' | 'cut' | 'over';

export class Fight {
  kites: [Kite, Kite];
  phase: Phase = 'count'; phaseT = 0; t = 0; roundT = 0;
  round = 1; score: [number, number] = [0, 0];
  wind = 0; windTarget = 0; windT = 4;
  gustT = 8; gustWarn = 0; gustOn = 0; gustDir: 1 | -1 = 1;   // gusts: warning, then a strong sideways push
  pickups: Pickup[] = []; pickupT = 5;
  winner: -1 | 0 | 1 = -1; lastLoser: -1 | 0 | 1 = -1;
  events: FEvent[] = [];
  r: () => number;

  constructor(public seed = 1, public notches = 3, public firstTo = 2) {
    this.r = rng(seed);
    this.kites = [new Kite(0, { x: 90, y: 52 }), new Kite(1, { x: A.W - 90, y: 52 })];
    for (const k of this.kites) k.max = notches;
    this.startRound();
  }

  startRound() {
    this.kites[0].place(290, 300, 0.4);
    this.kites[1].place(A.W - 290, 300, -0.4);
    this.pickups = []; this.pickupT = 4 + this.r() * 3;
    this.phase = 'count'; this.phaseT = 0; this.roundT = 0;
    this.windTarget = (this.r() - 0.5) * 1.2;
    this.gustT = 6 + this.r() * 5; this.gustWarn = 0; this.gustOn = 0;
    this.events.push({ kind: 'count', n: 3 });
  }

  /** Sideways gust force right now (-1..1), smooth in and out. */
  gustForce() { return this.gustOn > 0 ? this.gustDir * Math.sin(Math.PI * (1 - this.gustOn / A.gustLen)) : 0; }

  step(hold: [boolean, boolean]) {
    const dt = A.step;
    this.t += dt; this.phaseT += dt;
    // Wind wanders
    this.windT -= dt;
    if (this.windT <= 0) { this.windT = 5 + this.r() * 5; this.windTarget = (this.r() - 0.5) * 1.6; }
    this.wind += (this.windTarget - this.wind) * 0.6 * dt;

    if (this.phase === 'count') {
      const before = Math.floor((this.phaseT - dt) / 0.7), now = Math.floor(this.phaseT / 0.7);
      if (now !== before && now < 3) this.events.push({ kind: 'count', n: 3 - now });
      for (const k of this.kites) { k.y += Math.sin(this.t * 3 + k.side) * 0.15; k.stepTail(dt, this.wind, this.t); }
      if (this.phaseT >= 2.1) { this.phase = 'fight'; this.phaseT = 0; this.events.push({ kind: 'fight' }); }
      return;
    }

    const live = this.phase === 'fight';
    if (live) {
      if (this.gustOn > 0) this.gustOn = Math.max(0, this.gustOn - dt);
      else if (this.gustWarn > 0) {
        this.gustWarn -= dt;
        if (this.gustWarn <= 0) { this.gustWarn = 0; this.gustOn = A.gustLen; this.events.push({ kind: 'gust', dir: this.gustDir, on: true }); }
      } else if ((this.gustT -= dt) <= 0) {
        this.gustT = 9 + this.r() * 7; this.gustDir = this.r() < 0.5 ? -1 : 1; this.gustWarn = A.gustWarn;
        this.events.push({ kind: 'gust', dir: this.gustDir, on: false });
      }
    } else { this.gustWarn = 0; this.gustOn = 0; }
    const g = this.gustForce();
    this.kites.forEach((k, i) => k.step(dt, live && hold[i], this.wind, this.t, g));

    if (this.phase === 'cut' || this.phase === 'over') {
      if (this.phase === 'cut' && this.phaseT > 2.6) { this.round++; this.startRound(); }
      return;
    }

    this.roundT += dt;
    const [a, b] = this.kites;

    // Touching the grass just bounces the kite back up, nose to the sky
    for (const k of this.kites) {
      if (k.y < 14 && k.downT <= 0) {
        if (k.invT <= 0) { k.vy = 320; k.heading = 0; k.invT = 0.5; this.events.push({ kind: 'scrape', who: k.side }); }
        else k.vy = Math.abs(k.vy);
        k.y = 14;
      }
    }

    // Kites bumping into each other
    const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy);
    if (d < 32 && d > 0) {
      const nx = dx / d, ny = dy / d, push = (32 - d) / 2;
      a.x -= nx * push; a.y -= ny * push; b.x += nx * push; b.y += ny * push;
      const rel = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny, at = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      // Ramming: whoever charges in harder knocks the other one down
      const ca = a.vx * nx + a.vy * ny, cb = -(b.vx * nx + b.vy * ny);
      const [att, vic, push2] = ca >= cb ? [a, b, ca] : [b, a, cb];
      if (push2 >= A.ramSpeed && att.pulling && att.downT <= 0 && vic.downT <= 0 && vic.invT <= 0) {
        vic.downT = A.downTime; vic.vx = att.vx * 0.6; vic.vy = -250;
        att.vx *= 0.3; att.vy *= 0.3; att.invT = Math.max(att.invT, 0.3);
        this.events.push({ kind: 'knock', who: vic.side, at });
      } else if (rel < 0) { a.vx += rel * nx; a.vy += rel * ny; b.vx -= rel * nx; b.vy -= rel * ny; this.events.push({ kind: 'bump', at }); }
    }

    // Dashing through the other kite's string puts a notch in it
    let lastHit: Vec | null = null;
    for (const [k, o] of [[a, b], [b, a]] as const) {
      if (k.hitCD > 0 || k.speed < A.hitSpeed || o.health <= 0) continue;
      const at = through({ x: k.px, y: k.py }, k, o.stringPts().slice(Math.round(10 * A.hitFrom)));
      if (!at) continue;
      k.hitCD = A.hitCooldown;
      if (o.shield) { o.shield = false; this.events.push({ kind: 'block', who: o.side, at }); continue; }
      const double = k.sharpT > 0;
      o.health = Math.max(0, o.health - (double ? 2 : 1));
      k.hitCD = A.hitCooldown;
      lastHit = at;
      this.events.push({ kind: 'hit', by: k.side, at, left: o.health, double });
    }

    // Pickups
    this.pickupT -= dt;
    if (this.pickupT <= 0 && this.pickups.length < 2) {
      this.pickupT = 6 + this.r() * 4;
      const roll = this.r();
      this.pickups.push({ x: 220 + this.r() * (A.W - 440), y: 210 + this.r() * 240, type: roll < 0.3 ? 'glass' : roll < 0.55 ? 'boost' : roll < 0.75 ? 'mend' : 'shield', t: 0 });
    }
    this.pickups = this.pickups.filter((p) => {
      p.t += dt;
      for (const k of this.kites) {
        if (Math.hypot(k.x - p.x, k.y - p.y) < 34) {
          if (p.type === 'glass') k.sharpT = 6;
          else if (p.type === 'boost') k.boostT = 5;
          else if (p.type === 'shield') k.shield = true;
          else k.health = Math.min(k.max, k.health + 1);
          this.events.push({ kind: 'pickup', who: k.side, type: p.type, at: { x: p.x, y: p.y } });
          return false;
        }
      }
      return p.t < 9;
    });

    // Round over?
    const dead = this.kites.filter((k) => k.health <= 0);
    if (dead.length) {
      const loser = dead.length === 2 ? (this.r() < 0.5 ? a : b) : dead[0];
      this.endRound(loser.side, lastHit ?? { x: loser.x, y: loser.y });
    }
  }

  private endRound(loser: 0 | 1, at: Vec) {
    const k = this.kites[loser];
    k.cut = true; k.cutAt = { ...at };
    this.score[1 - loser]++;
    this.lastLoser = loser;
    this.events.push({ kind: 'cut', loser, at });
    this.phaseT = 0;
    if (this.score[1 - loser] >= this.firstTo) { this.phase = 'over'; this.winner = (1 - loser) as 0 | 1; }
    else this.phase = 'cut';
  }
}
