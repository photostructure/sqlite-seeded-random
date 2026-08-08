#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd -- "$SCRIPT_DIR/.." && pwd)"

if [[ "$(uname -s)" != "Linux" ]]; then
  echo "Native sanitizer and Valgrind checks currently run on Linux only; skipping."
  exit 0
fi

required_tools=(clang clang-tidy gcc make sqlite3 timeout valgrind)
missing_tools=()
for tool in "${required_tools[@]}"; do
  if ! command -v "$tool" >/dev/null 2>&1; then
    missing_tools+=("$tool")
  fi
done

if (( ${#missing_tools[@]} > 0 )); then
  echo "Missing native-analysis tools: ${missing_tools[*]}" >&2
  echo "On Ubuntu/Debian, install: clang clang-tidy gcc make sqlite3 valgrind" >&2
  exit 1
fi

cd "$REPO_ROOT"

echo "[1/3] Running native static analysis"
bash "$SCRIPT_DIR/native-static-analysis.sh"

echo "[2/3] Running AddressSanitizer, LeakSanitizer, and UBSan"
bash "$SCRIPT_DIR/sanitizers-test.sh"

echo "[3/3] Running Valgrind"
bash "$SCRIPT_DIR/valgrind-test.sh"

echo "Native memory and static-analysis checks passed."
