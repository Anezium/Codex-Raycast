import { chmodSync, cpSync, existsSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");

const PLATFORM_TARGETS = {
  darwin: {
    arm64: {
      packageName: "@openai/codex-darwin-arm64",
      triple: "aarch64-apple-darwin",
    },
    x64: {
      packageName: "@openai/codex-darwin-x64",
      triple: "x86_64-apple-darwin",
    },
  },
};

const target = PLATFORM_TARGETS[process.platform]?.[process.arch];
if (!target) {
  throw new Error(
    `Unsupported Codex runtime target: ${process.platform}/${process.arch}`,
  );
}

const requireFromScript = createRequire(import.meta.url);
const codexPackageJsonPath = requireFromScript.resolve(
  "@openai/codex/package.json",
);
const requireFromCodex = createRequire(codexPackageJsonPath);
const nativePackageJsonPath = requireFromCodex.resolve(
  `${target.packageName}/package.json`,
);

const sourceVendorPath = path.join(
  path.dirname(nativePackageJsonPath),
  "vendor",
  target.triple,
);
const targetVendorRoot = path.join(
  projectRoot,
  "assets",
  "codex-runtime",
  "vendor",
);
const targetVendorPath = path.join(targetVendorRoot, target.triple);

if (!existsSync(sourceVendorPath)) {
  throw new Error(
    `Missing Codex runtime vendor directory: ${sourceVendorPath}`,
  );
}

rmSync(targetVendorRoot, { recursive: true, force: true });
cpSync(sourceVendorPath, targetVendorPath, { recursive: true });

for (const executablePath of [
  path.join(targetVendorPath, "bin", "codex"),
  path.join(targetVendorPath, "codex-path", "rg"),
]) {
  if (existsSync(executablePath)) {
    chmodSync(executablePath, 0o755);
  }
}

console.log(`Prepared Codex runtime ${target.triple}`);
