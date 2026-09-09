#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repo_root"

tests/verify-initialization.sh
tests/verify-m1-domain.sh
tests/verify-engine-contract.sh
tests/verify-interface-adr.sh

npm run build
node --test tests/scenario-projection-contract.test.mjs
npm run build:browser

set +e
adapter_output="$(node --test tests/browser-adapter-contract.test.mjs 2>&1)"
adapter_status=$?
set -e
printf '%s\n' "$adapter_output"

if [[ $adapter_status -eq 0 ]]; then
  printf 'Projection red check failed: browser behavior is already green.\n' >&2
  exit 1
fi
if [[ "$(grep -c '^not ok ' <<<"$adapter_output")" -ne 1 ]]; then
  printf 'Projection red check failed: expected exactly one focused failure.\n' >&2
  exit 1
fi
grep -Fq 'PROJECTION_NOT_IMPLEMENTED' <<<"$adapter_output"
grep -Eq '^# pass 3$' <<<"$adapter_output"
grep -Eq '^# fail 1$' <<<"$adapter_output"

printf 'Manifest projection red-base checks passed.\n'
