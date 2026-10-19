#!/bin/zsh

set -euo pipefail

SCRIPT_DIR=${0:A:h}

"$SCRIPT_DIR/open-tweet.mjs" "$@"
