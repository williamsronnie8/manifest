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

adr="docs/adr/0002-m1-scenario-semantics.md"
domain="docs/DOMAIN.md"
milestone="docs/milestones/M1-vertical-slice.md"

require_file "$adr"
require_text "$adr" "Status: Accepted"
require_text docs/adr/README.md "[0002](0002-m1-scenario-semantics.md)"

for heading in "## Time and event ordering" "## M1 scenario" \
  "## Commands" "## Rejection contract" "### Rejection precedence" \
  "## Result and scoring" "## Complete-day proof"; do
  require_text "$adr" "$heading"
done

require_text "$adr" 'minute `0`'
require_text "$adr" 'minute `480`'
require_text "$adr" "monotonic scheduling sequence"
require_text "$adr" "before the next player command"

require_text "$adr" '| Depot | North | 60 |'
require_text "$adr" '| North | South | 45 |'
require_text "$adr" '| South | Depot | 75 |'
require_text "$adr" '| T1 | Depot | 2 |'
require_text "$adr" '| T2 | Depot | 2 |'
require_text "$adr" '| L1 | Depot | North | 2 |'
require_text "$adr" '| L2 | Depot | South | 1 |'
require_text "$adr" '| L3 | North | South | 1 |'
require_text "$adr" '| L4 | South | Depot | 2 |'

for command in pickup travel deliver advance; do
  require_text "$adr" "\`$command\`"
done
require_text "$adr" "arrival exactly at minute 480 is allowed"
require_text "$adr" 'pickup and `travel` at minute 480 return `DAY_ENDED`'
require_text "$adr" 'delivery at minute 480 is allowed'
require_text "$adr" '`NO_SCHEDULED_EVENT`'

expected_codes="$(sed -n '/^### Rejection precedence$/,/^## /p' "$adr" |
  sed -n 's/^[0-9][0-9]*\. `\([A-Z_]*\)`.*/\1/p')"
required_codes="$(printf '%s\n' \
  UNKNOWN_COMMAND \
  UNKNOWN_TRUCK \
  UNKNOWN_LOAD \
  UNKNOWN_LOCATION \
  DAY_ENDED \
  TRUCK_IN_TRANSIT \
  LOAD_ALREADY_DELIVERED \
  LOAD_NOT_AVAILABLE \
  LOAD_NOT_CARRIED \
  WRONG_LOCATION \
  INVALID_TRAVEL_LEG \
  CAPACITY_EXCEEDED \
  ARRIVAL_AFTER_DAY_END \
  NO_SCHEDULED_EVENT)"
[[ "$expected_codes" == "$required_codes" ]] || \
  fail "ADR-0002 rejection precedence must match the frozen M1 order"

require_text "$adr" "returns the first applicable code"
require_text "$adr" "appends no accepted domain event"
require_text "$adr" "consumes no event sequence"
require_text "$adr" "does not advance simulation time"
require_text "$adr" "leaves domain state unchanged"
require_text "$adr" "final delivery occurs at minute 150"
require_text "$adr" '`delivered_count`'
require_text "$adr" '`all_delivered`'
require_text "$adr" '`completion_minute`'
require_text "$adr" "M1 has no due dates or lateness"
require_text "$adr" 'score is exactly `delivered_count`'

require_text "$domain" "ADR-0002"
if grep -Fq -- "## Open domain decisions" "$domain"; then
  fail "docs/DOMAIN.md still presents the M1 semantics as open decisions"
fi
require_text "$milestone" "minute 150"
require_text "$milestone" '`CAPACITY_EXCEEDED`'
require_text "$milestone" '`WRONG_LOCATION`'
require_text "$milestone" '`ARRIVAL_AFTER_DAY_END`'
require_text "$milestone" "first applicable rejection code"
require_text scripts/verify.sh 'tests/verify-m1-domain.sh'

for forbidden in pnpm-lock.yaml yarn.lock pyproject.toml requirements.txt \
  Cargo.toml Cargo.lock go.mod go.sum Gemfile \
  composer.json pom.xml build.gradle settings.gradle; do
  [[ ! -e "$forbidden" ]] || fail "framework or dependency file is out of scope: $forbidden"
done

printf 'Manifest M1 domain-contract checks passed.\n'
