import { A, Fight, rng, type FEvent } from './physics';
import { AI } from './ai';
import { OPPONENTS } from './opponents';
import { Renderer, KITES } from './render';
import { Input } from './input';
import { load, save } from './storage';
import * as audio from './audio';
import { el, only, show, setSoundLabel, setMusicLabel, buildLadder, buildModes, buildKites } from './ui';
import { modeFor } from './modes';
import { IntroScript, INTRO_SPEED } from './intro';
import { joinRoom, netNow, type Peer, type Room } from './net';
import { pack, apply, coast, type Snap } from './sync';

// ?debug shows hitboxes and numbers; ?vs=3 jumps straight into a match with opponent 3 (1-5).
const params = new URLSearchParams(location.search);

const data = load();
const canvas = document.getElementById('game') as HTMLCanvasElement;
const r = new Renderer(canvas);
r.debug = params.has('debug');
window.addEventListener('resize', () => r.resize());
const input = new Input();
setSoundLabel(data.settings.sound);
audio.setSound(data.settings.sound);
setMusicLabel(data.settings.musicOn);
audio.setMusic(data.settings.musicOn);

type Mode = 'intro' | 'menu' | 'play' | 'paused' | 'end';
let mode: Mode = 'menu';
let twoP = false;              // two players on one screen
let online = false;            // the kite picker leads to the online lobby
let me: 0 | 1 = 0;             // which kite is mine (the online guest flies the right-hand kite)
let opp = 0;
let fight: Fight;
let brains: [AI | null, AI | null];
let intro: IntroScript | null = null;
let endShown = false;
let faintPlayed = false;
let seed = Date.now() % 100000;

const kiteLook = (i: number) => KITES[i] ?? KITES[0];
/** Usage numbers for the owner (ste-owner.js on the website); never gets in the way of the game. */
type SteApi = { track?: (n: string) => void; detail?: (n: string) => void };
function ste(fn: 'track' | 'detail', name: string) { try { (window as unknown as { STE?: SteApi }).STE?.[fn]?.(name); } catch { /* not loaded */ } }
const short = (n: string) => n.split(' ').pop() ?? n;

function reset(names: [string, string]) {
  r.names = names; r.parts = []; r.pops = []; r.big = null; r.caption = ''; r.highlight = false;
  endShown = false; faintPlayed = false;
}

/** Background duel between two computer kites, for the menus. */
function demo() {
  const a = OPPONENTS[2], b = OPPONENTS[3];
  fight = new Fight(++seed, 3);
  const rr = rng(seed);
  brains = [new AI(a.brain, 0, rr), new AI(b.brain, 1, rr)];
  r.looks = [a.look, b.look]; r.hud = false; r.twoP = false; intro = null;
  reset(['', '']);
}

/** The slow-motion "How to win" reel. */
function startIntro() {
  fight = new Fight(++seed, 3, 1);
  brains = [null, null];
  intro = new IntroScript();
  r.looks = [kiteLook(data.settings.kite), kiteLook(data.settings.kite2)];
  r.hud = true; r.twoP = false; r.modeName = '';
  reset(['Player 1', 'Player 2']);
  r.highlight = true;
  mode = 'intro'; show(el.pauseBtn, false); show(el.introGo, false);
  only(el.intro);
}

function startMatch(i: number) {
  twoP = false; opp = i;
  const o = OPPONENTS[i];
  fight = new Fight(++seed, data.settings.cuts);
  brains = [null, new AI(o.brain, 1, rng(seed))];
  r.looks = [kiteLook(data.settings.kite), o.look];
  begin(['You', o.name]);
}

function startTwo() {
  twoP = true;
  fight = new Fight(++seed, data.settings.cuts);
  brains = [null, null];
  r.looks = [kiteLook(data.settings.kite), kiteLook(data.settings.kite2)];
  begin(['Player 1', 'Player 2']);
}

function begin(names: [string, string]) {
  intro = null;
  r.modeName = modeFor(data.settings.cuts).name;
  r.hud = true; r.twoP = twoP;
  reset(names);
  mode = 'play';
  input.release();
  only(null); show(el.pauseBtn);
  ste('track', 'play');
  ste('detail', net ? 'online' : twoP ? 'same-screen' : `vs-${OPPONENTS[opp].id}`);
  ste('detail', `cuts-${data.settings.cuts}`);
}

function toMenu(screen: HTMLElement) {
  if (mode !== 'menu') demo();
  mode = 'menu'; show(el.pauseBtn, false);
  if (screen === el.ladder) buildLadder(data, versus);
  only(screen);
}

function kitePicker() {
  if (mode !== 'menu') demo();
  mode = 'menu';
  el.kitesTitle.textContent = twoP ? 'Choose your kites' : 'Choose your kite';
  el.k1Label.textContent = twoP ? 'Player 1 · left side' : 'Your kite';
  show(el.k2Label, twoP); show(el.kiteRow2, twoP);
  const pick1 = (i: number) => { data.settings.kite = i; save(data); buildKites(el.kiteRow1, i, pick1); };
  const pick2 = (i: number) => { data.settings.kite2 = i; save(data); buildKites(el.kiteRow2, i, pick2); };
  buildKites(el.kiteRow1, data.settings.kite, pick1);
  if (twoP) buildKites(el.kiteRow2, data.settings.kite2, pick2);
  only(el.kites);
}

function showModes() {
  const pick = (cuts: number) => { data.settings.cuts = cuts; save(data); buildModes(cuts, pick); audio.select(cuts); };
  buildModes(data.settings.cuts, pick);
}

function versus(i: number) {
  el.fightLabel.textContent = 'Fight!';
  const o = OPPONENTS[i];
  opp = i;
  el.vsFace.textContent = o.emoji; el.vsName.textContent = `You vs ${o.name}`; el.vsTag.textContent = o.tagline;
  showModes();
  only(el.versus);
}

function versusOnline() {
  el.vsFace.textContent = '🌍'; el.vsName.textContent = 'Online challenge';
  el.vsTag.textContent = 'Choose the battle, then send your friend the code.';
  el.fightLabel.textContent = 'Open challenge';
  showModes();
  only(el.versus);
}

function versusTwo() {
  el.fightLabel.textContent = 'Fight!';
  el.vsFace.textContent = '🧑‍🤝‍🧑'; el.vsName.textContent = 'Player 1 vs Player 2';
  el.vsTag.textContent = 'Hold the left half of the screen (or A) for the left kite, the right half (or L) for the right kite.';
  showModes();
  only(el.versus);
}

function pause() { if (mode !== 'play') return; mode = 'paused'; input.release(); only(el.pause); }
// (online, pausing only opens the menu: the duel carries on for the other player)
function resume() { if (mode !== 'paused') return; mode = 'play'; input.release(); only(null); }

input.onPress = () => audio.unlock();
// Every menu button gets a tap sound (match-type buttons have their own)
document.addEventListener('click', (e) => {
  const b = (e.target as HTMLElement).closest('button');
  if (!b) return;
  audio.unlock();
  if (!b.closest('#modes')) audio.click();
});
input.onPause = () => (mode === 'paused' ? resume() : pause());
document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });

el.playBtn.onclick = () => { twoP = false; online = false; kitePicker(); };
el.twoBtn.onclick = () => { twoP = true; online = false; kitePicker(); };
el.onlineBtn.onclick = () => { twoP = false; online = true; kitePicker(); };
el.kitesBack.onclick = () => only(el.title);
el.kitesNext.onclick = () => (twoP ? versusTwo() : online ? openLobby() : toMenu(el.ladder));
el.howBtn.onclick = () => only(el.how);
el.howClose.onclick = () => only(el.title);
el.watchBtn.onclick = startIntro;
el.introSkip.onclick = el.introGo.onclick = () => toMenu(el.title);
el.ladderBack.onclick = () => kitePicker();
el.fightBtn.onclick = () => (twoP ? startTwo() : online ? hostDuel() : startMatch(opp));
el.vsBack.onclick = () => (twoP ? kitePicker() : online ? openLobby() : toMenu(el.ladder));
el.pauseBtn.onclick = pause;
el.resumeBtn.onclick = resume;
el.quitBtn.onclick = () => { if (net) { netLeave(); openLobby(); } else toMenu(twoP ? el.title : el.ladder); };
el.rematchBtn.onclick = () => (net ? netRematch() : twoP ? startTwo() : startMatch(opp));
el.endLadderBtn.onclick = () => { if (net) { netLeave(); openLobby(); } else toMenu(twoP ? el.title : el.ladder); };
el.nextBtn.onclick = () => { if (opp + 1 < OPPONENTS.length) { toMenu(el.ladder); versus(opp + 1); } };
for (const b of el.musicBtns) b.onclick = () => {
  data.settings.musicOn = !data.settings.musicOn; save(data);
  audio.setMusic(data.settings.musicOn); setMusicLabel(data.settings.musicOn);
};
for (const b of el.soundBtns) b.onclick = () => {
  data.settings.sound = !data.settings.sound; save(data);
  audio.setSound(data.settings.sound); setSoundLabel(data.settings.sound);
};

// ---------------- online duels ----------------

interface Net {
  role: 'host' | 'guest'; room: Room; code: string; other: string; peers: Peer[];
  playing: boolean; snapId: number; cuts: number;
  evSeq: number; evOut: [number, FEvent][]; lastEv: number; lastSnap: unknown;
  pubAt: number; joinAt: number; goneAt: number; seenHost: boolean;
  guestHold: boolean; inRe: number; myRe: number; lastHold: boolean;
  unsub: () => void;
}
let net: Net | null = null;
let lobby: Room | null = null;
let lobbyStarting: Promise<void> | null = null;
let netBusy = false;           // stops a double tap from joining or hosting twice
const CHALLENGE_LIFE = 10 * 60 * 1000;
const myName = () => (data.settings.name || '').trim().slice(0, 14) || 'A kite flyer';
const note = (t: string) => { el.onlineNote.textContent = t; };

el.nameIn.value = data.settings.name;
el.nameIn.oninput = () => { data.settings.name = el.nameIn.value.slice(0, 14); save(data); };
el.codeIn.oninput = () => { el.codeIn.value = el.codeIn.value.replace(/\D/g, '').slice(0, 4); };
el.hostBtn.onclick = () => { if (!lobby) return note('Still connecting… try again in a moment.'); versusOnline(); };
el.joinBtn.onclick = () => joinDuel(el.codeIn.value);
el.onlineBack.onclick = () => { netLeave(); toMenu(el.title); };
el.waitCancel.onclick = () => { netLeave(); openLobby(); };
el.shareBtn.onclick = () => {
  if (!net) return;
  const url = `${location.origin}${location.pathname}?duel=${net.code}`;
  const text = `🪁 ${myName()} challenges you to Kite Fight! Code ${net.code}:\n${url}`;
  if (navigator.share) { navigator.share({ text }).catch(() => {}); return; }
  const wa = 'https://wa.me/?text=' + encodeURIComponent(text);
  if (!window.open(wa, '_blank')) location.href = wa;
};

function openLobby() {
  if (mode !== 'menu') demo();
  mode = 'menu'; online = true; show(el.pauseBtn, false);
  only(el.online);
  renderLobby(lobby ? lobby.peers() : []);
  netInit();
}

function netInit(): Promise<void> {
  if (lobby) return Promise.resolve();
  if (lobbyStarting) return lobbyStarting;
  note('Connecting to the sky…');
  lobbyStarting = (async () => {
    try {
      lobby = await joinRoom('lobby');
      lobby.onPeers(renderLobby, () => { lobby = null; note('The connection was lost. Go back and choose Online again.'); });
      note('Open a challenge and send your friend the code, or accept one below.');
    } catch (e) {
      console.warn(e); lobby = null;
      note('Could not connect. Check your internet, then choose Online again.');
    } finally { lobbyStarting = null; }
  })();
  return lobbyStarting;
}

function renderLobby(peers: Peer[]) {
  const list = el.lobbyList; list.textContent = '';
  if (!lobby) return;
  const open = peers.filter((q) => !q.isMe && /^\d{4}$/.test(String(q.presence.open)) && netNow() - (Number(q.presence.at) || q.since) < CHALLENGE_LIFE);
  for (const q of open.slice(0, 4)) {
    const row = document.createElement('div'); row.className = 'chal';
    const left = document.createElement('div');
    left.textContent = `${String(q.presence.nm || 'A kite flyer').slice(0, 14)} wants a fight`;
    const sm = document.createElement('small'); sm.textContent = `${modeFor(Number(q.presence.cuts) || 3).name} · code ${q.presence.open}`;
    left.appendChild(sm);
    const b = document.createElement('button'); b.className = 'big'; b.textContent = 'Accept';
    b.onclick = () => joinDuel(String(q.presence.open));
    row.append(left, b); list.appendChild(row);
  }
}
setInterval(() => { if (lobby && !el.online.classList.contains('hidden')) renderLobby(lobby.peers()); }, 15000);

function showWait(title: string, code: string, msg: string, cancel = 'Cancel') {
  mode = 'menu'; show(el.pauseBtn, false);
  el.waitTitle.textContent = title; el.waitCode.textContent = code; el.waitMsg.textContent = msg; el.waitCancel.textContent = cancel;
  show(el.shareBtn, net?.role === 'host' && !!code);
  only(el.wait);
}

function newNet(role: 'host' | 'guest', room: Room, code: string): Net {
  return { role, room, code, other: '', peers: room.peers(), playing: false, snapId: 0, cuts: data.settings.cuts,
    evSeq: 0, evOut: [], lastEv: 0, lastSnap: null, pubAt: 0, joinAt: performance.now(), goneAt: 0, seenHost: false,
    guestHold: false, inRe: 0, myRe: 0, lastHold: false, unsub: () => {} };
}

async function hostDuel() {
  if (net || netBusy) return;
  await netInit();
  if (!lobby) return openLobby();
  const code = String(Math.floor(1000 + Math.random() * 9000));
  let room: Room;
  netBusy = true;
  try { room = await joinRoom(code); } catch { openLobby(); return note('The challenge could not be opened. Try again in a moment.'); } finally { netBusy = false; }
  net = newNet('host', room, code);
  room.presence({ role: 'host', nm: myName(), k: data.settings.kite, guest: null }).catch(() => {});
  lobby.presence({ open: code, at: netNow(), nm: myName(), cuts: data.settings.cuts }).catch(() => {});
  net.unsub = room.onPeers((p) => { if (net) { net.peers = p; hostPeers(); } }, () => netLost('The connection to the duel was lost.'));
  showWait('Waiting for a challenger', code, 'Send your friend the code, or they can tap Online and accept your challenge.');
}

function hostPeers() {
  if (!net || net.role !== 'host') return;
  const g = net.other && net.peers.find((q) => q.peer === net!.other);
  if (net.other && !g) return netLost(`${r.names[1]} left the duel.`);
  if (!net.other) {
    const c = net.peers.find((q) => !q.isMe && q.presence.role === 'challenger');
    if (!c) return;
    net.other = c.peer;
    net.room.presence({ guest: c.peer }).catch(() => {});
    lobby?.presence({ open: null, at: null }).catch(() => {});
    hostStart(c.presence);
  }
}

function hostStart(guest: { nm?: string; k?: number }) {
  if (!net) return;
  me = 0;
  net.snapId = ++seed;
  fight = new Fight(net.snapId, net.cuts);
  brains = [null, null];
  r.looks = [kiteLook(data.settings.kite), kiteLook(Number(guest.k) || 0)];
  net.playing = true; net.evOut = [];
  begin(['You', String(guest.nm || 'A kite flyer').slice(0, 14)]);
}

async function joinDuel(code: string) {
  code = String(code || '').replace(/\D/g, '').slice(0, 4);
  if (code.length !== 4) return note('A challenge code has four numbers.');
  if (net || netBusy) return;
  await netInit();
  if (!lobby) return;
  let room: Room;
  netBusy = true;
  try { room = await joinRoom(code); } catch { return note('That duel could not be joined. Check the code and try again.'); } finally { netBusy = false; }
  net = newNet('guest', room, code);
  room.presence({ role: 'challenger', nm: myName(), k: data.settings.kite, in: { h: 0, re: 0 } }).catch(() => {});
  net.unsub = room.onPeers((p) => { if (net) net.peers = p; }, () => netLost('The connection to the duel was lost.'));
  showWait('Joining the duel', code, 'Looking for the challenger who opened this duel…');
}

function netFrame() {
  if (!net) return;
  const now = performance.now();
  if (net.role === 'host') {
    const g = net.peers.find((q) => q.peer === net!.other), inp = g?.presence?.in;
    net.guestHold = mode !== 'end' && !!(inp && inp.h);
    if (inp && Number(inp.re) > net.inRe) { net.inRe = Number(inp.re); if (mode === 'end') netRematch(); }
    if (net.playing && now - net.pubAt > 66) {
      net.pubAt = now;
      net.room.presence({ s: pack(fight, net.snapId, net.evOut.slice(-15), [data.settings.kite, Number(g?.presence?.k) || 0], [myName(), r.names[1]]) }).catch(() => {});
    }
    return;
  }
  // guest
  const host = net.peers.find((q) => q.presence && q.presence.role === 'host');
  if (!host) {
    if (!net.seenHost && now - net.joinAt > 7000) return netLost('No duel was found with that code.');
    if (net.seenHost) { if (!net.goneAt) net.goneAt = now; else if (now - net.goneAt > 2500) return netLost(`${r.names[0]} left the duel.`); }
    return;
  }
  net.seenHost = true; net.goneAt = 0;
  if (host.presence.guest && host.presence.guest !== net.room.me) return netLost('That duel already has two players.');
  const s = host.presence.s as Snap | undefined;
  if (host.presence.guest === net.room.me && s && typeof s === 'object' && s !== net.lastSnap) {
    net.lastSnap = s;
    if (s.id !== net.snapId) {             // a new match (first one or a rematch)
      net.snapId = s.id; me = 1;
      fight = new Fight(s.id, s.n);
      brains = [null, null];
      r.looks = [kiteLook(s.lk[0]), kiteLook(s.lk[1])];
      net.playing = true; net.lastEv = Math.max(0, ...s.e.map((x) => x[0]));
      begin([String(s.nm[0]).slice(0, 14), 'You']);
    }
    apply(fight, s);
    for (const [seq, ev] of s.e) if (seq > net.lastEv) { fight.events.push(ev); net.lastEv = seq; }
  }
  const h = mode === 'play' && input.held;
  if (h !== net.lastHold || now - net.pubAt > 150) {
    net.lastHold = h; net.pubAt = now;
    net.room.presence({ in: { h: h ? 1 : 0, re: net.myRe } }).catch(() => {});
  }
}

function netRematch() {
  if (!net) return;
  if (net.role === 'guest') { net.myRe++; el.endSub.textContent = 'Asked for a rematch… waiting for the other player.'; net.pubAt = 0; return; }
  const g = net.peers.find((q) => q.peer === net!.other);
  hostStart(g?.presence || {});
}

function netLeave() {
  if (net) { try { net.unsub(); } catch { /* ignore */ } net.room.leave().catch(() => {}); }
  lobby?.presence({ open: null, at: null }).catch(() => {});
  net = null; me = 0;
}

function netLost(msg: string) {
  netLeave(); demo();
  showWait('Duel over', '', msg, 'Back');
}

demo();
const vs = Number(params.get('vs'));
if (vs >= 1 && vs <= OPPONENTS.length) startMatch(vs - 1);
else if (/^\d{4}$/.test(params.get('duel') || '')) { online = true; openLobby(); joinDuel(params.get('duel')!); }
else if (!params.has('nointro')) startIntro();
else only(el.title);

function handleEvents() {
  const playing = mode !== 'menu';
  // In the 1-player game, "mine" means the player's side; with two players (or the reel) both sides cheer.
  const solo = mode === 'play' || mode === 'end' ? !twoP : false;
  for (const e of fight.events) {
    if (e.kind === 'cut') {
      r.burst(e.at, ['#ffffff', '#ffd166', '#ff8fab'], 40, 320, 200);
      if (!playing) continue;
      const winner = r.names[1 - e.loser], mine = e.loser !== me;
      r.shake = 16; audio.cut(solo ? mine : true);
      if (solo) r.banner(mine ? 'CUT!' : 'CUT DOWN!', mine ? 'Round to you!' : `${winner} takes the round`, mine ? '#ffd166' : '#ff8a8a');
      else r.banner('CUT!', intro ? '' : `${winner} takes the round`, '#ffd166');
    }
    if (!playing) continue;
    if (e.kind === 'count') { if (!intro) { r.banner(String(e.n)); audio.count(e.n); } }
    else if (e.kind === 'fight') { if (!intro) { r.banner('FIGHT!', '', '#ffd166'); audio.fight(); } }
    else if (e.kind === 'hit') {
      const mine = solo ? e.by === me : true, left = e.left;
      r.shake = 6; r.burst(e.at, ['#fff3b0', '#ffb703', '#ffffff'], e.double ? 30 : 18, 260, 300);
      const word = e.double ? 'DOUBLE SNIP!' : mine ? 'SNIP!' : 'OUCH!';
      if (left > 0) r.pop(`${solo ? '' : short(r.names[e.by]) + ': '}${word} ${left} left`, e.at, mine ? '#ffe08a' : '#ff8a8a');
      audio.snip(mine, e.double);
      if ((!solo || !mine) && left === 1 && !intro) setTimeout(audio.danger, 350);
    }
    else if (e.kind === 'scrape') { const k = fight.kites[e.who]; r.shake = 3; audio.bounce(); r.burst(k, ['#7a5c3a', '#8acb6d'], 10, 140, 400); }
    else if (e.kind === 'pickup') { const info = r.pickupLabel(e.type); r.burst(e.at, [info.color, '#ffffff'], 26, 240, 100); r.pop(solo && e.who === me ? info.label : `${short(r.names[e.who])}: ${info.label.toLowerCase()}`, e.at, info.color); audio.pickup(e.type); }
    else if (e.kind === 'bump') { r.burst(e.at, ['#ffffff'], 6, 120, 0); audio.knock(); }
  }
  fight.events.length = 0;
}

function showEnd() {
  endShown = true; mode = 'end'; show(el.pauseBtn, false);
  const score = `${fight.score[0]} – ${fight.score[1]}`;
  if (net) {
    const won = fight.winner === me, other = r.names[1 - me];
    if (won) audio.victory(); else audio.defeat();
    el.endTitle.textContent = won ? `You beat ${other}!` : `${other} wins`;
    el.endSub.textContent = `${fight.score[me]} – ${fight.score[1 - me]}  ·  Rematch?`;
    el.endLadderBtn.textContent = 'Leave';
    show(el.nextBtn, false);
  } else if (twoP) {
    audio.victory();
    el.endTitle.textContent = `${r.names[fight.winner === 1 ? 1 : 0]} wins!`;
    el.endSub.textContent = `${score}  ·  Rematch?`;
    el.endLadderBtn.textContent = 'Menu';
    show(el.nextBtn, false);
  } else {
    const o = OPPONENTS[opp], won = fight.winner === 0;
    if (won) audio.victory(); else audio.defeat();
    if (won && !data.beaten[o.id]) { data.beaten[o.id] = true; save(data); if (opp + 1 < OPPONENTS.length) audio.unlockChime(); }
    el.endTitle.textContent = won ? `You beat ${o.name}!` : `${o.name} wins`;
    el.endSub.textContent = score + (won ? (opp + 1 < OPPONENTS.length ? `  ·  ${OPPONENTS[opp + 1].name} is waiting` : '  ·  You are the champion of the sky!') : '  ·  Have another go!');
    el.endLadderBtn.textContent = 'Opponents';
    show(el.nextBtn, won && opp + 1 < OPPONENTS.length);
  }
  only(el.end);
}

const portrait = window.matchMedia('(orientation: portrait) and (max-width: 700px)');
let last = performance.now(), acc = 0;
const wasPulling = [false, false];

function frame(now: number) {
  let dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  if (portrait.matches && mode === 'play') pause();
  if (mode === 'paused' && !net) dt = 0;
  if (net) netFrame();
  // Slow motion just after a cut, and for the whole intro reel
  const slow = mode === 'intro' ? INTRO_SPEED : (fight.phase === 'cut' || fight.phase === 'over') && fight.phaseT < 0.7 && mode !== 'menu' ? 0.3 : 1;
  acc += dt * slow;
  while (acc >= A.step) {
    if (intro) intro.update(fight);
    const live = mode === 'play';
    if (net?.role === 'guest') {
      if (net.playing) coast(fight, [fight.kites[0].pulling, live && input.held]);
      acc -= A.step;
      continue;
    }
    const hold0 = brains[0] ? brains[0].decide(fight) : live && (twoP ? input.side(0) : input.held);
    const hold1 = brains[1] ? brains[1].decide(fight) : net ? net.guestHold : live && twoP && input.side(1);
    fight.step([hold0, hold1]);
    // Whoosh whenever a kite starts a dash
    fight.kites.forEach((k, i) => { if (k.pulling && !wasPulling[i] && fight.phase === 'fight' && mode === 'play') audio.dash(i === me || twoP); wasPulling[i] = k.pulling; });
    acc -= A.step;
  }
  if (net?.role === 'guest') {
    // guest: the coasting above makes no events, so the only ones are those the host sent
    fight.kites.forEach((k, i) => { if (k.pulling && !wasPulling[i] && fight.phase === 'fight' && mode === 'play') audio.dash(i === me); wasPulling[i] = k.pulling; });
  }
  if (net?.role === 'host') for (const e of fight.events) { net.evOut.push([++net.evSeq, e]); if (net.evOut.length > 30) net.evOut.shift(); }
  handleEvents();

  if (intro) {
    r.caption = intro.caption(fight);
    if (fight.phase === 'over' && fight.phaseT > 1) show(el.introGo, true);
    if (fight.phase === 'over' && fight.phaseT > 4.5) { fight = new Fight(++seed, 3, 1); intro = new IntroScript(); faintPlayed = false; } // play the reel again
  }
  if (mode === 'menu' && fight.phase === 'over' && fight.phaseT > 3) demo();
  if (mode === 'play' && fight.phase === 'over' && fight.phaseT > 3.4 && !endShown) showEnd();

  // Loser faints at the end of a match
  if ((mode === 'play' || mode === 'intro') && fight.phase === 'over' && fight.phaseT > 0.6 && !faintPlayed) { faintPlayed = true; audio.faint(); }

  // Music: calm on menus and the reel, battle in matches, frantic on a last notch, hushed for the finale
  const lastNotch = fight.phase === 'fight' && fight.kites.some((k) => k.health === 1);
  audio.setMusicLevel(mode === 'menu' || mode === 'paused' || mode === 'intro' ? 0 : mode === 'end' || fight.phase === 'over' ? -1 : lastNotch ? 2 : 1);

  const mk = fight.kites[me];
  audio.wind(mode === 'play' ? 0.03 + Math.min(0.12, mk.speed / 4000) : 0, mk.speed);
  r.draw(fight, dt * slow, (mode === 'play' || mode === 'intro') && fight.phase !== 'count', twoP && mode === 'play', me);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// Offline copy (only on the real website)
if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});

// localhost-only test hook
if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') (window as unknown as { __kf: unknown }).__kf = { get fight() { return fight; }, input, startMatch, startTwo, startIntro, get mode() { return mode; }, get net() { return net; }, hostDuel, joinDuel };
