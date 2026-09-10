# M1 playable acceptance

Verified 2026-09-09 on macOS with Node 22.22.2 and the pinned Chromium runner.
Scope confirmed by Ronnie: finish existing M1, play in a browser on this Mac,
preserve the old checkout, and prepare a PR without merging it.

## Delivered surface

- One fixed day, two trucks, four loads, three locations, no added domain rules.
- On-screen objective, travel durations, instructions, capacities, and load state.
- Pickup, travel, deliver, and advance through the application facade.
- Typed rejections with readable guidance; no change to state or replay history.
- Current score, completion summary, remaining loads, and explicit result review.
- Reset and deterministic accepted-command replay.
- Local-only launcher: `Play Manifest.command`, serving port 4174.

`Review result` is navigation to the current result, not a new engine command.
It doesn't advance time, forfeit loads, or prohibit delivery at minute 480.
No idle-time advance was invented: Advance without a scheduled arrival still
returns `NO_SCHEDULED_EVENT`, as required by ADR-0002.

## Runnable evidence

Run `make verify` from the repository root after installing Chromium with
`npx playwright install chromium`.

| Contract | Evidence |
| --- | --- |
| Fixed scenario, deterministic pure engine | `tests/engine-contract.test.mjs` |
| Complete route: 4 delivered at minute 150 | Engine fixture and clickable browser route |
| Capacity and location rejection | Engine and browser tests, unchanged command/event counts |
| Travel without teleportation | Arrival scheduling checks and browser transit rejection |
| Terminal delivery | Engine and repeated-delivery browser rejection |
| Day boundary | Browser reaches minute 480 through actual trips, rejects late arrival and new pickup, allows final delivery, reports 1/4 delivered |
| Replay | Complete and incomplete browser runs reproduce accepted events; engine deep equality |
| Detached projections and parsing | Browser adapter, parser, and scenario-projection contract tests |
| Identifier trust boundary | Prototype-property names return unknown-identifier rejections rather than inherited-object crashes |
| Keyboard and responsive surface | Enter/Tab tests and horizontal-bound checks at 1440, 900, and 390 pixels |
| Production build | Vite static build served for Playwright tests |

Verification passes 10 engine/application tests, 8 adapter/parser/projection
checks, and 7 real-browser tests, plus the shell documentation gates.
Screenshots are generated in `test-results/` for full and incomplete days and
all three tested widths. These generated artifacts aren't committed.

## Delivery verification

The actual launcher was executed through `/bin/bash`. Its production server
bound only to `127.0.0.1:4174`; a browser check confirmed the initial board,
route list, pickup, and reset, with no page errors or external requests.
`bash -n "Play Manifest.command"` passes and the file is executable.

A separate read-only reviewer inspected source, tests, the verification log,
and desktop, narrow, and completion screenshots. No issues found. The review
noted the narrow layout's long vertical scroll but no overlap or clipping.

Finder-to-Terminal launch couldn't be verified from agent automation. macOS
rejected Terminal scripting with a privilege violation. The documented
`/bin/bash` alternative was tested successfully. No OS permissions were changed.

## Delivery limits

This is the complete M1 slice, not a campaign. No saves, backend, hosting,
multiplayer, or real-time clock. Refreshing starts over. Replay verifies equality
rather than animating the sequence. Launch-time dependency setup may need network
access to install pinned build dependencies. Gameplay itself stays local. Only Chromium has an
automated browser acceptance suite.
