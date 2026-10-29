// Headless balance check: npm run sim
// Every opponent fights every other one (and a random button-masher) many times.
import { Fight, rng } from '../src/physics';
import { AI } from '../src/ai';
import { OPPONENTS, type Brain } from '../src/opponents';

const MASHER: Brain = { think: 0.25, tol: 9, holdMax: 0.4, mistakes: 2, care: 0, reach: 0, ram: 0 };

function match(b0: Brain, b1: Brain, seed: number) {
  const f = new Fight(seed);
  const r = rng(seed * 7 + 1);
  const ai = [new AI(b0, 0, r), new AI(b1, 1, r)];
  let rounds = 0, roundTime = 0;
  f.events.length = 0;
  while (f.phase !== 'over' && f.t < 400) {
    f.step([ai[0].decide(f), ai[1].decide(f)]);
    for (const e of f.events) if (e.kind === 'cut') { rounds++; roundTime += f.roundT; }
    f.events.length = 0;
  }
  return { winner: f.winner, rounds, roundTime };
}

const N = Number(process.env.N) || 20;
const all = [{ name: 'Masher', brain: MASHER }, ...OPPONENTS.map((o) => ({ name: o.name, brain: o.brain }))];
let rt = 0, rc = 0;
console.log('Row player win % against column (playing on the left side)');
console.log(''.padEnd(16) + all.map((a) => a.name.split(' ').pop()!.slice(0, 7).padStart(8)).join(''));
for (const p of all) {
  let line = p.name.padEnd(16);
  for (const q of all) {
    let w = 0;
    for (let s = 1; s <= N; s++) {
      const m = match(p.brain, q.brain, s);
      if (m.winner === 0) w++;
      rt += m.roundTime; rc += m.rounds;
    }
    line += `${Math.round((w / N) * 100)}%`.padStart(8);
  }
  console.log(line);
}
console.log(`average round: ${(rt / rc).toFixed(1)}s`);
