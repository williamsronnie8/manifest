# Manifest

Manifest is a logistics dispatch and supply-chain simulation game built as a
real software-engineering learning project. The player makes operational
choices, sees their consequences, and learns to improve both the plan and the
software that represents it.

The first playable slice covers one simulated operating day: two trucks deliver
four loads among three locations. It is intentionally small enough to explain,
test, replay, and review end to end.

No application framework has been selected. Framework selection is a later,
separately justified architecture decision. This initialization contains no
game functionality.

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

Work on a branch and open a pull request. Ronnie alone merges `main`.
See `AGENTS.md` or `CLAUDE.md` before changing the repo.

Run all repository checks from the root:

```sh
make verify
```

The command is deliberately dependency-free during initialization. A later
framework ADR may extend it, but the root command remains the stable entry
point.
