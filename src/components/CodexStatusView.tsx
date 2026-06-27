import {
  Action,
  ActionPanel,
  Detail,
  Icon,
  Toast,
  open,
  openExtensionPreferences,
  showToast,
} from "@raycast/api";
import { useEffect, useMemo, useState } from "react";

import { CodexAppServerClient } from "../lib/codex-client";
import { formatCodexRuntime } from "../lib/codex-runtime";
import { showFailure } from "../lib/format";
import {
  getCodexPreferences,
  getCodexRuntimeOptions,
} from "../lib/preferences";
import type { AccountReadResponse, AuthStatusResponse } from "../lib/types";

type StatusState = {
  account?: AccountReadResponse;
  auth?: AuthStatusResponse;
  loginMessage?: string;
  isLoading: boolean;
};

export function CodexStatusView() {
  const preferences = useMemo(() => getCodexPreferences(), []);
  const [state, setState] = useState<StatusState>({ isLoading: true });

  async function refresh() {
    setState((current) => ({ ...current, isLoading: true }));
    let client: CodexAppServerClient | undefined;
    try {
      client = await CodexAppServerClient.connect(
        getCodexRuntimeOptions(preferences),
      );
      const [account, auth] = await Promise.all([
        client.readAccount(false),
        client.getAuthStatus(),
      ]);
      setState((current) => ({ ...current, account, auth, isLoading: false }));
    } catch (error) {
      setState((current) => ({ ...current, isLoading: false }));
      await showFailure("Could not read Codex status", error);
    } finally {
      client?.dispose();
    }
  }

  async function startLogin(type: "chatgpt" | "device") {
    setState((current) => ({
      ...current,
      isLoading: true,
      loginMessage: undefined,
    }));
    let client: CodexAppServerClient | undefined;
    try {
      client = await CodexAppServerClient.connect(
        getCodexRuntimeOptions(preferences),
      );
      const response =
        type === "chatgpt"
          ? await client.startChatGptLogin()
          : await client.startDeviceCodeLogin();

      if (response.type === "chatgpt") {
        await open(response.authUrl);
        setState((current) => ({
          ...current,
          isLoading: false,
          loginMessage: `Opened browser OAuth login. Login ID: ${response.loginId}`,
        }));
      } else if (response.type === "chatgptDeviceCode") {
        await open(response.verificationUrl);
        setState((current) => ({
          ...current,
          isLoading: false,
          loginMessage: `Opened device-code login. Enter code: ${response.userCode}`,
        }));
      } else {
        setState((current) => ({
          ...current,
          isLoading: false,
          loginMessage: "Login started.",
        }));
      }

      await showToast({ style: Toast.Style.Success, title: "Login started" });
    } catch (error) {
      setState((current) => ({ ...current, isLoading: false }));
      await showFailure("Could not start login", error);
    } finally {
      client?.dispose();
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  return (
    <Detail
      isLoading={state.isLoading}
      markdown={formatStatusMarkdown(
        getCodexRuntimeOptions(preferences),
        state,
      )}
      actions={
        <ActionPanel>
          <Action
            title="Refresh"
            icon={Icon.ArrowClockwise}
            onAction={refresh}
          />
          <Action
            title="Start ChatGPT OAuth Login"
            icon={Icon.PersonCircle}
            onAction={() => startLogin("chatgpt")}
          />
          <Action
            title="Start Device Code Login"
            icon={Icon.Key}
            onAction={() => startLogin("device")}
          />
          <Action
            title="Open Extension Preferences"
            icon={Icon.Gear}
            onAction={openExtensionPreferences}
          />
        </ActionPanel>
      }
    />
  );
}

function formatStatusMarkdown(
  runtimeOptions: ReturnType<typeof getCodexRuntimeOptions>,
  state: StatusState,
): string {
  const account = state.account?.account;
  const accountLine = !account
    ? "Not signed in"
    : account.type === "chatgpt"
      ? `ChatGPT${account.email ? ` (${account.email})` : ""}`
      : account.type;

  return [
    "# Codex Status",
    "",
    `**Codex Runtime:** ${formatCodexRuntime(runtimeOptions)}  `,
    `**Account:** ${accountLine}  `,
    `**Auth Method:** ${state.auth?.authMethod ?? "Unknown"}  `,
    `**Requires OpenAI Auth:** ${String(state.account?.requiresOpenaiAuth ?? state.auth?.requiresOpenaiAuth ?? "Unknown")}`,
    state.loginMessage ? `\n## Login\n${state.loginMessage}` : "",
  ].join("\n");
}
