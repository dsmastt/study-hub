#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$(readlink -f "$0")")/.." && pwd)"
BIN_DIR="${XDG_BIN_HOME:-$HOME/.local/bin}"
CONFIG_DIR="${XDG_CONFIG_HOME:-$HOME/.config}/study-hub"
APPS_DIR="${XDG_DATA_HOME:-$HOME/.local/share}/applications"

mkdir -p "$BIN_DIR" "$CONFIG_DIR" "$APPS_DIR"
chmod +x "$ROOT/scripts/study"

if [[ ! -f "$CONFIG_DIR/launcher.json" ]]; then
  cp "$ROOT/config/launcher.example.json" "$CONFIG_DIR/launcher.json"
  echo "Installed launcher config: $CONFIG_DIR/launcher.json"
else
  echo "Keeping existing launcher config: $CONFIG_DIR/launcher.json"
fi

ln -sfn "$ROOT/scripts/study" "$BIN_DIR/study"
echo "Linked $BIN_DIR/study -> $ROOT/scripts/study"

cat > "$APPS_DIR/study-hub.desktop" <<DESKTOP
[Desktop Entry]
Type=Application
Name=Study Hub
Comment=Launch the Study Hub academic command center
Exec=study
Icon=applications-education
Terminal=false
Categories=Education;
Keywords=study;jee;syllabus;
DESKTOP
echo "Installed desktop entry: $APPS_DIR/study-hub.desktop"

if [[ ! -f "$ROOT/dist/index.html" || ! -d "$ROOT/node_modules" ]]; then
  echo "Preparing frontend build…"
  if command -v pnpm >/dev/null 2>&1; then
    (cd "$ROOT" && pnpm install && pnpm build)
  else
    (cd "$ROOT" && npm install && npm run build)
  fi
fi

case ":$PATH:" in
  *":$BIN_DIR:"*) ;;
  *)
    echo
    echo "Note: $BIN_DIR is not on your PATH. Add this to your shell config:"
    echo "  export PATH=\"$BIN_DIR:\$PATH\""
    ;;
esac

echo
echo "Run 'study --dry-run' to inspect the plan, or 'study' to launch."
