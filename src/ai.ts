import { A, through, type Fight, type Vec } from './physics';
import type { Brain } from './opponents';

const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

/** A computer kite flyer. Call decide() every physics step; it returns "hold" or not. */
export class AI {
  private next = 0; private hold = false; private holdT = 0; private along = 0.55; private sawT = 0; private ramming = false;

  constructor(public b: Brain, public me: 0 | 1, private r: () => number) {}

  decide(f: Fight): boolean {
    const dt = A.step;
    if (this.hold) this.holdT += dt;
    if (this.hold && this.holdT > this.b.holdMax) { this.hold = false; this.next = f.t + this.b.think; }
    if (f.t < this.next) return this.hold;
    this.next = f.t + this.b.think * (0.7 + 0.6 * this.r());

    const k = f.kites[this.me], o = f.kites[1 - this.me];
    let target: Vec, low = this.b.care + 30;
    const close = Math.hypot(o.x - k.x, o.y - k.y);

    if (o.downT > 0.3 && !o.cut) {
      // They're lying on the grass: swoop on the bright part of their string
      const sp = o.stringPts(), q = sp[7 + Math.floor(this.r() * 3)];
      target = { x: q.x + (k.x < q.x ? 40 : -40), y: q.y - 10 }; low = 10;
    } else if (this.ramming && close < 260 && o.downT <= 0 && o.invT <= 0) {
      target = { x: o.x + o.vx * 0.12, y: o.y + o.vy * 0.12 };      // charge straight at their kite
    } else if (k.y < this.b.care) target = { x: k.x, y: k.y + 220 };
    else {
      // Aim for a point on the other side of their string from where my kite is now,
      // so every dash goes through it, then loop back and do it again.
      const oh = o.hand, dx = o.x - oh.x, dy = o.y - oh.y, len = Math.hypot(dx, dy) || 1;
      const px = -dy / len, py = dx / len;
      const side = px * (k.x - oh.x) + py * (k.y - oh.y) > 0 ? -1 : 1;
      if (f.t > this.sawT) { this.along = 0.6 + this.r() * 0.35; this.sawT = f.t + 1.5; this.ramming = this.r() < this.b.ram; }
      target = { x: oh.x + dx * this.along + px * side * this.b.reach, y: oh.y + dy * this.along + py * side * this.b.reach };
      // A tempting pickup nearby?
      for (const p of f.pickups) if (Math.hypot(p.x - k.x, p.y - k.y) < 160) target = p;
    }
    target.x = Math.max(60, Math.min(A.W - 60, target.x));
    target.y = Math.max(low, Math.min(A.TOP - 20, target.y));

    const tx = target.x - k.x, ty = target.y - k.y;
    const want = Math.atan2(tx, ty);
    let pull = Math.abs(wrap(want - k.heading)) < this.b.tol && Math.hypot(tx, ty) > 40;
    const d = k.dir;
    if (d.y < -0.3 && k.y < this.b.care + 90 && low > 10) pull = false;   // never dash at the ground (unless pouncing)
    // Sharp-eyed flyers look along their nose: if a dash right now would slice the bright part of the string, go!
    if (this.b.snipe && !o.cut && this.r() < this.b.snipe && k.y > 30) {
      const ray = { x: k.x + d.x * 240, y: k.y + d.y * 240 };
      if (ray.y > 0 && through(k, ray, o.stringPts().slice(Math.round(10 * A.hitFrom)))) pull = true;
    }
    if (this.r() < this.b.mistakes * this.b.think) pull = !pull;
    if (pull && !this.hold) this.holdT = 0;
    this.hold = pull;
    return pull;
  }
}
