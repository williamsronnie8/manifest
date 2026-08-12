#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

"$repo_root/tests/verify-initialization.sh"
"$repo_root/tests/verify-m1-domain.sh"
"$repo_root/tests/verify-engine-contract.sh"
"$repo_root/tests/verify-interface-adr.sh"
