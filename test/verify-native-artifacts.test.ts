import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import {
  EXPECTED_NATIVE_ARTIFACTS,
  verifyNativeArtifacts,
} from "../scripts/verify-native-artifacts";

describe("verifyNativeArtifacts", () => {
  let root: string;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "sqlite-seeded-random-artifacts-"));
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  function addFile(relativePath: string): void {
    const path = join(root, ...relativePath.split("/"));
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, relativePath);
  }

  function addExpectedArtifacts(except?: string): void {
    for (const path of EXPECTED_NATIVE_ARTIFACTS) {
      if (path !== except) addFile(path);
    }
  }

  test("accepts exactly the expected native artifacts", () => {
    addExpectedArtifacts();
    addFile("index.js");

    expect(() => verifyNativeArtifacts(root)).not.toThrow();
  });

  test("names a missing target in the error", () => {
    const missing = "linux-x64/seeded_random.so";
    addExpectedArtifacts(missing);

    expect(() => verifyNativeArtifacts(root)).toThrow(missing);
  });

  test("rejects an unexpected file", () => {
    addExpectedArtifacts();
    const unexpected = "debug-symbols.txt";
    addFile(unexpected);

    expect(() => verifyNativeArtifacts(root)).toThrow(
      `unexpected: ${unexpected}`,
    );
  });

  test("rejects a native binary outside an expected target directory", () => {
    addExpectedArtifacts();
    const unexpected = "seeded_random.so";
    addFile(unexpected);

    expect(() => verifyNativeArtifacts(root)).toThrow(
      `unexpected: ${unexpected}`,
    );
  });

  test("fails when the artifact directory is absent", () => {
    const absent = join(root, "absent");

    expect(() => verifyNativeArtifacts(absent)).toThrow(
      `Native artifact directory does not exist: ${absent}`,
    );
  });
});
