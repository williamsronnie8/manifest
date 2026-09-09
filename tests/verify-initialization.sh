#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repo_root"

fail() {
  printf 'FAIL: %s\n' "$1" >&2
  exit 1
}

require_file() {
  [[ -f "$1" ]] || fail "missing required file: $1"
}

require_text() {
  local file="$1"
  local text="$2"
  grep -Fq -- "$text" "$file" || fail "$file must contain: $text"
}

required_files=(
  AGENTS.md
  CLAUDE.md
  README.md
  .editorconfig
  .gitattributes
  .gitignore
  Makefile
  scripts/verify.sh
  docs/PRODUCT-CHARTER.md
  docs/DOMAIN.md
  docs/ARCHITECTURE.md
  docs/adr/README.md
  docs/adr/0001-headless-deterministic-simulation.md
  docs/milestones/M1-vertical-slice.md
)

for file in "${required_files[@]}"; do
  require_file "$file"
done

[[ -x scripts/verify.sh ]] || fail "scripts/verify.sh must be executable"

require_text README.md "logistics dispatch and supply-chain simulation game"
require_text README.md "two trucks"
require_text README.md "four loads"
require_text README.md "three locations"
require_text README.md "make verify"
require_text README.md "docs/PRODUCT-CHARTER.md"
require_text README.md "docs/DOMAIN.md"
require_text README.md "docs/ARCHITECTURE.md"
require_text README.md "docs/adr/README.md"
require_text README.md "docs/milestones/M1-vertical-slice.md"
require_text README.md "No application framework has been selected"

for heading in "## Player promise" "## Learning goals" "## Initial scope" \
  "## Non-goals" "## Success criteria" "## Decision principles"; do
  require_text docs/PRODUCT-CHARTER.md "$heading"
done
require_text docs/PRODUCT-CHARTER.md "one simulated operating day"
require_text docs/PRODUCT-CHARTER.md "two trucks"
require_text docs/PRODUCT-CHARTER.md "four loads"
require_text docs/PRODUCT-CHARTER.md "three locations"
require_text docs/PRODUCT-CHARTER.md "application framework"
require_text docs/PRODUCT-CHARTER.md "game functionality"

for term in "Operating day" "Simulation clock" "Location" "Truck" "Load" \
  "Dispatch" "Arrival" "Pickup" "Delivery" "Event log"; do
  require_text docs/DOMAIN.md "$term"
done
require_text docs/DOMAIN.md "Time is monotonic"
require_text docs/DOMAIN.md "Identifiers are unique"
require_text docs/DOMAIN.md "exactly one lifecycle state"
require_text docs/DOMAIN.md "at most one truck"
require_text docs/DOMAIN.md "Capacity cannot be exceeded"
require_text docs/DOMAIN.md "Pickup and delivery require co-location"
require_text docs/DOMAIN.md "A delivered load is terminal"
require_text docs/DOMAIN.md "equal ordered commands"

require_text docs/ARCHITECTURE.md "headless deterministic simulation engine"
require_text docs/ARCHITECTURE.md "source of truth"
require_text docs/ARCHITECTURE.md "must not import"
require_text docs/ARCHITECTURE.md "wall-clock"
require_text docs/ARCHITECTURE.md "append-only ordered event log"
require_text docs/ARCHITECTURE.md "UI is an adapter"
require_text docs/ARCHITECTURE.md "Seeded randomness"
require_text docs/ARCHITECTURE.md "remain undecided"

require_text docs/adr/README.md "## ADR template"
require_text docs/adr/README.md "0001-headless-deterministic-simulation.md"
require_text docs/adr/0001-headless-deterministic-simulation.md "Status: Accepted"
require_text docs/adr/0001-headless-deterministic-simulation.md "## Decision"
require_text docs/adr/0001-headless-deterministic-simulation.md "## Consequences"
require_text docs/adr/0001-headless-deterministic-simulation.md "## Alternatives considered"
require_text docs/adr/0001-headless-deterministic-simulation.md "## Reversal conditions"

require_text docs/milestones/M1-vertical-slice.md "two trucks"
require_text docs/milestones/M1-vertical-slice.md "four loads"
require_text docs/milestones/M1-vertical-slice.md "three locations"
require_text docs/milestones/M1-vertical-slice.md "one operating day"
require_text docs/milestones/M1-vertical-slice.md "## Acceptance scenarios"
require_text docs/milestones/M1-vertical-slice.md "## Engineering exit criteria"
require_text docs/milestones/M1-vertical-slice.md "## Out of scope"

grep -Eq '^verify:' Makefile || fail "Makefile must define a verify target"
require_text Makefile "./scripts/verify.sh"
require_text scripts/verify.sh "tests/verify-initialization.sh"

for forbidden in pnpm-lock.yaml yarn.lock pyproject.toml requirements.txt \
  Cargo.toml Cargo.lock go.mod go.sum Gemfile \
  composer.json pom.xml build.gradle settings.gradle; do
  [[ ! -e "$forbidden" ]] || fail "framework or dependency file is out of scope: $forbidden"
done

printf 'Manifest initialization checks passed.\n'
