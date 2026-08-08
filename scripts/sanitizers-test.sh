#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd -- "$SCRIPT_DIR/.." && pwd)"
OUTPUT_FILE="$REPO_ROOT/asan-output.log"
BUILD_DIR="$(mktemp -d "${TMPDIR:-/tmp}/sqlite-seeded-random-asan.XXXXXX")"

cleanup() {
  rm -rf -- "$BUILD_DIR"
}
trap cleanup EXIT

case "$(uname -m)" in
  x86_64) sanitizer_arch=x86_64 ;;
  aarch64|arm64) sanitizer_arch=aarch64 ;;
  *)
    echo "Unsupported sanitizer architecture: $(uname -m)" >&2
    exit 1
    ;;
esac

detect_leaks="${NATIVE_DETECT_LEAKS:-1}"
if [[ "$detect_leaks" != 0 && "$detect_leaks" != 1 ]]; then
  echo "NATIVE_DETECT_LEAKS must be 0 or 1" >&2
  exit 1
fi

clang_asan="$(clang -print-file-name="libclang_rt.asan-$sanitizer_arch.so")"
clang_ubsan="$(clang -print-file-name="libclang_rt.ubsan_standalone-$sanitizer_arch.so")"
gcc_asan="$(gcc -print-file-name=libasan.so)"
gcc_ubsan="$(gcc -print-file-name=libubsan.so)"

# Some compiler-rt/kernel combinations hang when LeakSanitizer starts inside an
# otherwise uninstrumented host. Probe the matching Clang runtime first, then
# use GCC's ABI-compatible runtimes if they are the pair that can finish.
sanitizer_preload=""
runtime_candidates=(
  "$clang_asan:$clang_ubsan"
  "$gcc_asan:$gcc_ubsan"
)
for candidate in "${runtime_candidates[@]}"; do
  asan_candidate="${candidate%%:*}"
  ubsan_candidate="${candidate#*:}"
  if [[ ! -f "$asan_candidate" || ! -f "$ubsan_candidate" ]]; then
    continue
  fi
  if timeout -k 1 5 env \
      LD_PRELOAD="$candidate" \
      ASAN_OPTIONS="detect_leaks=$detect_leaks" \
      sqlite3 :memory: 'SELECT 1;' >/dev/null 2>&1; then
    sanitizer_preload="$candidate"
    break
  fi
done

if [[ -z "$sanitizer_preload" ]]; then
  echo "No sanitizer runtime could complete a SQLite leak-check probe." >&2
  echo "If running under a debugger, retry with NATIVE_DETECT_LEAKS=0; Valgrind still gates leaks." >&2
  exit 1
fi
echo "Using sanitizer runtimes: $sanitizer_preload"

sanitizer_flags="-std=c17 -O1 -g -fno-omit-frame-pointer"
sanitizer_flags+=" -fsanitize=address,undefined -fno-sanitize-recover=undefined"
sanitizer_flags+=" -U_FORTIFY_SOURCE -D_FORTIFY_SOURCE=0"

cd "$REPO_ROOT"
rm -f -- "$OUTPUT_FILE"

make --no-print-directory -B loadable \
  prefix="$BUILD_DIR/dist" \
  CC=clang \
  CFLAGS="$sanitizer_flags" \
  LDFLAGS="-fsanitize=address,undefined"

set +e
env \
  LD_PRELOAD="$sanitizer_preload" \
  ASAN_OPTIONS="detect_leaks=$detect_leaks:abort_on_error=1:halt_on_error=1:strict_string_checks=1" \
  LSAN_OPTIONS="exitcode=23" \
  UBSAN_OPTIONS="halt_on_error=1:print_stacktrace=1" \
  sqlite3 :memory: \
    -cmd ".load $BUILD_DIR/dist/seeded_random.so" \
    < "$SCRIPT_DIR/native-memory-test.sql" \
    2>&1 | tee "$OUTPUT_FILE"
test_status=${PIPESTATUS[0]}
set -e

if (( test_status != 0 )) || \
   grep -Eq 'ERROR: (AddressSanitizer|LeakSanitizer)|runtime error:|SUMMARY: .*Sanitizer' "$OUTPUT_FILE"; then
  echo "Sanitizer checks failed; output retained at $OUTPUT_FILE" >&2
  exit 1
fi

if [[ -z "${GITHUB_ACTIONS:-}" ]]; then
  rm -f -- "$OUTPUT_FILE"
fi
