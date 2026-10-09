#!/usr/bin/env bash
# Fetches the speech model into public/engine/ so the browser can load it.
# The 17MB weights are not committed, this pulls them from Hugging Face.
set -euo pipefail

DIR="$(cd "$(dirname "$0")/.." && pwd)/public/engine"
mkdir -p "$DIR"

BASE="https://huggingface.co/Cactus-Compute/whistle/resolve/main"

if [ ! -f "$DIR/needle.js" ]; then
  echo "fetching engine"
  curl -fsSL -o "$DIR/needle.js"   "https://huggingface.co/Cactus-Compute/needle3/resolve/main/wasm/needle.js"
  curl -fsSL -o "$DIR/needle.wasm" "https://huggingface.co/Cactus-Compute/needle3/resolve/main/wasm/needle.wasm"
fi

if [ ! -f "$DIR/whistle.cact" ]; then
  echo "fetching speech weights (17MB)"
  curl -fL -o "$DIR/whistle.cact" "$BASE/whistle.cact"
fi

echo "engine ready in $DIR"
ls -la "$DIR"
