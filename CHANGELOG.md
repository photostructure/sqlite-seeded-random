# Changelog

## [Unreleased (patch)]

- GitHub releases now wait for npm to serve the approved package, and carry
  these release notes.

## [1.0.2] - 2026-08-10

- Hardened release packaging by rejecting missing, misplaced, or unexpected
  native artifacts before npm staging and using GitHub Actions' verified
  artifact transfers
- Prevented native sanitizer checks from hanging by selecting a stable SQLite
  executable and enforcing a configurable timeout

## [1.0.1] - 2026-08-09

- Raised the minimum supported Node.js version from 20 to 22
- Replaced direct npm publishing with signed, tag-bound staged publishing,
  exact package-boundary verification, and installed-package tests for all
  eight native targets

## [0.2.1] - 2026-02-24

- Added Windows security hardening compiler flags (`/sdl`, `/guard:cf`,
  `/Qspectre` on x64, `/ZH:SHA_256`) and linker flags (`/DYNAMICBASE`,
  `/NXCOMPAT`, `/guard:cf`, `/CETCOMPAT` on x64) to CI builds

## [0.2.0] - 2026-02-07

- Added Electron ASAR support: `getLoadablePath()` automatically resolves
  `app.asar.unpacked` paths for packaged Electron apps
- Streamlined CI workflow by consolidating lint and test jobs
- Updated README to document Node.js 20+ requirement and Electron configuration

## [0.1.1] - 2026-02-07

- Initial release
- Deterministic seeded hash function (`seeded_random(seed, id)`) using splitmix64
- Pre-built binaries for Linux (x64/ARM64, glibc/musl), macOS (x64/ARM64),
  and Windows (x64/ARM64)
- Dual CJS/ESM package with TypeScript declarations
- `load(db)` helper for better-sqlite3 and @photostructure/sqlite

[1.0.2]: https://github.com/photostructure/sqlite-seeded-random/releases/tag/v1.0.2
[1.0.1]: https://github.com/photostructure/sqlite-seeded-random/releases/tag/v1.0.1
[0.2.1]: https://github.com/photostructure/sqlite-seeded-random/releases/tag/v0.2.1
[0.2.0]: https://github.com/photostructure/sqlite-seeded-random/releases/tag/v0.2.0
[0.1.1]: https://github.com/photostructure/sqlite-seeded-random/releases/tag/v0.1.1
