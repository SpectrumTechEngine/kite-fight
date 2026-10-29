// The opponent ladder, easiest first. Each has the same kite physics as you; only the brain differs.

export interface Brain {
  think: number;     // seconds between decisions (slower = reacts late)
  tol: number;       // how closely the nose must point at the target before dashing (radians)
  holdMax: number;   // longest dash
  mistakes: number;  // random wrong decisions per second
  care: number;      // height it tries to stay above (higher = more timid)
  reach: number;     // how far past your string it aims
  ram: number;       // how often it tries to ram your kite (0..1)
  snipe?: number;    // chance per decision of checking exactly whether a dash now would cut your string
}

export interface KiteLook { a: string; b: string; tail: string[]; shape?: 'diamond' | 'patang' | 'delta' | 'hex'; deco?: 'star' | 'stripes' | 'eye' }

export interface Opponent { id: string; name: string; emoji: string; tagline: string; look: KiteLook; brain: Brain }

export const OPPONENTS: Opponent[] = [
  {
    id: 'niamh', name: 'Little Niamh', emoji: '👧', tagline: 'Just got her first kite. Very excited.',
    look: { a: '#ff9ecd', b: '#fff1a8', tail: ['#ff9ecd', '#fff1a8', '#a0e7e5'] },
    brain: { think: 0.35, tol: 0.9, holdMax: 0.3, mistakes: 0.8, care: 150, reach: 50, ram: 0 },
  },
  {
    id: 'joe', name: 'Grandad Joe', emoji: '👴', tagline: 'Slow, steady and very sneaky.',
    look: { a: '#6b8f71', b: '#d9c5a0', tail: ['#6b8f71', '#d9c5a0', '#8c5e3c'] },
    brain: { think: 0.28, tol: 0.8, holdMax: 0.35, mistakes: 0.5, care: 130, reach: 60, ram: 0 },
  },
  {
    id: 'ravi', name: 'Uncle Ravi', emoji: '👨🏽', tagline: 'Forty years of rooftop battles.',
    look: { a: '#ff9f1c', b: '#2ec4b6', tail: ['#ff9f1c', '#2ec4b6', '#e71d36'], shape: 'patang' },
    brain: { think: 0.22, tol: 0.75, holdMax: 0.4, mistakes: 0.35, care: 110, reach: 75, ram: 0.1 },
  },
  {
    id: 'bridget', name: 'Big Bridget', emoji: '💪', tagline: 'Rams first, asks questions later.',
    look: { a: '#d62828', b: '#f77f00', tail: ['#d62828', '#f77f00', '#fcbf49'], shape: 'delta' },
    brain: { think: 0.19, tol: 0.75, holdMax: 0.5, mistakes: 0.25, care: 100, reach: 85, ram: 0.6 },
  },
  {
    id: 'gale', name: 'Captain Gale', emoji: '🧑‍✈️', tagline: 'Fast, loud, never lets go.',
    look: { a: '#1d3557', b: '#e63946', tail: ['#e63946', '#f1faee', '#457b9d'] },
    brain: { think: 0.17, tol: 0.7, holdMax: 0.6, mistakes: 0.2, care: 80, reach: 100, ram: 0.2 },
  },
  {
    id: 'sprocket', name: 'Professor Sprocket', emoji: '🧑‍🔬', tagline: 'Has calculated every angle. Twice.',
    look: { a: '#adb5bd', b: '#4361ee', tail: ['#4361ee', '#adb5bd', '#f72585'], shape: 'hex' },
    brain: { think: 0.14, tol: 0.6, holdMax: 0.6, mistakes: 0.12, care: 70, reach: 115, ram: 0.2, snipe: 0.1 },
  },
  {
    id: 'nori', name: 'Ninja Nori', emoji: '🥷', tagline: "You won't see her coming.",
    look: { a: '#22223b', b: '#4a4e69', tail: ['#22223b', '#c9184a', '#4a4e69'], shape: 'patang', deco: 'stripes' },
    brain: { think: 0.12, tol: 0.65, holdMax: 0.7, mistakes: 0.08, care: 60, reach: 125, ram: 0.35, snipe: 0.25 },
  },
  {
    id: 'queen', name: 'The Sky Queen', emoji: '👑', tagline: 'Undefeated. Mostly.',
    look: { a: '#7b2cbf', b: '#ffd60a', tail: ['#ffd60a', '#7b2cbf', '#ffffff'], deco: 'star' },
    brain: { think: 0.1, tol: 0.65, holdMax: 0.8, mistakes: 0.05, care: 50, reach: 140, ram: 0.3, snipe: 0.45 },
  },
  {
    id: 'mistral', name: 'Madame Mistral', emoji: '🌬️', tagline: 'The wind itself takes orders from her.',
    look: { a: '#48cae4', b: '#ffffff', tail: ['#90e0ef', '#ffffff', '#0077b6'], shape: 'delta' },
    brain: { think: 0.08, tol: 0.6, holdMax: 0.85, mistakes: 0.03, care: 45, reach: 150, ram: 0.4, snipe: 0.7 },
  },
  {
    id: 'storm', name: 'The Storm King', emoji: '⛈️', tagline: 'Nobody has ever cut his string. Nobody.',
    look: { a: '#10002b', b: '#ffd000', tail: ['#ffd000', '#10002b', '#7b2cbf'], shape: 'hex', deco: 'eye' },
    brain: { think: 0.05, tol: 0.55, holdMax: 0.9, mistakes: 0, care: 40, reach: 160, ram: 0.7, snipe: 1 },
  },
];
