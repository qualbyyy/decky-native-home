#!/usr/bin/env zsh
set -euo pipefail

ROOT="${0:A:h}"
HOST="${1:-deck@192.168.1.68}"
STAGE="$ROOT/release/decky-native-home"
CTL="/tmp/nh-deploy-${HOST//@/_}.sock"

cleanup() {
  ssh -o ControlPath="$CTL" -O exit "$HOST" >/dev/null 2>&1 || true
}
trap cleanup EXIT

rm -rf "$STAGE"
mkdir -p "$STAGE"
cp -r "$ROOT/dist" "$ROOT/py_modules" "$ROOT/main.py" "$ROOT/plugin.json" "$ROOT/package.json" "$STAGE/"
find "$STAGE" -type d -name '__pycache__' -exec rm -rf {} +

tar -C "$STAGE" -cf - . | ssh -o StrictHostKeyChecking=accept-new -o ControlMaster=auto -o ControlPersist=60 -o ControlPath="$CTL" "$HOST" \
  'rm -rf /tmp/decky-native-home-upload && mkdir -p /tmp/decky-native-home-upload && tar -xf - -C /tmp/decky-native-home-upload'

ssh -t -o ControlPath="$CTL" "$HOST" \
  'sudo mkdir -p /home/deck/homebrew/plugins && sudo rm -rf /home/deck/homebrew/plugins/decky-native-home && sudo mv /tmp/decky-native-home-upload /home/deck/homebrew/plugins/decky-native-home && sudo chown -R deck:deck /home/deck/homebrew/plugins/decky-native-home && sudo systemctl restart plugin_loader'
