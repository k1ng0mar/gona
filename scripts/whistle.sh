#!/usr/bin/env bash
# Whisper style CLI shim over the Cactus Needle speech API, so the Node server
# can shell out to it. Reads --weights and --audio, prints JSON.
set -euo pipefail

exec python3 - "$@" <<'PY'
import sys, json
args = sys.argv[1:]
audio = None
weights = None
i = 0
while i < len(args):
    if args[i] == "--audio" and i + 1 < len(args):
        audio = args[i + 1]; i += 2
    elif args[i] == "--weights" and i + 1 < len(args):
        weights = args[i + 1]; i += 2
    else:
        i += 1
if not audio:
    print(json.dumps({"text": "", "error": "no audio"}))
    sys.exit(1)
import needle
r = needle.transcribe(audio, weights=weights) if weights else needle.transcribe(audio)
print(json.dumps({"text": r.get("text", ""), "language": r.get("language", "")}))
PY
