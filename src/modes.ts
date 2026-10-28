// Match types: how many passes through a string it takes to cut it.

export interface Mode { cuts: number; name: string; blurb: string; emoji: string }

export const MODES: Mode[] = [
  { cuts: 1, name: 'One Snip Wonder', blurb: 'One clean pass and they drop. Blink and you lose!', emoji: '⚡' },
  { cuts: 2, name: 'Double Trouble', blurb: 'Two passes to cut. Quick and nasty.', emoji: '✌️' },
  { cuts: 3, name: 'Triple Threat', blurb: 'Three passes to cut. The classic duel.', emoji: '🔥' },
  { cuts: 5, name: 'High Five Frenzy', blurb: 'Five passes to cut. Long, wild battles.', emoji: '🖐️' },
  { cuts: 7, name: 'Seven Skies Showdown', blurb: 'Seven passes to cut. Only legends last.', emoji: '🌪️' },
];

export const modeFor = (cuts: number) => MODES.find((m) => m.cuts === cuts) ?? MODES[2];
