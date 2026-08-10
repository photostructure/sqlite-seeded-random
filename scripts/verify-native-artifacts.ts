import { readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

export const EXPECTED_NATIVE_ARTIFACTS = [
  "darwin-arm64/seeded_random.dylib",
  "darwin-x64/seeded_random.dylib",
  "linux-arm64-musl/seeded_random.so",
  "linux-arm64/seeded_random.so",
  "linux-x64-musl/seeded_random.so",
  "linux-x64/seeded_random.so",
  "win32-arm64/seeded_random.dll",
  "win32-x64/seeded_random.dll",
] as const;

const ALLOWED_BUILD_OUTPUTS = new Set([
  "index.d.mts",
  "index.d.ts",
  "index.js",
  "index.mjs",
]);

function toPortablePath(path: string): string {
  return path.split(sep).join("/");
}

function listFiles(root: string, directory = root): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return listFiles(root, path);
    const relativePath = toPortablePath(relative(root, path));
    return [entry.isFile() ? relativePath : `${relativePath} (not a file)`];
  });
}

export function verifyNativeArtifacts(root: string): void {
  const rootStats = statSync(root, { throwIfNoEntry: false });
  if (!rootStats) {
    throw new Error(`Native artifact directory does not exist: ${root}`);
  }
  if (!rootStats.isDirectory()) {
    throw new Error(`Native artifact path is not a directory: ${root}`);
  }

  const expected = new Set<string>(EXPECTED_NATIVE_ARTIFACTS);
  const actual = new Set(listFiles(root));
  const missing = [...expected].filter((path) => !actual.has(path));
  const unexpected = [...actual].filter(
    (path) => !expected.has(path) && !ALLOWED_BUILD_OUTPUTS.has(path),
  );

  if (missing.length === 0 && unexpected.length === 0) return;

  const details = [
    ...missing.map((path) => `missing: ${path}`),
    ...unexpected.map((path) => `unexpected: ${path}`),
  ];
  throw new Error(`Invalid native artifact set:\n${details.join("\n")}`);
}
