#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd -- "$SCRIPT_DIR/.." && pwd)"
OUTPUT_FILE="$REPO_ROOT/native-analysis.log"

cd "$REPO_ROOT"
rm -f -- "$OUTPUT_FILE"

{
  echo "clang-tidy"
  clang-tidy seeded_random.c -- -Ivendor -std=c17

  echo "Clang static analyzer"
  clang --analyze -std=c17 -Ivendor \
    -Xanalyzer -analyzer-werror \
    -Xanalyzer -analyzer-output=text seeded_random.c

  echo "GCC static analyzer"
  gcc -std=c17 -Ivendor -O2 \
    -Wall -Wextra -Werror -Wformat=2 -Wconversion -Wsign-conversion \
    -fanalyzer -fsyntax-only seeded_random.c
} 2>&1 | tee "$OUTPUT_FILE"

if [[ -z "${GITHUB_ACTIONS:-}" ]]; then
  rm -f -- "$OUTPUT_FILE"
fi
