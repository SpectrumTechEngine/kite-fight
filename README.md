# Kite Fight

A fast one-touch kite-fighting duel. **Let go** and your kite spins on the spot; **hold** (mouse, touch or Space) and it dashes where its nose points. Dash your kite through the other kite's string to put a notch in it; loop round and do it again. Only the brighter part of the string, near the kite, can be notched. Three notches cut the string. There is no time limit, and touching the grass just bounces you back up. First to cut the other kite twice wins.

Before each match you choose how many passes it takes to cut a string: One Snip Wonder (1), Double Trouble (2), Triple Threat (3), High Five Frenzy (5) or Seven Skies Showdown (7). These live in `src/modes.ts`.

When the game opens, a slow-motion "How to win" reel shows a kite looping through the other kite's string three times (`src/intro.ts`; replay it from How to play, or skip it with `?nointro`). Pick from 6 kites before a match (looks only; they all fly the same). Play **1 Player** against the computer, or **2 Players** on one screen: the left half of the screen (or A / Space) flies the left kite, the right half (or L / Enter) flies the right kite. Or play **Online**: open a challenge and send the 4-number code (or the link `?duel=1234`), or accept one from the lobby. Online uses the same room system as Archer Duel: Chop the Check's Firebase Realtime Database, under `rooms/kite-fight-*` (`src/net.ts`). The challenger's phone runs the match and sends snapshots about 15 times a second (`src/sync.ts`); the other phone sends hold/let-go.

Five computer opponents in a ladder (beat one to unlock the next): Little Niamh, Grandad Joe, Uncle Ravi, Captain Gale, The Sky Queen.

## Run it locally

```
npm install
npm run dev
```

- `?vs=3` jumps straight into a match with opponent 3 (1 to 5).
- `?debug` shows hitboxes and live numbers.
- `npm run sim` makes every opponent fight every other one (plus a random button-masher) and prints win rates. Run it after changing physics or opponents to check the ladder still gets harder.
- `npm run build` makes the `dist/` folder for the website.

## Code layout

| File | Job |
|---|---|
| `src/physics.ts` | Kites, strings, pass-through notches, pickups, wind, rounds. Tuning numbers are in `A` at the top. |
| `src/ai.ts` | The computer flyer's brain (same physics as you). |
| `src/opponents.ts` | The opponent ladder: name, kite colours and brain settings. |
| `src/render.ts` | Everything on the canvas: scenery, kites, strings, sparks, health bars, banners. |
| `src/input.ts` | Hold/release from pointer and Space; P or Esc pauses. |
| `src/ui.ts` | Menus (HTML on top of the canvas). |
| `src/storage.ts` | Who you've beaten, plus settings, in localStorage. |
| `src/audio.ts` | Gladiator battle music and all sound effects, made in code with Web Audio (both on by default; they start after the first tap). |
| `src/main.ts` | Game loop and screen flow. |

## Adding an opponent

Add an entry to `OPPONENTS` in `src/opponents.ts`. Brain settings: `think` (seconds between decisions, lower = faster), `tol` (how precisely it lines up a dash), `holdMax` (longest dash), `mistakes` (wrong moves per second), `care` (height it tries to stay above: higher = more timid), `reach` (how far past your string it aims). Then run `npm run sim` to see where it lands in the ladder.

The earlier calm flying version is kept in `_old-flight/` (not part of the build).
