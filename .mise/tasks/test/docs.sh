#!/usr/bin/env bash
#MISE description="Fail when docs/reference.md no longer matches the code"
#MISE dir="{{config_root}}"
set -euo pipefail

exec node scripts/generate-docs.mjs --check
