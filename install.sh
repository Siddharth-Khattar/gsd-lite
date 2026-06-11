#!/usr/bin/env bash
#
# gsd-lite installer
#
# Copies the gsd-lite commands and subagents into a target project's .claude/
# directory so they become available as /lite:* slash commands in Claude Code.
#
# Usage:
#   ./install.sh [TARGET_DIR]      # install into TARGET_DIR (default: current dir)
#   ./install.sh --global          # install into ~/.claude (available everywhere)
#   ./install.sh --uninstall [DIR] # remove gsd-lite from a target
#
# Plugin alternative: if you use Claude Code's plugin system, you can skip this
# script and load the repo directly as a plugin (see README.md).

set -euo pipefail

SOURCE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

MODE="install"
TARGET=""

while [ $# -gt 0 ]; do
  case "$1" in
    --global) TARGET="$HOME"; shift ;;
    --uninstall) MODE="uninstall"; shift ;;
    -h|--help)
      grep '^#' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) TARGET="$1"; shift ;;
  esac
done

TARGET="${TARGET:-$(pwd)}"
CLAUDE_DIR="$TARGET/.claude"
CMD_DEST="$CLAUDE_DIR/commands/lite"
AGENT_DEST="$CLAUDE_DIR/agents"
BIN_DEST="$CLAUDE_DIR/lite/bin"

if [ "$MODE" = "uninstall" ]; then
  echo "Removing gsd-lite from $CLAUDE_DIR ..."
  rm -rf "$CMD_DEST" "$CLAUDE_DIR/lite"
  for f in "$SOURCE_DIR"/agents/lite-*.md; do
    [ -e "$f" ] || continue
    rm -f "$AGENT_DEST/$(basename "$f")"
  done
  echo "Done. (Left other .claude/ contents untouched.)"
  exit 0
fi

if [ ! -d "$SOURCE_DIR/commands/lite" ]; then
  echo "ERROR: $SOURCE_DIR/commands/lite not found. Run this from the gsd-lite repo." >&2
  exit 1
fi

echo "Installing gsd-lite into $CLAUDE_DIR ..."
mkdir -p "$CMD_DEST" "$AGENT_DEST" "$BIN_DEST"

cp "$SOURCE_DIR"/commands/lite/*.md "$CMD_DEST/"
cp "$SOURCE_DIR"/agents/lite-*.md "$AGENT_DEST/"
cp "$SOURCE_DIR"/bin/lite.cjs "$BIN_DEST/"

echo ""
echo "Installed:"
echo "  Commands → $CMD_DEST"
echo "  Agents   → $AGENT_DEST"
echo "  Helper   → $BIN_DEST/lite.cjs (deterministic bookkeeping)"
echo ""
echo "Available commands (restart Claude Code or run /help to refresh):"
for f in "$CMD_DEST"/*.md; do
  echo "  /lite:$(basename "$f" .md)"
done
echo ""
echo "Get started:  /lite:start   (or /lite:map first for an existing codebase)"
