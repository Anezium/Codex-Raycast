import { getPreferenceValues } from "@raycast/api";

import type { CodexRuntimeMode, CodexRuntimeOptions } from "./codex-runtime";

export type ReasoningEffort = "low" | "medium" | "high" | "xhigh";
export type SandboxMode =
  | "inherit"
  | "read-only"
  | "workspace-write"
  | "danger-full-access";
export type ApprovalPolicy = "inherit" | "never" | "on-request" | "untrusted";
export type ServiceTier = "inherit" | "default" | "priority";
export type CodexSandboxMode = Exclude<SandboxMode, "inherit">;
export type CodexApprovalPolicy = Exclude<ApprovalPolicy, "inherit">;
export type CodexServiceTier = Exclude<ServiceTier, "inherit">;

type RawExtensionPreferences = {
  codexRuntime?: CodexRuntimeMode;
  codexPath?: string;
  serviceTier?: ServiceTier;
  defaultModel?: string;
  defaultEffort?: ReasoningEffort;
  defaultCwd?: string;
  defaultSandbox?: SandboxMode;
  defaultApprovalPolicy?: ApprovalPolicy;
  defaultSubagents?: boolean;
  fastModel?: string;
  fastEffort?: ReasoningEffort;
  fastSubagents?: boolean;
};

export type ExtensionPreferences = Required<
  Pick<
    RawExtensionPreferences,
    | "defaultModel"
    | "defaultEffort"
    | "defaultSandbox"
    | "defaultApprovalPolicy"
    | "codexRuntime"
    | "serviceTier"
    | "fastModel"
    | "fastEffort"
  >
> &
  Pick<
    RawExtensionPreferences,
    "codexPath" | "defaultCwd" | "defaultSubagents" | "fastSubagents"
  >;

const DEFAULT_PREFERENCES: ExtensionPreferences = {
  codexRuntime: "auto",
  serviceTier: "inherit",
  defaultModel: "gpt-5.5",
  defaultEffort: "medium",
  defaultSandbox: "inherit",
  defaultApprovalPolicy: "inherit",
  fastModel: "gpt-5.5",
  fastEffort: "low",
};

export const MODEL_OPTIONS = [
  { title: "GPT-5.5", value: "gpt-5.5" },
  { title: "GPT-5.4", value: "gpt-5.4" },
  { title: "GPT-5.4 Mini", value: "gpt-5.4-mini" },
  { title: "GPT-5.3 Codex Spark", value: "gpt-5.3-codex-spark" },
];

export const EFFORT_OPTIONS: Array<{ title: string; value: ReasoningEffort }> =
  [
    { title: "Low", value: "low" },
    { title: "Medium", value: "medium" },
    { title: "High", value: "high" },
    { title: "Extra High", value: "xhigh" },
  ];

export function getCodexPreferences(): ExtensionPreferences {
  const preferences = getPreferenceValues<RawExtensionPreferences>();

  return {
    codexRuntime: preferences.codexRuntime ?? DEFAULT_PREFERENCES.codexRuntime,
    codexPath: normalizeOptionalString(preferences.codexPath),
    serviceTier: preferences.serviceTier ?? DEFAULT_PREFERENCES.serviceTier,
    defaultModel:
      normalizeOptionalString(preferences.defaultModel) ??
      DEFAULT_PREFERENCES.defaultModel,
    defaultEffort:
      preferences.defaultEffort ?? DEFAULT_PREFERENCES.defaultEffort,
    defaultCwd: normalizeOptionalString(preferences.defaultCwd),
    defaultSandbox:
      preferences.defaultSandbox ?? DEFAULT_PREFERENCES.defaultSandbox,
    defaultApprovalPolicy:
      preferences.defaultApprovalPolicy ??
      DEFAULT_PREFERENCES.defaultApprovalPolicy,
    defaultSubagents: preferences.defaultSubagents,
    fastModel:
      normalizeOptionalString(preferences.fastModel) ??
      DEFAULT_PREFERENCES.fastModel,
    fastEffort: preferences.fastEffort ?? DEFAULT_PREFERENCES.fastEffort,
    fastSubagents: preferences.fastSubagents,
  };
}

export function getCodexRuntimeOptions(
  preferences: Pick<ExtensionPreferences, "codexRuntime" | "codexPath">,
): CodexRuntimeOptions {
  return {
    mode: preferences.codexRuntime,
    configuredPath: preferences.codexPath,
  };
}

export function normalizeOptionalString(
  value?: string | null,
): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

export function normalizeSandboxMode(
  value: SandboxMode,
): CodexSandboxMode | undefined {
  return value === "inherit" ? undefined : value;
}

export function normalizeApprovalPolicy(
  value: ApprovalPolicy,
): CodexApprovalPolicy | undefined {
  return value === "inherit" ? undefined : value;
}

export function normalizeServiceTier(
  value: ServiceTier,
): CodexServiceTier | undefined {
  return value === "inherit" ? undefined : value;
}
