#!/bin/bash
set -euo pipefail

if [[ -e "$HOME/CloudMind/System/KILL" ]]; then
  printf 'Manifest launch blocked by the automation kill switch.\n' >&2
  exit 1
fi

cd "$(dirname "$0")"
export PATH="$PATH:/opt/homebrew/bin:/usr/local/bin"
mkdir -p "$HOME/Library/Logs"
exec > >(tee -a "$HOME/Library/Logs/manifest-play.log") 2>&1
printf '\nManifest launch: %s\n' "$(date)"
if ! command -v npm >/dev/null || ! command -v node >/dev/null; then
  printf 'Install Node.js 22.12 or newer in the 22.x line, then try again.\n' >&2
  exit 1
fi
node -e 'const [major, minor] = process.versions.node.split(".").map(Number); if (major !== 22 || minor < 12) { console.error("Manifest requires Node.js 22.12 or newer in the 22.x line."); process.exit(1); }'
printf 'Opening http://127.0.0.1:4174 after the build. Keep this window open.\nPress Control+C to stop. If the port is busy, close the previous Manifest window.\n'
npm ci --ignore-scripts --no-audit --no-fund
npm run play
