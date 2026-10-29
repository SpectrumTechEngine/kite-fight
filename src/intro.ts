import { A, Fight } from './physics';

// The "How to win" reel shown when the game opens: in slow motion, the left kite loops
// round and round through the bright part of the right kite's string until it's cut.
// It uses the real game rules (the kites just follow set paths instead of being flown).

export const INTRO_SPEED = 0.45;   // slow motion

export class IntroScript {
  private a = Math.PI;             // position around the loop
  cycles = 0;                      // how many times the reel has reached the cut

  update(f: Fight) {
    const [atk, def] = f.kites;
    f.pickupT = 999; f.gustT = 999;                      // no power-ups or gusts in the reel
    const fresh = f.phase === 'count';
    if (fresh) { f.phase = 'fight'; f.phaseT = 0; this.a = Math.PI; }

    if (!def.cut) {
      def.scripted = true; def.pull = 0.5;
      def.sx = 640 + Math.sin(f.t * 0.8) * 8; def.sy = 330 + Math.sin(f.t * 1.3) * 6;
      def.heading = -0.25 + Math.sin(f.t) * 0.08;
    }
    if (!atk.cut) {
      atk.scripted = true; atk.pull = 1; atk.pulling = true;
      // Loop around a point on the right kite's string, crossing it twice per loop
      this.a += 4 * A.step;
      const cx = 714, cy = 241, vx = -Math.sin(this.a) * 85, vy = Math.cos(this.a) * 60;
      atk.sx = cx + Math.cos(this.a) * 85; atk.sy = cy + Math.sin(this.a) * 60;
      atk.heading = Math.atan2(vx, vy);
    }
    if (fresh) for (const k of f.kites) { k.x = k.px = k.sx; k.y = k.py = k.sy; }
  }

  caption(f: Fight) {
    const left = f.kites[1].health;
    if (f.phase !== 'fight') return 'THREE = CUT!   First to cut twice wins the match';
    if (left === 3) return 'Hold to dash your kite through the glowing part of their string';
    if (left === 2) return 'SNIP! That\'s one. Loop round and go again!';
    return 'Two! One more pass and their kite is gone…';
  }
}
