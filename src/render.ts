import { A, type Fight, type Kite, type PickupType, type Vec } from './physics';
import type { KiteLook } from './opponents';

// Everything is drawn in a fixed 960 x 540 arena, scaled to fit and centred; the sky and grass fill any extra space.
const VW = 960, VH = 540, GROUND = 470;

/** Kites players can pick. Looks only: every kite flies exactly the same. */
export const KITES: (KiteLook & { name: string })[] = [
  { name: 'Sunrise', shape: 'diamond', a: '#ff6b6b', b: '#ffd166', tail: ['#ff6b6b', '#ffd166', '#4ecdc4'] },
  { name: 'Ocean', shape: 'diamond', a: '#3a86ff', b: '#8ecae6', tail: ['#3a86ff', '#ffffff', '#8ecae6'] },
  { name: 'Tiger Patang', shape: 'patang', deco: 'stripes', a: '#ff8c1a', b: '#2b2118', tail: ['#ff8c1a', '#2b2118', '#ffd166'] },
  { name: 'Phoenix', shape: 'delta', a: '#e63946', b: '#ffb703', tail: ['#ffb703', '#e63946', '#fb8500'] },
  { name: 'Dragon Eye', shape: 'hex', deco: 'eye', a: '#2a9d8f', b: '#e9c46a', tail: ['#2a9d8f', '#e9c46a', '#264653'] },
  { name: 'Midnight Star', shape: 'diamond', deco: 'star', a: '#1d3557', b: '#a8dadc', tail: ['#a8dadc', '#f1faee', '#457b9d'] },
];

type P2 = [number, number];
/** Draw a kite body at the origin, nose pointing up (canvas units). Used in the game and the kite picker. */
export function drawKite(c: CanvasRenderingContext2D, look: KiteLook) {
  const poly = (pts: P2[], col: string) => { c.fillStyle = col; c.beginPath(); c.moveTo(...pts[0]); for (const p of pts.slice(1)) c.lineTo(...p); c.closePath(); c.fill(); };
  c.strokeStyle = 'rgba(60,40,30,0.55)'; c.lineWidth = 1.2;
  const shape = look.shape ?? 'diamond';
  if (shape === 'diamond') {
    const top: P2 = [0, -26], right: P2 = [18, -6], bot: P2 = [0, 30], left: P2 = [-18, -6], mid: P2 = [0, -6];
    poly([mid, top, right], look.a); poly([mid, right, bot], look.b); poly([mid, bot, left], look.a); poly([mid, left, top], look.b);
    c.beginPath(); c.moveTo(...top); c.lineTo(...bot); c.moveTo(...left); c.lineTo(...right); c.stroke();
  } else if (shape === 'patang') {
    // Fighter kite: wide diamond with a bowed spar and a little tail flap
    const top: P2 = [0, -25], right: P2 = [23, -3], bot: P2 = [0, 22], left: P2 = [-23, -3];
    poly([top, right, bot, left], look.a);
    poly([[0, 20], [-7, 30], [7, 30]], look.b);
    c.beginPath(); c.moveTo(...top); c.lineTo(...bot); c.moveTo(-23, -3); c.quadraticCurveTo(0, -16, 23, -3); c.stroke();
  } else if (shape === 'delta') {
    const nose: P2 = [0, -28], lw: P2 = [-28, 14], rw: P2 = [28, 14], notch: P2 = [0, 6];
    poly([nose, notch, lw], look.a); poly([nose, rw, notch], look.b);
    c.beginPath(); c.moveTo(...nose); c.lineTo(0, 18); c.moveTo(-14, -4); c.lineTo(14, -4); c.stroke();
  } else {
    // Rokkaku: tall hexagon
    poly([[-13, -27], [13, -27], [20, -8], [14, 27], [-14, 27], [-20, -8]], look.a);
    c.beginPath(); c.moveTo(-20, -8); c.lineTo(20, -8); c.moveTo(0, -27); c.lineTo(0, 27); c.stroke();
  }
  if (look.deco === 'star') {
    c.fillStyle = '#ffd166'; c.beginPath();
    for (let i = 0; i < 10; i++) { const r = i % 2 ? 3.5 : 8, a = (i * Math.PI) / 5 - Math.PI / 2; c.lineTo(Math.cos(a) * r, -6 + Math.sin(a) * r); }
    c.fill();
  } else if (look.deco === 'stripes') {
    c.fillStyle = look.b;
    for (const sx of [-12, 12]) { c.beginPath(); c.moveTo(sx, -10); c.lineTo(sx + (sx < 0 ? -5 : 5), -5); c.lineTo(sx * 0.5, 8); c.lineTo(sx * 0.4, 2); c.fill(); }
  } else if (look.deco === 'eye') {
    c.fillStyle = look.b; c.beginPath(); c.ellipse(0, 4, 11, 8, 0, 0, 7); c.fill();
    c.fillStyle = '#fff'; c.beginPath(); c.ellipse(0, 4, 7, 6, 0, 0, 7); c.fill();
    c.fillStyle = '#1b1b1b'; c.beginPath(); c.ellipse(0, 4, 2.5, 5.5, 0, 0, 7); c.fill();
  }
}

interface Particle { x: number; y: number; vx: number; vy: number; life: number; max: number; color: string; size: number; grav: number }
interface Pop { text: string; x: number; y: number; t: number; color: string }

/** Blend two #rrggbb colours (f = 0..1). */
function mix(a: string, b: string, f: number) {
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
  const ch = (sh: number) => Math.round(((pa >> sh) & 255) * (1 - f) + ((pb >> sh) & 255) * f);
  return `rgb(${ch(16)},${ch(8)},${ch(0)})`;
}

const hash = (n: number) => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
const PICKUP: Record<PickupType, { icon: string; color: string; label: string }> = {
  glass: { icon: '✦', color: '#7fdbff', label: 'GLASS STRING!' },
  boost: { icon: '➤', color: '#ffd166', label: 'SPEED!' },
  mend: { icon: '✚', color: '#7ee081', label: 'STRING MENDED' },
};

export class Renderer {
  ctx: CanvasRenderingContext2D;
  w = 0; h = 0; s = 1; ox = 0; oy = 0;
  parts: Particle[] = [];
  pops: Pop[] = [];
  shake = 0;
  big: { text: string; sub: string; t: number; color: string } | null = null;
  looks: [KiteLook, KiteLook] = [KITES[0], KITES[1]];
  twoP = false;          // same-screen two players: show the split guide
  caption = '';          // big help text along the bottom (intro reel)
  highlight = false;     // glow on the cuttable part of the right kite's string (intro reel)
  names: [string, string] = ['You', 'Rival'];
  modeName = '';
  hud = true;
  debug = false;

  constructor(public canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext('2d')!;
    this.resize();
  }

  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.w = window.innerWidth; this.h = window.innerHeight;
    this.canvas.width = Math.round(this.w * dpr); this.canvas.height = Math.round(this.h * dpr);
    this.s = Math.min(this.h / VH, this.w / VW);
    this.ox = (this.w / this.s - VW) / 2; this.oy = (this.h / this.s - VH) / 2;
    this.ctx.setTransform(dpr * this.s, 0, 0, dpr * this.s, dpr * this.s * this.ox, dpr * this.s * this.oy);
  }

  private Y(y: number) { return GROUND - y; }

  burst(at: Vec, colors: string[], n = 24, speed = 220, grav = 300) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, sp = speed * (0.3 + Math.random() * 0.7);
      this.parts.push({ x: at.x, y: at.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 0, max: 0.5 + Math.random() * 0.6, color: colors[i % colors.length], size: 2 + Math.random() * 3, grav });
    }
  }
  pop(text: string, at: Vec, color = '#fff') { this.pops.push({ text, x: at.x, y: at.y, t: 0, color }); }
  banner(text: string, sub = '', color = '#fff') { this.big = { text, sub, t: 0, color }; }
  pickupLabel(t: PickupType) { return PICKUP[t]; }

  draw(f: Fight, dt: number, aimHint: boolean, aimBoth = false, mine: 0 | 1 = 0) {
    const c = this.ctx;
    c.save();
    if (this.shake > 0) { c.translate((Math.random() - 0.5) * this.shake, (Math.random() - 0.5) * this.shake); this.shake = Math.max(0, this.shake - dt * 40); }
    this.scene(f);

    // Pickups
    for (const p of f.pickups) {
      const x = p.x, y = this.Y(p.y + Math.sin(p.t * 3) * 5), info = PICKUP[p.type], fade = p.t > 7.5 ? (Math.sin(p.t * 20) > 0 ? 1 : 0.3) : 1;
      c.globalAlpha = fade;
      const g = c.createRadialGradient(x, y, 3, x, y, 30); g.addColorStop(0, info.color); g.addColorStop(1, info.color + '00');
      c.fillStyle = g; c.beginPath(); c.arc(x, y, 30, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#fff'; c.beginPath(); c.arc(x, y, 15, 0, Math.PI * 2); c.fill();
      c.fillStyle = info.color; c.font = 'bold 18px system-ui'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(info.icon, x, y + 1);
      c.globalAlpha = 1;
    }

    this.flyer(f.kites[0], f);
    this.flyer(f.kites[1], f);
    for (const k of f.kites) this.string(k, f);

    for (const k of f.kites) this.kite(k, this.looks[k.side], f.t);
    if (aimHint && f.phase !== 'over') { this.aim(f.kites[mine], f.t); if (aimBoth) this.aim(f.kites[1 - mine], f.t); }
    if (this.twoP && f.round === 1 && (f.phase === 'count' || (f.phase === 'fight' && f.roundT < 2.5))) this.splitGuide(f);
    this.particles(dt);
    this.popups(dt);
    if (this.hud) this.hudDraw(f);
    this.banners(dt);
    if (this.caption) this.captionDraw(f.t);
    if (this.debug) this.debugDraw(f);
    c.restore();
  }

  // ---------- scenery ----------
  private scene(f: Fight) {
    const c = this.ctx, x0 = -this.ox - 10, x1 = VW + this.ox + 10, top = -this.oy - 10, bot = VH + this.oy + 10;
    const g = c.createLinearGradient(0, top, 0, GROUND);
    g.addColorStop(0, '#7cc4ea'); g.addColorStop(0.6, '#b9e2f1'); g.addColorStop(1, '#eaf6e6');
    c.fillStyle = g; c.fillRect(x0, top, x1 - x0, bot - top);
    const sg = c.createRadialGradient(780, 80, 10, 780, 80, 150);
    sg.addColorStop(0, '#fff6d6'); sg.addColorStop(0.3, 'rgba(255,246,214,0.6)'); sg.addColorStop(1, 'rgba(255,246,214,0)');
    c.fillStyle = sg; c.fillRect(620, -80, 320, 320);
    // Clouds drift with the wind
    const off = f.t * (8 + f.wind * 25);
    c.fillStyle = '#fff';
    for (let k = -2; k < 6; k++) {
      const span = VW + 600, x = ((k * 330 + off + hash(k) * 200) % span + span) % span - 300, y = 50 + hash(k + 9) * 130, sz = 0.6 + hash(k + 3) * 0.7;
      c.globalAlpha = 0.6 + hash(k + 5) * 0.3;
      c.beginPath(); c.ellipse(x, y, 60 * sz, 20 * sz, 0, 0, 7); c.ellipse(x - 30 * sz, y + 4, 34 * sz, 16 * sz, 0, 0, 7); c.ellipse(x + 26 * sz, y - 10 * sz, 36 * sz, 22 * sz, 0, 0, 7); c.fill();
    }
    c.globalAlpha = 1;
    this.hills(x0, x1, 340, 55, '#b5dcb0', 1);
    this.hills(x0, x1, 395, 40, '#8cc77f', 2);
    // Town rooftops on the far hill
    for (let k = 0; k < 9; k++) {
      const x = 120 + k * 95 + hash(k) * 40, base = this.hillY(x, 395, 40, 2) + 6, h = 18 + hash(k + 1) * 22, w = 26 + hash(k + 2) * 16;
      c.fillStyle = ['#e9d8c4', '#f2e6d0', '#dccab4'][k % 3]; c.fillRect(x - w / 2, base - h, w, h);
      c.fillStyle = ['#c26a4a', '#a8584a', '#d08158'][k % 3]; c.beginPath(); c.moveTo(x - w / 2 - 3, base - h); c.lineTo(x, base - h - 12); c.lineTo(x + w / 2 + 3, base - h); c.fill();
    }
    // Ground
    c.fillStyle = '#6cb35f'; c.fillRect(x0, GROUND - 6, x1 - x0, bot - GROUND + 6);
    c.fillStyle = '#8acb6d'; c.beginPath(); c.moveTo(x0, GROUND + 2);
    for (let x = x0; x <= x1; x += 10) c.lineTo(x, GROUND - 8 + Math.sin(x * 0.05) * 2);
    c.lineTo(x1, GROUND + 2); c.fill();
    c.strokeStyle = '#4c8f4a'; c.lineWidth = 1.5;
    for (let k = 0; k < 40; k++) {
      const x = x0 + hash(k) * (x1 - x0), y = GROUND + 20 + hash(k + 1) * 50;
      c.beginPath(); c.moveTo(x - 3, y); c.lineTo(x - 5, y - 7); c.moveTo(x, y); c.lineTo(x, y - 9); c.moveTo(x + 3, y); c.lineTo(x + 6, y - 6); c.stroke();
    }
  }

  private hillY(x: number, base: number, amp: number, seed: number) {
    return base - amp * (0.55 * Math.sin(x * 0.0041 + seed) + 0.3 * Math.sin(x * 0.0093 + seed * 2.3) + 0.15 * Math.sin(x * 0.021 + seed * 4.1));
  }
  private hills(x0: number, x1: number, base: number, amp: number, color: string, seed: number) {
    const c = this.ctx;
    c.fillStyle = color; c.beginPath(); c.moveTo(x0, VH + this.oy + 10);
    for (let x = x0; x <= x1 + 8; x += 8) c.lineTo(x, this.hillY(x, base, amp, seed));
    c.lineTo(x1, VH + this.oy + 10); c.fill();
  }

  // ---------- people, strings, kites ----------
  /** How a flyer stands: the match loser wobbles, turns green and faints; the winner cheers. */
  private pose(k: Kite, f: Fight) {
    const over = f.phase === 'over' && f.winner !== -1;
    const lost = over && f.winner !== k.side, won = over && f.winner === k.side;
    const m = k.side ? -1 : 1, ft = lost ? Math.max(0, f.phaseT - 0.6) : 0;
    let ang = 0, sick = 0, sag = 0, out = false;
    if (ft > 0) {
      const w = Math.min(1, ft / 1.3);
      sick = w; sag = 5 * w;
      ang = Math.sin(ft * 11) * 0.16 * w;                      // wobble, getting worse
      if (ft > 1.3) {                                          // ...then keel over backwards
        const q = Math.min(1, (ft - 1.3) / 0.4);
        ang = -m * 1.5 * q * q; sag = 5 * (1 - q); out = true;
        if (ft > 1.7) ang += -m * Math.sin((ft - 1.7) * 16) * 0.08 * Math.exp(-(ft - 1.7) * 5);
      }
    }
    return { m, ang, sick, sag, out, won, ft, px: k.hand.x - 10 * m, py: GROUND + 2 };
  }

  /** Where the flyer's string hand is on screen (it droops when they faint). */
  private handPos(k: Kite, f: Fight): Vec {
    const p = this.pose(k, f);
    const nx = k.hand.x - (k.pulling ? 5 * p.m : 0) - p.px, ny = this.Y(k.hand.y) - p.py;
    const lx = nx + (6 * p.m - nx) * p.sick, ly = ny + (-26 - ny) * p.sick;
    const c = Math.cos(p.ang), s = Math.sin(p.ang);
    return { x: p.px + lx * c - ly * s, y: p.py + lx * s + ly * c };
  }

  private flyer(k: Kite, f: Fight) {
    const c = this.ctx, p = this.pose(k, f), m = p.m, t = f.t;
    const colour = k.side ? this.looks[1].a : '#ff7a59';
    const hop = p.won ? -Math.abs(Math.sin(f.phaseT * 9)) * 5 : k.pulling ? Math.sin(t * 30) * 0.8 : 0;
    const hip = -24 + p.sag + hop, head = hip - 30;
    const skin = p.sick > 0 ? mix('#f3c9a3', '#a9cf7f', p.sick) : '#f3c9a3';
    c.save(); c.translate(p.px, p.py); c.rotate(p.ang);
    // Legs (knees buckle while wobbling)
    c.strokeStyle = '#2f3d4c'; c.lineCap = 'round'; c.lineWidth = 4;
    c.beginPath(); c.moveTo(0, hip); c.lineTo(-2 * m - p.sag, hip / 2); c.lineTo(-5 * m, 0);
    c.moveTo(0, hip); c.lineTo(3 * m + p.sag, hip / 2); c.lineTo(6 * m, 0); c.stroke();
    c.fillStyle = colour; c.beginPath(); c.roundRect(-7, hip - 22, 14, 24, 5); c.fill();
    // Head, hair, face
    c.fillStyle = skin; c.beginPath(); c.arc(0, head, 7, 0, 7); c.fill();
    c.fillStyle = '#3d2c22'; c.beginPath(); c.arc(0, head - 2, 7.2, Math.PI, 0); c.fill();
    c.strokeStyle = c.fillStyle = '#2b2b2b'; c.lineWidth = 1.2;
    if (p.out) {
      for (const ex of [-2.6, 2.6]) { c.beginPath(); c.moveTo(ex - 1.5, head - 1.5); c.lineTo(ex + 1.5, head + 1.5); c.moveTo(ex + 1.5, head - 1.5); c.lineTo(ex - 1.5, head + 1.5); c.stroke(); }
    } else {
      for (const ex of [-2.6, 2.6]) { c.beginPath(); c.arc(ex, head, 1.1, 0, 7); c.fill(); }
    }
    c.beginPath();
    if (p.won) c.arc(0, head + 2, 2.6, 0.1 * Math.PI, 0.9 * Math.PI);
    else if (p.sick > 0) { c.moveTo(-2.5, head + 3.5); c.quadraticCurveTo(-1, head + 2.2, 0, head + 3.5); c.quadraticCurveTo(1, head + 4.8, 2.5, head + 3.5); }
    c.stroke();
    if (p.sick > 0.3 && !p.out) { // sweat drop
      c.fillStyle = 'rgba(120,190,255,0.9)'; const sy = head - 4 + ((p.ft * 20) % 8);
      c.beginPath(); c.moveTo(7 * m, sy - 3); c.quadraticCurveTo(9.5 * m, sy + 1, 7 * m, sy + 2); c.quadraticCurveTo(4.5 * m, sy + 1, 7 * m, sy - 3); c.fill();
    }
    if (p.out) { // dizzy stars circling the head
      c.fillStyle = '#ffd166';
      for (let i = 0; i < 3; i++) {
        const a = t * 5 + (i * Math.PI * 2) / 3, sx = Math.cos(a) * 11, sy = head - 9 + Math.sin(a) * 3;
        c.font = '9px system-ui'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('★', sx, sy);
      }
    }
    // String arm (goes limp when fainting)
    const nx = k.hand.x - (k.pulling ? 5 * m : 0) - p.px, ny = this.Y(k.hand.y) - p.py;
    const hx = nx + (6 * m - nx) * p.sick, hy = ny + (-26 - ny) * p.sick;
    c.strokeStyle = colour; c.lineWidth = 3.5;
    c.beginPath(); c.moveTo(3 * m, hip - 18); c.lineTo(hx, hy); c.stroke();
    // Spool arm: punches the air when they win
    const sx = p.won ? -10 * m : -6 * m, sy = p.won ? hip - 46 : hip - 8;
    c.beginPath(); c.moveTo(-3 * m, hip - 18); c.lineTo(sx, sy); c.stroke();
    c.fillStyle = '#c9a26b'; c.beginPath(); c.arc(sx, sy, 5, 0, 7); c.fill();
    c.restore();
  }

  private string(k: Kite, f: Fight) {
    const c = this.ctx;
    const sharp = k.sharpT > 0;
    c.lineWidth = sharp ? 2 : 1.3;
    c.strokeStyle = sharp ? '#7fdbff' : k.health <= 1 ? `rgba(255,120,120,${0.6 + Math.sin(f.t * 20) * 0.3})` : 'rgba(255,255,255,0.92)';
    if (k.cut && k.cutAt) {
      // Loose end hangs from the hand; the other piece trails from the kite.
      const hp = this.handPos(k, f), hx = hp.x, hy = hp.y, fall = Math.min(1, f.phaseT * 1.5);
      const ex = k.cutAt.x + (hx - k.cutAt.x) * fall * 0.5, ey = this.Y(k.cutAt.y) + (GROUND - this.Y(k.cutAt.y)) * fall;
      c.beginPath(); c.moveTo(hx, hy); c.quadraticCurveTo((hx + ex) / 2, Math.max(hy, ey) + 20, ex, ey); c.stroke();
      const kx = k.x, ky = this.Y(k.y);
      c.beginPath(); c.moveTo(kx, ky); c.quadraticCurveTo(kx - k.vx * 0.3, ky + 40, kx - k.vx * 0.4 + (k.side ? 30 : -30), ky + 90); c.stroke();
      return;
    }
    const pts = k.stringPts(20), from = Math.round(20 * A.hitFrom);
    if (this.highlight && k.side === 1) {
      c.save(); c.strokeStyle = `rgba(255,214,90,${0.45 + Math.sin(f.t * 6) * 0.25})`; c.lineWidth = 12; c.lineCap = 'round';
      c.beginPath(); c.moveTo(pts[from].x, this.Y(pts[from].y));
      for (let i = from + 1; i < pts.length; i++) c.lineTo(pts[i].x, this.Y(pts[i].y));
      c.stroke(); c.restore();
    }
    c.beginPath(); c.moveTo(pts[0].x, this.Y(pts[0].y));
    for (let i = 1; i <= from; i++) c.lineTo(pts[i].x, this.Y(pts[i].y));
    c.globalAlpha = 0.55; c.stroke(); c.globalAlpha = 1;
    // The part near the kite is the target: brighter and thicker
    c.lineWidth += 1;
    c.beginPath(); c.moveTo(pts[from].x, this.Y(pts[from].y));
    for (let i = from + 1; i < pts.length; i++) c.lineTo(pts[i].x, this.Y(pts[i].y));
    c.stroke();
  }

  private kite(k: Kite, look: KiteLook, t: number) {
    const c = this.ctx;
    if (k.x < -this.ox - 80 || k.x > VW + this.ox + 80 || k.y > 700) return;
    // Tail with bows
    const tl = k.tail;
    c.strokeStyle = 'rgba(70,70,90,0.7)'; c.lineWidth = 1.4;
    c.beginPath(); c.moveTo(tl[0].x, this.Y(tl[0].y));
    for (let i = 1; i < tl.length; i++) c.lineTo(tl[i].x, this.Y(tl[i].y));
    c.stroke();
    for (let i = 2; i < tl.length; i += 2) {
      const p = tl[i], q = tl[i - 1], a = Math.atan2(-(p.y - q.y), p.x - q.x) + Math.PI / 2;
      c.save(); c.translate(p.x, this.Y(p.y)); c.rotate(a);
      c.fillStyle = look.tail[(i / 2) % look.tail.length];
      c.beginPath(); c.moveTo(0, 0); c.lineTo(-6, -3); c.lineTo(-6, 3); c.closePath(); c.moveTo(0, 0); c.lineTo(6, -3); c.lineTo(6, 3); c.closePath(); c.fill();
      c.restore();
    }
    c.save(); c.translate(k.x, this.Y(k.y)); c.rotate(k.heading);
    if (k.invT > 0 && Math.sin(t * 40) > 0) c.globalAlpha = 0.5;
    if (k.sharpT > 0 || k.boostT > 0) {
      const col = k.sharpT > 0 ? '127,219,255' : '255,209,102';
      const g = c.createRadialGradient(0, 0, 4, 0, 0, 40); g.addColorStop(0, `rgba(${col},0.7)`); g.addColorStop(1, `rgba(${col},0)`);
      c.fillStyle = g; c.beginPath(); c.arc(0, 0, 40, 0, 7); c.fill();
    }
    drawKite(c, look);
    c.restore();
  }

  /** Two players: which half of the screen each one holds. */
  private splitGuide(f: Fight) {
    const c = this.ctx, a = f.phase === 'count' ? 1 : Math.max(0, 1 - f.roundT / 2.5);
    c.save(); c.globalAlpha = a;
    c.strokeStyle = 'rgba(255,255,255,0.6)'; c.lineWidth = 2; c.setLineDash([10, 10]);
    c.beginPath(); c.moveTo(VW / 2, 90); c.lineTo(VW / 2, VH - 20); c.stroke(); c.setLineDash([]);
    c.font = '800 20px system-ui'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.lineWidth = 5; c.strokeStyle = 'rgba(30,50,70,0.55)';
    const labels: [number, string][] = [[VW * 0.25, `◀ ${this.names[0]}: hold this side`], [VW * 0.75, `${this.names[1]}: hold this side ▶`]];
    for (const [x, t] of labels) { c.strokeText(t, x, VH - 40); c.fillStyle = '#fff'; c.fillText(t, x, VH - 40); }
    c.restore();
  }

  private captionDraw(t: number) {
    const c = this.ctx, y = VH - 34;
    c.save();
    c.font = '800 24px system-ui'; c.textAlign = 'center'; c.textBaseline = 'middle';
    const w = Math.min(VW - 40, c.measureText(this.caption).width + 44);
    c.fillStyle = 'rgba(30,50,70,0.6)'; c.beginPath(); c.roundRect(VW / 2 - w / 2, y - 22, w, 44, 22); c.fill();
    c.fillStyle = '#fff'; c.globalAlpha = 0.85 + Math.sin(t * 4) * 0.15; c.fillText(this.caption, VW / 2, y + 1);
    c.restore();
  }

  /** Dotted arrow showing where your kite will dash if you hold now. */
  private aim(k: Kite, t: number) {
    if (k.cut) return;
    const c = this.ctx, d = k.dir;
    c.fillStyle = k.pulling ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.55)';
    for (let i = 0; i < 4; i++) {
      const dist = 40 + i * 16 + ((t * 40) % 16);
      c.beginPath(); c.arc(k.x + d.x * dist, this.Y(k.y + d.y * dist), 3 - i * 0.5, 0, 7); c.fill();
    }
  }

  // ---------- effects ----------
  private particles(dt: number) {
    const c = this.ctx;
    this.parts = this.parts.filter((p) => {
      p.life += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy -= p.grav * dt; p.vx *= 1 - 2 * dt;
      if (p.life > p.max) return false;
      c.globalAlpha = 1 - p.life / p.max; c.fillStyle = p.color;
      c.beginPath(); c.arc(p.x, this.Y(p.y), p.size, 0, 7); c.fill();
      return true;
    });
    c.globalAlpha = 1;
  }

  private popups(dt: number) {
    const c = this.ctx;
    c.textAlign = 'center'; c.textBaseline = 'middle';
    this.pops = this.pops.filter((p) => {
      p.t += dt;
      if (p.t > 1.1) return false;
      c.globalAlpha = Math.min(1, (1.1 - p.t) * 3);
      c.font = '800 20px system-ui'; c.lineWidth = 4; c.strokeStyle = 'rgba(30,50,70,0.6)';
      const y = this.Y(p.y) - 30 - p.t * 40;
      c.strokeText(p.text, p.x, y); c.fillStyle = p.color; c.fillText(p.text, p.x, y);
      return true;
    });
    c.globalAlpha = 1;
  }

  private banners(dt: number) {
    const b = this.big; if (!b) return;
    b.t += dt;
    if (b.t > 1.6) { this.big = null; return; }
    const c = this.ctx, grow = b.t < 0.15 ? 0.6 + (b.t / 0.15) * 0.55 : b.t < 0.25 ? 1.15 - ((b.t - 0.15) / 0.1) * 0.15 : 1;
    c.save(); c.translate(VW / 2, 230); c.scale(grow, grow);
    c.globalAlpha = b.t > 1.3 ? (1.6 - b.t) / 0.3 : 1;
    c.textAlign = 'center'; c.textBaseline = 'middle';
    c.font = '900 86px system-ui'; c.lineWidth = 10; c.strokeStyle = 'rgba(30,50,70,0.55)'; c.lineJoin = 'round';
    c.strokeText(b.text, 0, 0); c.fillStyle = b.color; c.fillText(b.text, 0, 0);
    if (b.sub) { c.font = '700 26px system-ui'; c.lineWidth = 6; c.strokeText(b.sub, 0, 62); c.fillStyle = '#fff'; c.fillText(b.sub, 0, 62); }
    c.restore();
  }

  private hudDraw(f: Fight) {
    const c = this.ctx;
    const bar = (x: number, k: Kite, right: boolean) => {
      // One segment per notch left; lost ones go dark from the inside out.
      const w = 300, h = 16, y = 20, n = f.notches, gap = 6, sw = (w - gap * (n - 1)) / n;
      const col = k.health <= 1 ? '#ff5a5f' : k.health < n ? '#ffd166' : '#7ee081';
      for (let i = 0; i < n; i++) {
        const sx = right ? x + w - (i + 1) * sw - i * gap : x + i * (sw + gap);
        c.fillStyle = i < k.health ? col : 'rgba(30,50,70,0.35)';
        c.beginPath(); c.roundRect(sx, y, sw, h, 8); c.fill();
      }
      c.font = '700 17px system-ui'; c.textBaseline = 'top'; c.fillStyle = '#fff'; c.textAlign = right ? 'right' : 'left';
      c.lineWidth = 3; c.strokeStyle = 'rgba(30,50,70,0.5)';
      const name = this.names[k.side] + (k.sharpT > 0 ? '  ✦' : '') + (k.boostT > 0 ? '  ➤' : '');
      c.strokeText(name, right ? x + w : x, y + 22); c.fillText(name, right ? x + w : x, y + 22);
      // Round pips
      for (let i = 0; i < f.firstTo; i++) {
        const px = right ? x + w - 8 - i * 18 : x + 8 + i * 18;
        c.beginPath(); c.arc(px, y + 54, 6, 0, 7);
        c.fillStyle = f.score[k.side] > i ? '#ffd166' : 'rgba(255,255,255,0.4)'; c.fill();
      }
    };
    bar(70, f.kites[0], false);
    bar(VW - 370, f.kites[1], true);
    // Round number + wind
    c.textAlign = 'center'; c.textBaseline = 'top'; c.font = '800 22px system-ui'; c.fillStyle = '#fff';
    c.lineWidth = 4; c.strokeStyle = 'rgba(30,50,70,0.5)';
    const label = `Round ${f.round}`;
    if (this.modeName) { c.font = '600 13px system-ui'; c.fillStyle = '#fff'; c.fillText(this.modeName, VW / 2, 62); c.font = '800 22px system-ui'; }
    if (!this.caption) { c.strokeText(label, VW / 2, 16); c.fillText(label, VW / 2, 16); }
    c.font = '600 13px system-ui'; c.fillStyle = '#fff';
    const arrow = Math.abs(f.wind) < 0.15 ? 'calm' : f.wind > 0 ? `wind ${'›'.repeat(1 + Math.round(Math.abs(f.wind) * 3))}` : `${'‹'.repeat(1 + Math.round(Math.abs(f.wind) * 3))} wind`;
    c.fillText(arrow, VW / 2, 46);
  }

  private debugDraw(f: Fight) {
    const c = this.ctx;
    c.strokeStyle = 'lime';
    for (const k of f.kites) { c.beginPath(); c.arc(k.x, this.Y(k.y), A.kiteR, 0, 7); c.stroke(); }
    c.fillStyle = '#000'; c.font = '12px monospace'; c.textAlign = 'left'; c.textBaseline = 'alphabetic';
    const [a, b] = f.kites;
    c.fillText(`${f.phase} t${f.roundT.toFixed(1)} notches ${a.health} / ${b.health} wind ${f.wind.toFixed(2)}`, 10, VH - 10);
  }
}
