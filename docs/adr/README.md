# Architecture decision records

ADRs preserve consequential technical decisions so a later contributor can
understand what is binding, why it was chosen, and what evidence would reverse
it. They describe decisions, not meeting history.

## Index

| ADR | Status | Decision |
| --- | --- | --- |
| [0001](0001-headless-deterministic-simulation.md) | Accepted | Keep the simulation headless and deterministic, independent of UI technology |
| [0002](0002-m1-scenario-semantics.md) | Accepted | Fix the M1 clock, scenario, commands, rejection order, and scoring contract |
| [0003](0003-implementation-language-and-application-boundary.md) | Accepted | Use strict TypeScript with a Node-hosted, adapter-to-application-to-engine boundary |

## Convention

- Use the next four-digit number and a short kebab-case title.
- Keep accepted ADRs immutable. If a decision changes, add a successor ADR and
  mark the old one superseded.
- Name the context, decision, consequences, alternatives, and reversal
  conditions.
- A framework or dependency choice must include the capability it buys and the
  smallest evidence needed to justify it.

## ADR template

```markdown
# ADR-NNNN: Decision title

Date: YYYY-MM-DD
Status: Proposed | Accepted | Superseded by ADR-NNNN

## Context

What forces a decision now?

## Decision

What is binding?

## Consequences

What becomes easier, harder, or constrained?

## Alternatives considered

What credible options were rejected, and why?

## Reversal conditions

What evidence would justify replacing this decision?
```
