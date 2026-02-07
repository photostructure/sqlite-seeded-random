import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["cjs", "esm"],
  dts: true,
  clean: false, // don't wipe dist/ — native binaries live there
  outDir: "dist",
  shims: true, // provides import.meta.url shim for CJS
});
