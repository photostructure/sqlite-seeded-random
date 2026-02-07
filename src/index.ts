import { readdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { arch, platform } from "node:process";
import { fileURLToPath } from "node:url";

const ENTRYPOINT = "sqlite3_seededrandom_init";
const ENTRYPOINT_BASE_NAME = "seeded_random";

const SUPPORTED_PLATFORMS = [
  "darwin-x64",
  "darwin-arm64",
  "linux-x64",
  "linux-x64-musl",
  "linux-arm64",
  "linux-arm64-musl",
  "win32-x64",
  "win32-arm64",
] as const;

function extensionSuffix(): string {
  if (platform === "win32") return "dll";
  if (platform === "darwin") return "dylib";
  return "so";
}

/**
 * Detect if running on musl libc (Alpine Linux, etc.)
 * Uses detect-libc's primary heuristic: check for musl dynamic linker
 */
function isMusl(): boolean {
  if (platform !== "linux") return false;
  try {
    const files = readdirSync("/lib");
    return files.some((f) => f.startsWith("ld-musl-"));
  } catch {
    return false;
  }
}

/**
 * When running inside an Electron app packaged with ASAR, native extensions
 * are unpacked to app.asar.unpacked/. Replace the path segment so
 * db.loadExtension() can find the real file on disk.
 * Outside Electron this is a no-op (paths never contain "app.asar").
 */
function asarUnpack(filePath: string): string {
  return filePath.replace("app.asar", "app.asar.unpacked");
}

function getPackageRoot(): string {
  // In CJS, __dirname is available. In ESM, we derive from import.meta.url.
  // tsup injects the appropriate shim for each format.
  return join(dirname(fileURLToPath(import.meta.url)), "..");
}

export interface Db {
  loadExtension(file: string, entrypoint?: string): void;
}

/**
 * Returns the full path to the sqlite-seeded-random loadable extension
 * bundled with this package.
 */
export function getLoadablePath(): string {
  const platformDir =
    platform === "linux" && isMusl()
      ? `${platform}-${arch}-musl`
      : `${platform}-${arch}`;
  const filename = `${ENTRYPOINT_BASE_NAME}.${extensionSuffix()}`;
  const root = getPackageRoot();

  // Published package layout: dist/<platform-arch>/seeded_random.<ext>
  const platformPath = join(root, "dist", platformDir, filename);
  if (statSync(platformPath, { throwIfNoEntry: false })) {
    return asarUnpack(platformPath);
  }

  // Local dev layout from `make loadable`: dist/seeded_random.<ext>
  const devPath = join(root, "dist", filename);
  if (statSync(devPath, { throwIfNoEntry: false })) {
    return asarUnpack(devPath);
  }

  throw new Error(
    `Loadable extension for sqlite-seeded-random not found for ${platformDir} at ${platformPath}. ` +
      `Supported platforms: ${SUPPORTED_PLATFORMS.join(", ")}.`,
  );
}

/**
 * Load the sqlite-seeded-random extension into a SQLite database connection.
 */
export function load(db: Db): void {
  db.loadExtension(getLoadablePath(), ENTRYPOINT);
}
