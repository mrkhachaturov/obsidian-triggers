#!/usr/bin/env bash
#MISE description="Build and copy into a vault — VAULT=/path/to/vault mise run plugin:install"
#MISE dir="{{config_root}}"
#MISE depends=["build"]
set -euo pipefail

# main.js is build output, so install builds first: copying a stale bundle is the
# one way these files drift apart.
main() {
  if [[ -z "${VAULT:-}" ]]; then
    echo "VAULT is unset" >&2
    exit 1
  fi

  local target="${VAULT}/.obsidian/plugins/triggers"
  mkdir -p "${target}"
  cp main.js manifest.json styles.css "${target}/"
  echo "installed into ${target}"
}

main "$@"
