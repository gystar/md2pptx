#!/usr/bin/env bash
# Compatibility alias for the Ubuntu entry point.
set -euo pipefail
TOOL_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
exec bash "$TOOL_DIR/ubuntu.sh" "$@"
