// The opponent ladder, easiest first. Each has the same kite physics as you; only the brain differs.

export interface Brain {
  think: number;     // seconds between decisions (slower = reacts late)
  tol: number;       // how closely the nose must point at the target before dashing (radians)
  holdMax: number;   // longest dash
  mistakes: number;  // random wrong decisions per second
  care: number;      // height it tries to stay above (higher = more timid)
  reach: number;     // how far past your string it aims
}

export interface KiteLook { a: string; b: string; tail: string[]; shape?: 'diamond' | 'patang' | 'delta' | 'hex'; deco?: 'star' | 'stripes' | 'eye' }

export interface Opponent { id: string; name: string; emoji: string; tagline: string; look: KiteLook; brain: Brain }

export const OPPONENTS: Opponent[] = [
  {
    id: 'niamh', name: 'Little Niamh', emoji: '👧', tagline: 'Just got her first kite. Very excited.',
    look: { a: '#ff9ecd', b: '#fff1a8', tail: ['#ff9ecd', '#fff1a8', '#a0e7e5'] },
    brain: { think: 0.35, tol: 0.9, holdMax: 0.3, mistakes: 0.8, care: 150, reach: 50 },
  },
  {
    id: 'joe', name: 'Grandad Joe', emoji: '👴', tagline: 'Slow, steady and very sneaky.',
    look: { a: '#6b8f71', b: '#d9c5a0', tail: ['#6b8f71', '#d9c5a0', '#8c5e3c'] },
    brain: { think: 0.25, tol: 0.75, holdMax: 0.4, mistakes: 0.4, care: 120, reach: 70 },
  },
  {
    id: 'ravi', name: 'Uncle Ravi', emoji: '👨🏽', tagline: 'Forty years of rooftop battles.',
    look: { a: '#ff9f1c', b: '#2ec4b6', tail: ['#ff9f1c', '#2ec4b6', '#e71d36'] },
    brain: { think: 0.18, tol: 0.65, holdMax: 0.5, mistakes: 0.2, care: 90, reach: 100 },
  },
  {
    id: 'gale', name: 'Captain Gale', emoji: '🧑‍✈️', tagline: 'Fast, loud, never lets go.',
    look: { a: '#1d3557', b: '#e63946', tail: ['#e63946', '#f1faee', '#457b9d'] },
    brain: { think: 0.12, tol: 0.7, holdMax: 0.7, mistakes: 0.1, care: 60, reach: 130 },
  },
  {
    id: 'queen', name: 'The Sky Queen', emoji: '👑', tagline: 'Undefeated. Mostly.',
    look: { a: '#7b2cbf', b: '#ffd60a', tail: ['#ffd60a', '#7b2cbf', '#ffffff'] },
    brain: { think: 0.1, tol: 0.7, holdMax: 0.8, mistakes: 0.05, care: 40, reach: 150 },
  },
];
