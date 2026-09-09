# Manifest

Manifest is a logistics dispatch and supply-chain simulation game.
Run two trucks, deliver four loads between three locations (Depot, North,
and South), and review your results over one operating day. No accounts,
backend, or external services. The simulation is deterministic and replayable.

## Play on this Mac

Double-click **Play Manifest.command** in Finder. It installs the pinned
build dependencies, builds the game, starts a local-only server, and opens
**http://127.0.0.1:4174** in your browser. Keep the Terminal window open while
playing. Press **Control+C** there to stop. If macOS won't open the file
from Finder, open Terminal in this folder and run:

```sh
/bin/bash "Play Manifest.command"
```

Requires **Node.js 22.12 or newer in the 22.x line** and npm. Dependency setup
needs internet access; gameplay makes no external requests. Launch diagnostics
are in `~/Library/Logs/manifest-play.log`. If port 4174 is already occupied,
stop the previous Manifest window and retry; the launcher won't silently
switch to a different address.

From a terminal, the equivalent is:

```sh
npm ci --ignore-scripts
npm run play
```

**This M1 build doesn't save progress.** Reloading or closing the page starts a
new run. No campaign, economy, generated maps, or multiplayer is included.

## How to play

Deliver all four loads by minute **480**. Your score is the number delivered,
not speed. The documented complete route finishes at minute **150**.

1. **Pickup:** select a truck and a load at its location. Cargo must fit the
   truck's capacity of two units.
2. **Travel:** choose a destination and submit. You can dispatch the other truck
   at the same minute, before advancing time.
3. **Advance to next arrival:** jump the clock to the next arrival. Time doesn't
   pass by itself, and arriving doesn't unload the truck.
4. **Deliver:** select the arriving truck and its load to complete the delivery.
   Pick up the next load and repeat.

The board shows routes and travel times, truck positions and capacity, all
loads, accepted events, and the current score. Rejected commands explain why
and never change the run. Pickup and travel aren't allowed at minute 480,
but a load already at its destination can still be delivered then.

**Review result** moves to the current score and remaining-load report without
advancing time or ending the simulation. **Replay accepted commands** verifies
that your decisions reproduce the same state and events; it isn't an animation.
**Reset day** clears the run for another attempt.

<details>
<summary>Worked route, if you want a walkthrough</summary>

| Minute | Your actions |
| ---: | --- |
| 0 | T1 pickup L1, travel North. T2 pickup L2, travel South. |
| 60 | Advance. T1 deliver L1, pickup L3, travel South. |
| 75 | Advance. T2 deliver L2, pickup L4, travel Depot. |
| 105 | Advance. T1 deliver L3. |
| 150 | Advance. T2 deliver L4. All four delivered. |

</details>

## Develop and verify

The engine and application facade are implemented, with a playable
framework-free browser interface using TypeScript and DOM APIs. Vite handles
serving and bundling. The engine runs headlessly and owns all logistics rules.
The browser renders application projections and submits commands.

```sh
npm ci --ignore-scripts
npx playwright install chromium
make verify
```

`make verify` checks the documentation contracts, type-checks the code, runs
engine, application, parser, and scenario-projection tests, builds the static
browser artifact, and runs the real-browser suite. Browser checks cover a full
winning run, incomplete day, rejection atomicity, replay, reset, keyboard
controls, and desktop/narrow layout. Test screenshots land in `test-results/`.

For development use `npm run dev`. Production assets are in `dist/browser/`.
Verification uses port 4173; the player launcher uses port 4174 so they don't
conflict. Port 4173 must be free for browser verification.

Work on a branch and open a pull request. See `AGENTS.md` or `CLAUDE.md` for
repository rules. This delivery leaves merging to Ronnie.

## Project foundations

- [Product charter](docs/PRODUCT-CHARTER.md)
- [Domain model](docs/DOMAIN.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Architecture decisions](docs/adr/README.md)
- [M1 milestone](docs/milestones/M1-vertical-slice.md)
- [M1 acceptance evidence](docs/milestones/M1-acceptance.md)
