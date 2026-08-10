import { verifyNativeArtifacts } from "./verify-native-artifacts.ts";

const root = process.argv[2] ?? "dist";

try {
  verifyNativeArtifacts(root);
  console.log("Native artifact set is exact.");
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
