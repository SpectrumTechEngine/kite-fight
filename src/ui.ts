import { OPPONENTS, type KiteLook } from './opponents';
import type { Save } from './storage';
import { MODES } from './modes';
import { KITES, drawKite } from './render';

// DOM screens on top of the canvas.

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;

export const el = {
  title: $('title'), how: $('how'), kites: $('kites'), intro: $('intro'), online: $('online'), wait: $('wait'), ladder: $('ladder'), versus: $('versus'), pause: $('pause'), end: $('end'),
  ladderList: $('ladderList'), vsFace: $('vsFace'), vsName: $('vsName'), vsTag: $('vsTag'),
  modes: $('modes'), modeBlurb: $('modeBlurb'),
  kitesTitle: $('kitesTitle'), k1Label: $('k1Label'), k2Label: $('k2Label'), kiteRow1: $('kiteRow1'), kiteRow2: $('kiteRow2'),
  kitesBack: $('kitesBack'), kitesNext: $('kitesNext'), twoBtn: $('twoBtn'), watchBtn: $('watchBtn'),
  introSkip: $('introSkip'), introGo: $('introGo'),
  onlineBtn: $('onlineBtn'), nameIn: $<HTMLInputElement>('nameIn'), hostBtn: $('hostBtn'), codeIn: $<HTMLInputElement>('codeIn'), joinBtn: $('joinBtn'),
  lobbyList: $('lobbyList'), onlineNote: $('onlineNote'), onlineBack: $('onlineBack'),
  waitTitle: $('waitTitle'), waitCode: $('waitCode'), waitMsg: $('waitMsg'), shareBtn: $('shareBtn'), waitCancel: $('waitCancel'),
  fightLabel: $('fightBtn'),
  endTitle: $('endTitle'), endSub: $('endSub'), nextBtn: $<HTMLButtonElement>('nextBtn'),
  playBtn: $('playBtn'), howBtn: $('howBtn'), howClose: $('howClose'), ladderBack: $('ladderBack'),
  fightBtn: $('fightBtn'), vsBack: $('vsBack'), pauseBtn: $('pauseBtn'), resumeBtn: $('resumeBtn'), quitBtn: $('quitBtn'),
  rematchBtn: $('rematchBtn'), endLadderBtn: $('endLadderBtn'),
  endTrophy: $('endTrophy'), trophies: $('trophies'), trophyList: $('trophyList'), trophyBtn: $('trophyBtn'), trophyBack: $('trophyBack'),
  quickBtn: $('quickBtn'),
  soundBtns: Array.from(document.querySelectorAll<HTMLElement>('.sound-btn')),
  musicBtns: Array.from(document.querySelectorAll<HTMLElement>('.music-btn')),
};

const screens = [el.title, el.how, el.kites, el.ladder, el.versus, el.pause, el.end, el.intro, el.online, el.wait, el.trophies];

/** Show one screen (or none) and hide the rest. */
export function only(screen: HTMLElement | null) { for (const s of screens) s.classList.toggle('hidden', s !== screen); }
export function show(e: HTMLElement, on = true) { e.classList.toggle('hidden', !on); }
export function setSoundLabel(on: boolean) { for (const b of el.soundBtns) b.textContent = `Sound: ${on ? 'on' : 'off'}`; }
export function setMusicLabel(on: boolean) { for (const b of el.musicBtns) b.textContent = `Music: ${on ? 'on' : 'off'}`; }

export const unlocked = (data: Save, i: number) => i === 0 || !!data.beaten[OPPONENTS[i].id] || !!data.beaten[OPPONENTS[i - 1].id];

export function buildModes(current: number, pick: (cuts: number) => void) {
  el.modes.innerHTML = '';
  for (const m of MODES) {
    const b = document.createElement('button');
    b.className = m.cuts === current ? 'on' : '';
    b.innerHTML = `<b>${m.emoji}</b><span>${m.name}</span><small>${m.cuts} cut${m.cuts > 1 ? 's' : ''}</small>`;
    b.onclick = () => pick(m.cuts);
    el.modes.appendChild(b);
  }
  el.modeBlurb.textContent = (MODES.find((m) => m.cuts === current) ?? MODES[2]).blurb;
}

/** A little drawing of a kite with its tail. */
export function kiteCanvas(look: KiteLook) {
  const cv = document.createElement('canvas'), dpr = Math.min(2, window.devicePixelRatio || 1);
  cv.width = 56 * dpr; cv.height = 64 * dpr;
  const c = cv.getContext('2d')!;
  c.setTransform(dpr * 0.85, 0, 0, dpr * 0.85, 28 * dpr, 30 * dpr);
  c.rotate(0.25);
  c.strokeStyle = 'rgba(70,70,90,0.6)'; c.lineWidth = 1.2;
  c.beginPath(); c.moveTo(0, 28); c.quadraticCurveTo(-10, 40, -4, 52); c.stroke();
  look.tail.forEach((col, j) => { c.fillStyle = col; c.beginPath(); c.arc(-4 - Math.sin(j) * 5, 34 + j * 7, 2.6, 0, 7); c.fill(); });
  drawKite(c, look);
  return cv;
}

export const kiteOpen = (data: Save, i: number) => { const u = KITES[i]?.unlock; return !u || !!data.beaten[u]; };

/** A row of kite buttons, each with a little drawing of the kite. Ladder kites stay locked until won. */
export function buildKites(row: HTMLElement, data: Save, current: number, pick: (i: number) => void) {
  row.innerHTML = '';
  KITES.forEach((k, i) => {
    const b = document.createElement('button'), open = kiteOpen(data, i);
    b.className = i === current ? 'on' : '';
    const name = document.createElement('span');
    if (open) name.textContent = k.name;
    else { b.disabled = true; b.classList.add('locked'); name.textContent = `🔒 Beat ${OPPONENTS.find((o) => o.id === k.unlock)?.name ?? '?'}`; }
    b.append(kiteCanvas(k), name);
    b.onclick = () => pick(i);
    row.appendChild(b);
  });
}

/** The trophy cabinet: every rival kite you've won. */
export function buildTrophies(data: Save) {
  el.trophyList.innerHTML = '';
  if (!data.trophies.length) {
    const p = document.createElement('p'); p.className = 'tip';
    p.textContent = "No trophies yet. Beat someone and you keep their kite!";
    el.trophyList.appendChild(p); return;
  }
  for (const t of [...data.trophies].reverse()) {
    const d = document.createElement('div'); d.className = 'trophy';
    const nm = document.createElement('span'); nm.textContent = t.name;
    const n = document.createElement('small'); n.textContent = t.n > 1 ? `won ×${t.n}` : 'won once';
    d.append(kiteCanvas(t.look), nm, n);
    el.trophyList.appendChild(d);
  }
}

export function buildLadder(data: Save, pick: (i: number) => void) {
  el.ladderList.innerHTML = '';
  OPPONENTS.forEach((o, i) => {
    const b = document.createElement('button');
    const open = unlocked(data, i), beat = !!data.beaten[o.id];
    b.disabled = !open;
    if (beat) b.classList.add('beaten');
    b.innerHTML = `<span class="face">${open ? o.emoji : '🔒'}</span><span class="nm">${o.name}</span><span class="st">${beat ? '★ Beaten' : open ? `Level ${i + 1}` : 'Beat the one before'}</span>`;
    b.onclick = () => pick(i);
    el.ladderList.appendChild(b);
  });
}
