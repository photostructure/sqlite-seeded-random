# Changelog

## 0.2.0

- Added Electron ASAR support: `getLoadablePath()` automatically resolves
  `app.asar.unpacked` paths for packaged Electron apps
- Streamlined CI workflow by consolidating lint and test jobs
- Updated README to document Node.js 20+ requirement and Electron configuration

## 0.1.1

- Initial release
- Deterministic seeded hash function (`seeded_random(seed, id)`) using splitmix64
- Pre-built binaries for Linux (x64/ARM64, glibc/musl), macOS (x64/ARM64),
  and Windows (x64/ARM64)
- Dual CJS/ESM package with TypeScript declarations
- `load(db)` helper for better-sqlite3 and @photostructure/sqlite
