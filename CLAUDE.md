# Manifest repository rules

- Work on a branch and open a pull request. Agents may merge pull requests
  into `main` after required checks pass.
- Preserve the deterministic, headless simulation boundary in
  `docs/ARCHITECTURE.md` and ADR-0001.
- Do not select an application framework until a separate ADR records the
  decision and its evidence.
- Keep product scope in `docs/PRODUCT-CHARTER.md`, domain language in
  `docs/DOMAIN.md`, and milestone acceptance in `docs/milestones/`.
- Run `make verify` from the repository root before proposing a change.
