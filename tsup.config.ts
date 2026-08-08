import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["cjs", "esm"],
  // Declarations come from `tsc -p tsconfig.build.json`, not from tsup: tsup's
  // dts worker injects `baseUrl` into the compiler options unconditionally
  // (8.5.1, dist/rollup.js), which TypeScript 6 rejects as deprecated.
  dts: false,
  clean: false, // don't wipe dist/ — native binaries live there
  outDir: "dist",
  shims: true, // provides import.meta.url shim for CJS
});
