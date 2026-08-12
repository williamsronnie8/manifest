# ADR-0004: Local browser interface and adapter boundary

Date: 2026-08-12
Status: Accepted

## Context

ADR-0001 made the simulation headless and deterministic. ADR-0002 fixed the M1
scenario and rejection semantics. ADR-0003 selected strict TypeScript and the
dependency direction from adapters through the application facade to the
engine. The engine and application contracts now run the complete M1 day and
replay it, but a player still has no interface.

The next slice must expose the full player loop without moving domain truth
into a renderer. It must show the scenario, accept the four command types,
make typed rejections visible, preserve the accepted event history, and replay
the accepted decisions. It also needs enough build and browser evidence to be
reviewable. It does not need a general front-end architecture.

The relevant implementation evidence is:

- TypeScript ships browser DOM declarations and supports typed access to
  standards-based DOM APIs without a component framework.
- Vite officially supports a vanilla TypeScript project. Its development
  server handles native modules and its production build emits static assets.
- Vite transpiles TypeScript but does not type-check it, so the existing
  TypeScript compiler must remain a separate verification gate.
- Browser modules loaded directly from `file://` encounter module security
  restrictions. A development server and a static production build avoid that
  local execution trap.

Sources: [Vite getting started](https://vite.dev/guide/),
[Vite TypeScript behavior](https://vite.dev/guide/features.html#typescript),
[TypeScript DOM manipulation](https://www.typescriptlang.org/docs/handbook/dom-manipulation.html),
and [MDN JavaScript modules](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Modules).

## Decision

### Player surface

M1 uses a local, single-page browser interface. It is desktop-first and remains
usable at narrower widths. It targets a current evergreen browser and emits a
static browser artifact. M1 has no backend, network service, account,
persistence, analytics, router, or server-owned game state.

The page exposes this complete loop:

1. the objective, operating-day limit, locations, and travel durations;
2. both trucks with position, capacity, and carried loads;
3. all loads with origin, destination, size, and status;
4. pickup, travel, deliver, and advance controls;
5. current simulation minute and chronological accepted events;
6. the latest typed domain rejection or adapter-input error;
7. the current delivered and undelivered result;
8. reset to a fresh session; and
9. replay of the accepted commands that produced the current session.

Actions use semantic HTML controls, visible text labels, keyboard operation,
and visible status feedback. Responsive behavior may reflow the same
information, but it does not create a second player flow.

### Browser technology

The interface uses framework-free TypeScript and direct standards-based DOM
APIs. M1 adds no component framework, virtual DOM, state store, router, canvas
engine, or design-system dependency.

Vite is the browser development server and production bundler. It buys reliable
module serving, TypeScript transpilation for the browser, and a deterministic
static production build. It is build tooling, not the application framework.
The implementation ticket pins an exact supported Vite release in the npm
lockfile. If that release requires a higher Node 22 patch than the current
package floor, the same ticket raises the floor to the documented minimum.
Vite upgrades and a later supported Node LTS floor are ordinary toolchain
maintenance if verification stays green.

`tsc` remains the type checker because Vite transpiles TypeScript but does not
type-check it. Root verification must run the compiler, engine and adapter
contracts, the production build, and the browser evidence selected below.

### Adapter dependency boundary

Browser code lives in `src/adapters/browser/`. The browser adapter imports only
the public application facade from `src/application/index.js`; it must not import engine internals.
Browser globals and DOM values stop at this adapter.

The application facade must expose a detached scenario projection sufficient
to render the M1 objective and constraints, including the day limit, locations,
travel durations, initial truck capacities, and load definitions. The exact
export name and shape are frozen by the senior-owned red adapter contract. The
adapter must not copy or hardcode those values.

The adapter owns only interface state:

- the current application session;
- the accepted-command replay journal;
- selected control values;
- the latest typed rejection or adapter-input error; and
- the DOM render lifecycle.

The adapter does not calculate travel, capacity, scheduling, load lifecycle,
rejection precedence, or scoring. Control availability may reflect
interface-shape facts, such as whether a selection exists. It must not predict
domain eligibility. A disabled button is a convenience, never a second rules
engine.

### Input, submission, and rendering

DOM values are untrusted strings. The adapter validates the command type and
required string fields before it constructs one of the four application
commands. Identifier membership is not an adapter concern. A well-shaped
unknown truck, load, or location identifier reaches the application facade so
ADR-0002's typed domain rejection remains authoritative.

Each player action calls `submitCommand` exactly once. On acceptance, the
adapter replaces its session, appends the accepted command to its replay
journal, and renders the returned accepted events and a fresh projection. On
rejection, it retains the original session and journal and renders the typed
rejection. A rejected command does not enter the replay journal.

Reset creates a fresh session and empty journal. Replay passes a detached copy
of the accepted-command replay journal to `replayCommands`. It must reproduce
the current projection and accepted-event history before the replayed session
can replace the displayed session. A mismatch is a loud adapter failure, not a
new domain outcome.

State and result rendering comes from `projectSession`. Scenario rendering
comes from the application facade's scenario projection. Accepted history comes
from the application session. The DOM is never read back as the source of game
truth.

### Evidence before implementation trust

The next change is a senior-owned red browser-adapter contract. It fixes the
exact application projection and adapter symbols before bounded implementation
begins. The contract must prove:

- adapter-to-application import direction and absence of engine imports;
- parsing of malformed external values versus well-shaped domain identifiers;
- one application submission per player action;
- rejection display with no session, journal, or accepted-history mutation;
- the minute-150 complete-day projection and result through the adapter;
- reset and replay equality;
- a successful static production build; and
- a real-browser smoke covering the clickable complete-day and rejection loop.

The test driver is selected by the senior-owned red contract, not by the
bounded implementation worker. Deterministic contract checks are necessary,
but visual acceptance still requires an independent capable reviewer to inspect
the rendered page. A visionless worker may not claim that appearance passed.

## Consequences

- The first playable slice can run locally without a service or duplicated
  domain implementation.
- The browser remains replaceable because the application facade owns the
  session and domain-facing projections.
- Direct DOM code minimizes dependencies and ceremony for one fixed scenario.
- The adapter needs explicit rendering discipline because a framework does not
  provide component lifecycle or state synchronization.
- Vite adds a pinned development dependency and raises the effective Node 22
  patch floor to the minimum its selected release supports.
- Real-browser verification adds setup cost, but it proves the interface that
  Node-only tests cannot see.
- Save data, hosting, visual polish, animation, and broader scenarios remain
  separate work.

## Alternatives considered

**Command-line interface.** A CLI would be smaller, but it would not prove the
screen projection, discoverable controls, or playable browser path required by
the M1 milestone. It remains a possible diagnostic adapter later.

**React, Vue, Svelte, or another component framework.** Each can implement the
page, but M1 has one screen, one session, four commands, and no routing or
shared component system. The framework lifecycle and dependency surface do not
buy a demonstrated capability yet.

**Canvas or a game engine.** A canvas can support richer spatial presentation,
but it adds input, accessibility, rendering, and test complexity before the
dispatch loop needs animation or continuous simulation.

**Compile with `tsc` and open files directly.** Browser module security makes
`file://` execution unreliable, and raw compiler output does not produce a
reviewable static application entry point. A small module server would recreate
part of the capability Vite already owns.

**Server-rendered or service-backed application.** M1 has no remote data,
shared state, authentication, or server authority. A service boundary would add
failure modes without improving the player loop.

## Reversal conditions

Adopt a component framework only when measured interface work shows repeated
state synchronization defects, multiple screens need shared lifecycle, or a
real component reuse requirement exceeds the direct DOM approach. Convenience
or familiarity alone is not evidence.

Replace Vite if its supported releases cannot build Manifest under a supported
Node LTS line, its static output cannot meet a required deployment target, or
its build behavior breaks deterministic verification.

Add a backend only when an accepted milestone requires shared remote state,
accounts, authoritative multiplayer, or persistence that cannot remain local.
That change requires a successor ADR because it changes the trust boundary.
