#!/usr/bin/env bash
# Install the Solana Agent Payments skill into a Claude Code project.
#
# Usage:
#   bash install.sh [TARGET_DIR] [--agents]
#
#   TARGET_DIR   project root to install into (default: current directory)
#   --agents     install into .agents/ instead of .claude/ (Codex/Cursor/etc.)
#
# Copies:
#   skill/      -> <dir>/skills/ext/agent-payments/
#   agents/*    -> <dir>/agents/
#   commands/*  -> <dir>/commands/
#   rules/*     -> <dir>/rules/
set -euo pipefail

# Resolve this script's directory (the repo root), so it works from anywhere.
SRC="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

TARGET="."
DIR=".claude"
for arg in "$@"; do
  case "$arg" in
    --agents) DIR=".agents" ;;
    -h|--help) sed -n '2,12p' "$0"; exit 0 ;;
    *) TARGET="$arg" ;;
  esac
done

if [ ! -d "$TARGET" ]; then
  echo "error: target directory '$TARGET' does not exist" >&2
  exit 1
fi

BASE="$TARGET/$DIR"
echo "Installing Solana Agent Payments skill into $BASE ..."

mkdir -p "$BASE/skills/ext/agent-payments" "$BASE/agents" "$BASE/commands" "$BASE/rules"

cp -R "$SRC/skill/." "$BASE/skills/ext/agent-payments/"
cp -R "$SRC/agents/." "$BASE/agents/"
cp -R "$SRC/commands/." "$BASE/commands/"
cp -R "$SRC/rules/." "$BASE/rules/"

# Provide an env template if the project doesn't have one yet.
if [ ! -f "$TARGET/.env.example" ] && [ -f "$SRC/.env.example" ]; then
  cp "$SRC/.env.example" "$TARGET/.env.example"
  echo "  + wrote .env.example (copy to .env and fill in)"
fi

cat <<EOF

✅ Installed.
   skill    -> $BASE/skills/ext/agent-payments/SKILL.md
   agents   -> agent-payments-engineer, payment-safety-auditor
   commands -> /add-x402-paywall, /setup-agent-wallet, /audit-agent-spending
   rules    -> payments.md (auto-loads on payment/wallet files)

Next:
   1. cp .env.example .env   # then fill in (devnet first)
   2. Ask Claude: "set up a capped agent wallet" or "/add-x402-paywall <route>"
   3. Run /audit-agent-spending before anything touches mainnet.
EOF
