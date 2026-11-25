#!/bin/bash
set -euo pipefail
cd -- "$(dirname -- "$0")"
finish() {
  status=$?
  if [ "$status" -ne 0 ]; then
    printf '\nBuild did not complete. Review the error above.\n'
    read -r -p 'Press Return to close. ' _ || true
  fi
}
trap finish EXIT
if [ "$(uname -s)" != Darwin ]; then
  echo 'Run this builder on a Mac.'; exit 1
fi
if ! command -v node >/dev/null || ! command -v npm >/dev/null; then
  echo 'Install Node.js 22 or later on this build computer from https://nodejs.org, then reopen this file.'; exit 1
fi
if [ "$(node -p 'Number(process.versions.node.split(".")[0])')" -lt 22 ]; then
  echo 'Node.js 22 or later is required.'; exit 1
fi
export CSC_IDENTITY_AUTO_DISCOVERY=false
npm ci
npm test
npm run dist:mac
if ! compgen -G 'dist/*.dmg' >/dev/null; then
  echo 'No DMG was produced.'; exit 1
fi
open dist
printf '\nBuild complete. Transfer the DMG to the church Mac.\n'
read -r -p 'Press Return to close. ' _ || true
