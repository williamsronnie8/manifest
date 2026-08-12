#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repo_root"

npm ci --ignore-scripts --no-audit --no-fund
node -e "require('node:fs').rmSync('dist', { recursive: true, force: true })"
npm run build

forbidden_pattern="from[[:space:]]+[\"'](node:|fs|path|http|https|net|crypto)|Date\\.|new[[:space:]]+Date|Math\\.random|globalThis|window\\.|document\\.|fetch\\("
if grep -REn "$forbidden_pattern" src/engine; then
  printf 'FAIL: src/engine imports or consults an ambient runtime capability\n' >&2
  exit 1
fi

node --test tests/engine-contract.test.mjs
