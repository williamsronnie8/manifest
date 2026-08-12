#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repo_root"

fail() {
  printf 'FAIL: %s\n' "$1" >&2
  exit 1
}

require_text() {
  local file="$1"
  local text="$2"
  [[ -f "$file" ]] || fail "missing $file"
  grep -Fq -- "$text" "$file" || fail "$file must contain: $text"
}

adr="docs/adr/0004-playable-interface-and-adapter-boundary.md"
architecture="docs/ARCHITECTURE.md"
milestone="docs/milestones/M1-vertical-slice.md"

require_text "$adr" "# ADR-0004: Local browser interface and adapter boundary"
require_text "$adr" "Status: Accepted"
require_text "$adr" "local, single-page browser interface"
require_text "$adr" "framework-free TypeScript"
require_text "$adr" "standards-based DOM APIs"
require_text "$adr" "Vite"
require_text "$adr" 'src/adapters/browser/'
require_text "$adr" 'src/application/index.js'
require_text "$adr" "must not import engine internals"
require_text "$adr" "accepted-command replay journal"
require_text "$adr" "A rejected command does not enter the replay journal"
require_text "$adr" "static browser artifact"
require_text "$adr" "no backend"
require_text "$adr" "Vite transpiles TypeScript but does not type-check it"
require_text "$adr" "real-browser smoke"
require_text "$adr" "test driver is selected by the senior-owned red contract"

require_text "docs/adr/README.md" "[0004](0004-playable-interface-and-adapter-boundary.md)"
require_text "$architecture" 'src/adapters/browser/'
require_text "$architecture" "browser adapter imports only the public application facade"
require_text "$architecture" "scenario projection"
require_text "$milestone" "senior-owned red browser-adapter contract"
require_text "$milestone" "bounded browser-adapter implementation"
require_text "$milestone" "real-browser smoke"
require_text "scripts/verify.sh" 'tests/verify-interface-adr.sh'

printf '1 interface-ADR contract check passed.\n'
