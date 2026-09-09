#!/usr/bin/env bash
#MISE description="Regenerate docs/reference.md from the registries the plugin reads"
#MISE dir="{{config_root}}"
set -euo pipefail

exec node scripts/generate-docs.mjs "$@"
