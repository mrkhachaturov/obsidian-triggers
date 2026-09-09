#!/usr/bin/env bash
#MISE description="Unused dictionary keys, and locales that drifted from English"
#MISE dir="{{config_root}}"
set -euo pipefail

exec node scripts/check-strings.mjs
