# sqlite-seeded-random

Deterministic seeded hash function for SQLite, designed for stable `ORDER BY` randomization.

```sql
SELECT * FROM items ORDER BY seeded_random(42, id);
```

Same seed + same id = same result, every time. Different seeds produce different orderings. Unlike stateful PRNGs (e.g. `sqlite-fastrand`), this is a pure hash function — results don't depend on row evaluation order.

## Algorithm

[Splitmix64](https://xoshiro.di.unimi.it/splitmix64.c) finalizer with golden-ratio seed combining:

```
x = seed * 0x9E3779B97F4A7C15 + id
x ^= x >> 30; x *= 0xBF58476D1CE4E5B9;
x ^= x >> 27; x *= 0x94D049BB133111EB;
x ^= x >> 31;
```

Returns a signed 64-bit integer. Passes chi-squared uniformity tests across sequential and sparse ID distributions.

## Installation

```sh
npm install @photostructure/sqlite-seeded-random
```

Pre-built binaries are included for:

- Linux x64, ARM64 (glibc and musl)
- macOS x64, ARM64
- Windows x64, ARM64

## Usage

### With [@photostructure/sqlite](https://github.com/photostructure/node-sqlite)

```typescript
import { DatabaseSync } from "@photostructure/sqlite";
import { load } from "@photostructure/sqlite-seeded-random";

const db = new DatabaseSync("my.db", { allowExtension: true });
db.enableLoadExtension(true);
load(db);
db.enableLoadExtension(false);

// Deterministic shuffle — same seed always produces the same order
const rows = db
  .prepare("SELECT * FROM photos ORDER BY seeded_random(42, id)")
  .all();
```

### With [better-sqlite3](https://github.com/WiseLibs/better-sqlite3)

```javascript
const Database = require("better-sqlite3");
const { load } = require("@photostructure/sqlite-seeded-random");

const db = new Database("my.db");
load(db);

const rows = db
  .prepare("SELECT * FROM photos ORDER BY seeded_random(?, id)")
  .all(seed);
```

### Direct loading

```javascript
const { getLoadablePath } = require("@photostructure/sqlite-seeded-random");

// Returns the absolute path to the platform-specific .so/.dylib/.dll
const extensionPath = getLoadablePath();
```

## API

### `seeded_random(seed INTEGER, id INTEGER) → INTEGER`

- **seed**: Controls the shuffle order. Different seeds produce different orderings.
- **id**: Typically a row's primary key.
- Returns a signed 64-bit integer.
- `SQLITE_DETERMINISTIC` — safe for use in indexes and cached by the query optimizer.
- `SQLITE_INNOCUOUS` — usable in views and triggers without elevated trust.
- NULL propagation: if either argument is NULL, returns NULL.

## Building from source

```sh
make            # produces dist/seeded_random.so (or .dylib on macOS)
npm run build   # builds native extension + JS/TS wrapper via tsup
npm test        # builds JS wrapper and runs the test suite
```

Requires a C compiler (gcc or clang) and Node.js 18+.

## License

MIT
