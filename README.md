# Manifest

Manifest is a logistics dispatch and supply-chain simulation game built as a
real software-engineering learning project. The player makes operational
choices, sees their consequences, and learns to improve both the plan and the
software that represents it.

The first playable slice covers one simulated operating day: two trucks deliver
four loads among three locations. It is intentionally small enough to explain,
test, replay, and review end to end.

The deterministic engine and application facade are implemented and verified.
ADR-0004 selects a framework-free browser interface using standards-based DOM
APIs, with Vite as development and build tooling. The browser adapter is the
next bounded slice; there is still no backend, persistence service, account
system, or server-owned game state.

## Project foundations

- [Product charter](docs/PRODUCT-CHARTER.md): player promise, scope, non-goals,
  and success criteria.
- [Domain model](docs/DOMAIN.md): shared terminology and simulation invariants.
- [Architecture](docs/ARCHITECTURE.md): framework-neutral boundaries and
  dependency direction.
- [Architecture decisions](docs/adr/README.md): adopted ADRs and the decision
  template.
- [M1 vertical slice](docs/milestones/M1-vertical-slice.md): the first playable
  milestone contract.

## Working here

Manifest is a Foreman target. Claude and Codex plan and route work through
Foreman, eligible bounded implementation runs on the local junior, and Ronnie
alone merges `main`. See `AGENTS.md` or `CLAUDE.md` before changing the repo.

Run all repository checks from the root:

```sh
make verify
```

Install the Chromium build pinned to the Playwright dependency before running
the real-browser checks on a new workstation or CI image:

```sh
npx playwright install chromium
```

Once the browser adapter implementation lands, start the local player surface
with:

```sh
npm run dev
```

The root verification command remains the stable gate. It type-checks and
tests the headless engine, builds the static browser artifact, and exercises
the clickable loop in a real headless browser.
