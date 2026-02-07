/*
 * sqlite-seeded-random: Deterministic seeded hash for SQLite ORDER BY
 *
 * Provides seeded_random(seed, id) -> int64 using the splitmix64 finalizer
 * with golden-ratio seed combining. This is a pure hash function (not a
 * stateful PRNG), so results are stable regardless of row evaluation order.
 *
 * Usage: SELECT * FROM items ORDER BY seeded_random(42, id);
 */
#include "sqlite3ext.h"
SQLITE_EXTENSION_INIT1

#include <stdint.h>

static void seeded_random_func(sqlite3_context *ctx, int argc,
                               sqlite3_value **argv) {
  uint64_t x;
  (void)argc;

  /* NULL propagation: if either arg is NULL, return NULL */
  if (sqlite3_value_type(argv[0]) == SQLITE_NULL ||
      sqlite3_value_type(argv[1]) == SQLITE_NULL) {
    sqlite3_result_null(ctx);
    return;
  }

  /* Golden-ratio seed combining + splitmix64 finalizer */
  x = (uint64_t)sqlite3_value_int64(argv[0]) * UINT64_C(0x9E3779B97F4A7C15) +
      (uint64_t)sqlite3_value_int64(argv[1]);
  x ^= x >> 30;
  x *= UINT64_C(0xBF58476D1CE4E5B9);
  x ^= x >> 27;
  x *= UINT64_C(0x94D049BB133111EB);
  x ^= x >> 31;

  sqlite3_result_int64(ctx, (int64_t)x);
}

#ifdef _WIN32
__declspec(dllexport)
#else
__attribute__((visibility("default")))
#endif
int sqlite3_seededrandom_init(
  sqlite3 *db,
  char **pzErrMsg,
  const sqlite3_api_routines *pApi
){
  SQLITE_EXTENSION_INIT2(pApi);
  (void)pzErrMsg;
  return sqlite3_create_function(db, "seeded_random", 2,
                                 SQLITE_UTF8 | SQLITE_DETERMINISTIC |
                                     SQLITE_INNOCUOUS,
                                 0, seeded_random_func, 0, 0);
}
