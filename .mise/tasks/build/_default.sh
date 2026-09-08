#!/usr/bin/env bash
#MISE description="Typecheck, then bundle src/ into main.js"
#MISE dir="{{config_root}}"
#MISE depends=["test:types"]
set -euo pipefail

exec node esbuild.config.mjs production
