<!-- foreman preamble · source: foreman/templates/target-repo.md · do not hand-edit -->
## Who implements here

Claude and Codex act in this repo as **orchestrators only** (foreman
`PROTOCOL.md`, D-018). The default first move on any ask that implies
changing this repo is a foreman ticket — `foreman/bin/contract --ask ...`
— not an editor. A senior implements directly only with a committed
reason: a `routed: senior` ticket, a takeover event, or Ronnie's recorded
direction. Eligible work runs locally on the junior via `foreman/bin/dispatch`.
Where this file and foreman's `ROUTING.md` disagree, the stricter wins.

## Manifest repository rules

- Run `~/foreman/bin/brief` before acting, then read the ticket that authorizes
  the work.
- Ronnie is the sole merger to `main`. Work on a branch and open a pull
  request.
- Preserve the deterministic, headless simulation boundary in
  `docs/ARCHITECTURE.md` and ADR-0001.
- Do not select an application framework until a separate ADR records the
  decision and its evidence.
- Keep product scope in `docs/PRODUCT-CHARTER.md`, domain language in
  `docs/DOMAIN.md`, and milestone acceptance in `docs/milestones/`.
- Run `make verify` from the repository root before proposing a change.
