#!/usr/bin/env bash
#MISE description="Typecheck, then bundle src/ into main.js"
#MISE dir="{{config_root}}"
#MISE depends=["test:strings"]
set -euo pipefail

# package.json owns the command: the community directory rebuilds the plugin in
# a sandbox where mise does not exist.
exec npm run --silent build
