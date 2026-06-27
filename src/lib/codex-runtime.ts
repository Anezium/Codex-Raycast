import { existsSync, realpathSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

export type CodexRuntime = {
  command: string;
  args: string[];
  displayPath: string;
  env?: Record<string, string>;
  source: "configured" | "bundled" | "application" | "path";
};

export type CodexRuntimeMode =
  | "auto"
  | "bundled"
  | "application"
  | "path"
  | "custom";

export type CodexRuntimeOptions = {
  mode?: CodexRuntimeMode;
  configuredPath?: string;
};

const LEGACY_CODEX_APP_PATH =
  "/Applications/Codex.app/Contents/Resources/codex";

const PLATFORM_TARGETS: Partial<
  Record<
    NodeJS.Platform,
    Partial<
      Record<NodeJS.Architecture, { packageName: string; triple: string }>
    >
  >
> = {
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

export function resolveCodexRuntime(
  options?: CodexRuntimeOptions | string,
): CodexRuntime {
  const runtimeOptions = normalizeRuntimeOptions(options);
  const normalizedPath = normalizeRuntimePath(runtimeOptions.configuredPath);

  switch (runtimeOptions.mode) {
    case "custom":
      if (!normalizedPath) {
        throw new Error("Custom Codex CLI Path is required");
      }
      return runtimeFromCommand(normalizedPath, normalizedPath, "configured");
    case "bundled":
      return requireRuntime(
        resolvePackagedAssetRuntime() ?? resolveNodeModuleRuntime(),
        "Bundled Codex runtime was not found",
      );
    case "application":
      if (!existsSync(LEGACY_CODEX_APP_PATH)) {
        throw new Error(
          `Codex app runtime was not found at ${LEGACY_CODEX_APP_PATH}`,
        );
      }
      return runtimeFromCommand(
        LEGACY_CODEX_APP_PATH,
        LEGACY_CODEX_APP_PATH,
        "application",
      );
    case "path":
      return runtimeFromCommand("codex", "codex from PATH", "path");
    case "auto":
      break;
  }

  if (normalizedPath && shouldUseConfiguredPath(normalizedPath)) {
    return runtimeFromCommand(normalizedPath, normalizedPath, "configured");
  }

  const bundledRuntime =
    resolvePackagedAssetRuntime() ?? resolveNodeModuleRuntime();
  if (bundledRuntime) {
    return bundledRuntime;
  }

  if (existsSync(LEGACY_CODEX_APP_PATH)) {
    return runtimeFromCommand(
      LEGACY_CODEX_APP_PATH,
      LEGACY_CODEX_APP_PATH,
      "application",
    );
  }

  return runtimeFromCommand("codex", "codex from PATH", "path");
}

export function formatCodexRuntime(
  options?: CodexRuntimeOptions | string,
): string {
  let runtime: CodexRuntime;
  try {
    runtime = resolveCodexRuntime(options);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return `Unavailable: ${message}`;
  }

  switch (runtime.source) {
    case "configured":
      return `Custom path: \`${runtime.displayPath}\``;
    case "bundled":
      return `Bundled runtime: \`${runtime.displayPath}\``;
    case "application":
      return `Codex app: \`${runtime.displayPath}\``;
    case "path":
      return `PATH fallback: \`${runtime.displayPath}\``;
  }
}

function normalizeRuntimeOptions(
  options?: CodexRuntimeOptions | string,
): Required<Pick<CodexRuntimeOptions, "mode">> &
  Pick<CodexRuntimeOptions, "configuredPath"> {
  if (typeof options === "string") {
    return { mode: "auto", configuredPath: options };
  }

  return {
    mode: options?.mode ?? "auto",
    configuredPath: options?.configuredPath,
  };
}

function requireRuntime<T>(runtime: T | undefined, message: string): T {
  if (!runtime) {
    throw new Error(message);
  }

  return runtime;
}

function runtimeFromCommand(
  command: string,
  displayPath: string,
  source: CodexRuntime["source"],
): CodexRuntime {
  return {
    command,
    args: ["app-server", "--stdio"],
    displayPath,
    source,
  };
}

function resolvePackagedAssetRuntime(): CodexRuntime | undefined {
  const target = PLATFORM_TARGETS[process.platform]?.[process.arch];
  if (!target) {
    return undefined;
  }

  for (const packageRoot of getPackagedRuntimeRoots()) {
    const binaryPath = path.join(
      packageRoot,
      "vendor",
      target.triple,
      "bin",
      "codex",
    );
    if (existsSync(binaryPath)) {
      return runtimeFromBundledBinary(binaryPath, packageRoot);
    }
  }

  return undefined;
}

function resolveNodeModuleRuntime(): CodexRuntime | undefined {
  const codexPackageJsonPath = resolvePackageJson("@openai/codex/package.json");
  if (!codexPackageJsonPath) {
    return undefined;
  }

  const nativeRuntime = resolveBundledNativeRuntime(codexPackageJsonPath);
  if (nativeRuntime) {
    return nativeRuntime;
  }

  return resolveBundledWrapperRuntime(codexPackageJsonPath);
}

function resolveBundledNativeRuntime(
  codexPackageJsonPath: string,
): CodexRuntime | undefined {
  const target = PLATFORM_TARGETS[process.platform]?.[process.arch];
  if (!target) {
    return undefined;
  }

  const packageRequire = createRequire(codexPackageJsonPath);
  let nativePackageJsonPath: string;
  try {
    nativePackageJsonPath = packageRequire.resolve(
      `${target.packageName}/package.json`,
    );
  } catch {
    return undefined;
  }

  const binaryPath = path.join(
    path.dirname(nativePackageJsonPath),
    "vendor",
    target.triple,
    "bin",
    "codex",
  );

  if (!existsSync(binaryPath)) {
    return undefined;
  }

  return runtimeFromBundledBinary(
    binaryPath,
    path.dirname(nativePackageJsonPath),
  );
}

function resolveBundledWrapperRuntime(
  codexPackageJsonPath: string,
): CodexRuntime | undefined {
  const wrapperPath = path.join(
    path.dirname(codexPackageJsonPath),
    "bin",
    "codex.js",
  );

  if (!existsSync(wrapperPath)) {
    return undefined;
  }

  return {
    command: process.execPath,
    args: [wrapperPath, "app-server", "--stdio"],
    displayPath: wrapperPath,
    source: "bundled",
  };
}

function resolvePackageJson(packagePath: string): string | undefined {
  const packageRequire = createRequire(__filename);
  try {
    return packageRequire.resolve(packagePath);
  } catch {
    return undefined;
  }
}

function runtimeFromBundledBinary(
  binaryPath: string,
  packageRoot: string,
): CodexRuntime {
  return {
    command: binaryPath,
    args: ["app-server", "--stdio"],
    displayPath: binaryPath,
    env: {
      CODEX_MANAGED_BY_NPM: "1",
      CODEX_MANAGED_PACKAGE_ROOT: safeRealpath(packageRoot),
    },
    source: "bundled",
  };
}

function getPackagedRuntimeRoots(): string[] {
  return uniquePaths([
    path.join(__dirname, "assets", "codex-runtime"),
    path.join(__dirname, "..", "assets", "codex-runtime"),
    path.join(process.cwd(), "assets", "codex-runtime"),
  ]);
}

function uniquePaths(paths: string[]): string[] {
  return Array.from(new Set(paths));
}

function safeRealpath(value: string): string {
  try {
    return realpathSync(value);
  } catch {
    return value;
  }
}

function shouldUseConfiguredPath(pathValue: string): boolean {
  return pathValue !== LEGACY_CODEX_APP_PATH || existsSync(pathValue);
}

function normalizeRuntimePath(value?: string): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}
