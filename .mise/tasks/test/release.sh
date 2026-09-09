#!/usr/bin/env bash
#MISE description="Check that the version, the changelog and the release files carry one number"
#MISE dir="{{config_root}}"
set -euo pipefail

exec node scripts/check-release.mjs "$@"
