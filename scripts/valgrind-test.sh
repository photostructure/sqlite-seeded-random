#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd -- "$SCRIPT_DIR/.." && pwd)"
OUTPUT_FILE="$REPO_ROOT/valgrind.log"
BUILD_DIR="$(mktemp -d "${TMPDIR:-/tmp}/sqlite-seeded-random-valgrind.XXXXXX")"

cleanup() {
  rm -rf -- "$BUILD_DIR"
}
trap cleanup EXIT

cd "$REPO_ROOT"
rm -f -- "$OUTPUT_FILE"

make --no-print-directory -B loadable \
  prefix="$BUILD_DIR/dist" \
  CC=gcc \
  CFLAGS="-std=c17 -O1 -g -fno-omit-frame-pointer"

sqlite3 :memory: \
  -cmd ".load $BUILD_DIR/dist/seeded_random.so" \
  < "$SCRIPT_DIR/native-memory-test.sql" >/dev/null

set +e
valgrind \
  --tool=memcheck \
  --leak-check=full \
  --show-leak-kinds=definite,indirect,possible \
  --errors-for-leak-kinds=definite,indirect \
  --track-origins=yes \
  --track-fds=yes \
  --error-exitcode=99 \
  sqlite3 :memory: \
    -cmd ".load $BUILD_DIR/dist/seeded_random.so" \
    < "$SCRIPT_DIR/native-memory-test.sql" \
    2>&1 | tee "$OUTPUT_FILE"
test_status=${PIPESTATUS[0]}
set -e

if (( test_status != 0 )) || \
   ! grep -Eq 'ERROR SUMMARY: 0 errors' "$OUTPUT_FILE"; then
  echo "Valgrind checks failed; output retained at $OUTPUT_FILE" >&2
  exit 1
fi

if [[ -z "${GITHUB_ACTIONS:-}" ]]; then
  rm -f -- "$OUTPUT_FILE"
fi
