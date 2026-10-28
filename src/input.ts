// Hold to dash. One player: hold anywhere, or Space.
// Two players on one screen: the left half (or A / Space) is the left kite, the right half (or L / Enter) is the right kite.

export class Input {
  private pointers = new Map<number, number>();   // pointer id -> x where it went down
  private keys = new Set<string>();
  /** Called on every fresh press (used to unlock audio). */
  onPress: () => void = () => {};
  onPause: () => void = () => {};

  constructor() {
    const isUi = (e: Event) => (e.target as HTMLElement | null)?.closest?.('button, input') != null;
    window.addEventListener('pointerdown', (e) => {
      if (isUi(e)) return;
      e.preventDefault();
      this.pointers.set(e.pointerId, e.clientX);
      this.onPress();
    }, { passive: false });
    const up = (e: PointerEvent) => { this.pointers.delete(e.pointerId); };
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
    window.addEventListener('keydown', (e) => {
      if ((e.target as HTMLElement | null)?.closest?.('input')) return;   // typing a name or code
      if (['Space', 'KeyA', 'KeyL', 'Enter'].includes(e.code)) {
        e.preventDefault();
        if (!e.repeat) { this.keys.add(e.code); this.onPress(); }
      } else if (e.code === 'KeyP' || e.code === 'Escape') this.onPause();
    });
    window.addEventListener('keyup', (e) => { this.keys.delete(e.code); });
    window.addEventListener('blur', () => this.release());
    window.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  /** One player: anything held counts. */
  get held() { return this.pointers.size > 0 || this.keys.size > 0; }

  /** Two players: is this side's player holding? */
  side(s: 0 | 1) {
    const half = window.innerWidth / 2;
    for (const x of this.pointers.values()) if ((x < half) === (s === 0)) return true;
    return s === 0 ? this.keys.has('KeyA') || this.keys.has('Space') : this.keys.has('KeyL') || this.keys.has('Enter');
  }

  release() { this.pointers.clear(); this.keys.clear(); }
}
