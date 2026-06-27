import {
  Action,
  ActionPanel,
  Detail,
  Form,
  Icon,
  Toast,
  showToast,
  useNavigation,
} from "@raycast/api";
import { useEffect, useMemo, useRef, useState } from "react";

import { CodexAppServerClient } from "../lib/codex-client";
import { showFailure } from "../lib/format";
import {
  getCodexPreferences,
  getCodexRuntimeOptions,
  normalizeApprovalPolicy,
  normalizeOptionalString,
  normalizeSandboxMode,
  normalizeServiceTier,
} from "../lib/preferences";
import { rememberLastThread } from "../lib/storage";
import { withSubagentInstruction } from "../lib/subagents";

type Props = {
  threadId?: string;
  topicName?: string;
  prompt: string;
  model: string;
  effort: string;
  cwd?: string;
  useSubagents: boolean;
};

type ChatMessage = {
  id: string;
  role: "user" | "codex";
  text: string;
  isError?: boolean;
};

type RunState = {
  threadId?: string;
  messages: ChatMessage[];
  status: string;
  isLoading: boolean;
  useSubagents: boolean;
};

type ReplyValues = {
  message: string;
  useSubagents: boolean;
};

const INITIAL_USER_MESSAGE_ID = "initial-user-message";
const INITIAL_CODEX_MESSAGE_ID = "initial-codex-message";

export function RunTurnView(props: Props) {
  const preferences = useMemo(() => getCodexPreferences(), []);
  const clientRef = useRef<CodexAppServerClient | undefined>(undefined);
  const nextMessageIdRef = useRef(1);
  const [state, setState] = useState<RunState>({
    threadId: props.threadId,
    messages: [
      { id: INITIAL_USER_MESSAGE_ID, role: "user", text: props.prompt.trim() },
      { id: INITIAL_CODEX_MESSAGE_ID, role: "codex", text: "" },
    ],
    status: "Connecting",
    isLoading: true,
    useSubagents: props.useSubagents,
  });

  const cwd =
    normalizeOptionalString(props.cwd) ??
    normalizeOptionalString(preferences.defaultCwd);
  const sandbox = normalizeSandboxMode(preferences.defaultSandbox);
  const approvalPolicy = normalizeApprovalPolicy(
    preferences.defaultApprovalPolicy,
  );
  const serviceTier = normalizeServiceTier(preferences.serviceTier);

  useEffect(() => {
    let isCancelled = false;

    async function run() {
      const prompt = withSubagentInstruction(props.prompt, props.useSubagents);

      try {
        const client = await CodexAppServerClient.connect(
          getCodexRuntimeOptions(preferences),
        );
        clientRef.current = client;

        let threadId = props.threadId;
        if (threadId) {
          setStatus("Resuming topic");
          await client.resumeThread({
            threadId,
            model: props.model,
            cwd,
            sandbox,
            approvalPolicy,
            serviceTier,
          });
        } else {
          setStatus("Creating topic");
          const response = await client.startThread({
            model: props.model,
            cwd,
            sandbox,
            approvalPolicy,
            serviceTier,
          });
          threadId = response.thread.id;

          const topicName = normalizeOptionalString(props.topicName);
          if (topicName) {
            await client.setThreadName(threadId, topicName);
          }
        }

        await rememberLastThread(threadId);

        if (!isCancelled) {
          setState((current) => ({
            ...current,
            threadId,
            status: "Starting turn",
          }));
        }

        const output = await client.startTurnAndStream({
          threadId,
          prompt,
          model: props.model,
          effort: props.effort,
          cwd,
          sandbox,
          approvalPolicy,
          serviceTier,
          onDelta: (delta) => {
            if (!isCancelled) {
              appendMessageText(INITIAL_CODEX_MESSAGE_ID, delta);
            }
          },
          onStatus: (status) => {
            if (!isCancelled) {
              setStatus(status);
            }
          },
        });

        if (!isCancelled) {
          finishTurn(INITIAL_CODEX_MESSAGE_ID, output);
        }
      } catch (error) {
        if (!isCancelled) {
          failTurn(INITIAL_CODEX_MESSAGE_ID, "Codex turn failed", error);
        }
      }
    }

    run();

    return () => {
      isCancelled = true;
      clientRef.current?.dispose();
    };
  }, [
    preferences.codexPath,
    preferences.codexRuntime,
    preferences.defaultApprovalPolicy,
    preferences.defaultCwd,
    preferences.defaultSandbox,
    preferences.serviceTier,
    props.cwd,
    props.effort,
    props.model,
    props.prompt,
    props.threadId,
    props.topicName,
    props.useSubagents,
    approvalPolicy,
    cwd,
    sandbox,
    serviceTier,
  ]);

  async function sendReply(message: string, useSubagents: boolean) {
    const threadId = state.threadId;
    const client = clientRef.current;

    if (!threadId || !client) {
      await showFailure("Could not send reply", "Codex is not connected");
      return;
    }

    const userMessageId = createMessageId("user");
    const codexMessageId = createMessageId("codex");
    const prompt = withSubagentInstruction(message, useSubagents);

    setState((current) => ({
      ...current,
      messages: [
        ...current.messages,
        { id: userMessageId, role: "user", text: message },
        { id: codexMessageId, role: "codex", text: "" },
      ],
      useSubagents,
      status: "Starting turn",
      isLoading: true,
    }));

    try {
      setStatus("Resuming topic");
      await client.resumeThread({
        threadId,
        model: props.model,
        cwd,
        sandbox,
        approvalPolicy,
        serviceTier,
      });

      const output = await client.startTurnAndStream({
        threadId,
        prompt,
        model: props.model,
        effort: props.effort,
        cwd,
        sandbox,
        approvalPolicy,
        serviceTier,
        onDelta: (delta) => appendMessageText(codexMessageId, delta),
        onStatus: setStatus,
      });

      finishTurn(codexMessageId, output);
    } catch (error) {
      failTurn(codexMessageId, "Codex reply failed", error);
    }
  }

  function setStatus(status: string) {
    setState((current) => ({ ...current, status }));
  }

  function appendMessageText(messageId: string, delta: string) {
    setState((current) => ({
      ...current,
      messages: current.messages.map((message) =>
        message.id === messageId
          ? { ...message, text: message.text + delta }
          : message,
      ),
    }));
  }

  function finishTurn(messageId: string, output: string) {
    setState((current) => ({
      ...current,
      messages: current.messages.map((message) =>
        message.id === messageId ? { ...message, text: output } : message,
      ),
      status: "Completed",
      isLoading: false,
    }));
    showToast({ style: Toast.Style.Success, title: "Codex finished" });
  }

  function failTurn(messageId: string, title: string, error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    setState((current) => ({
      ...current,
      messages: current.messages.map((chatMessage) =>
        chatMessage.id === messageId
          ? {
              ...chatMessage,
              text: `Error: ${message}${chatMessage.text ? `\n\n${chatMessage.text}` : ""}`,
              isError: true,
            }
          : chatMessage,
      ),
      status: "Failed",
      isLoading: false,
    }));
    showFailure(title, error);
  }

  function createMessageId(prefix: string): string {
    const id = nextMessageIdRef.current;
    nextMessageIdRef.current += 1;
    return `${prefix}-${id}`;
  }

  const latestResponse = getLatestCodexResponse(state.messages);
  const title = props.topicName || (props.threadId ? "Continue Topic" : "Ask");

  return (
    <Detail
      isLoading={state.isLoading}
      markdown={formatConversationMarkdown(title, state, props, serviceTier)}
      actions={
        <ActionPanel>
          {state.threadId && !state.isLoading ? (
            <Action.Push
              title="Reply"
              icon={Icon.Message}
              target={
                <ReplyForm
                  defaultSubagents={state.useSubagents}
                  onSubmit={sendReply}
                />
              }
            />
          ) : null}
          {latestResponse ? (
            <Action.CopyToClipboard
              title="Copy Last Response"
              content={latestResponse}
              icon={Icon.Clipboard}
            />
          ) : null}
          <Action.CopyToClipboard
            title="Copy Conversation"
            content={formatConversation(state.messages)}
            icon={Icon.Text}
          />
          {state.threadId ? (
            <Action.CopyToClipboard
              title="Copy Thread ID"
              content={state.threadId}
              icon={Icon.Tag}
            />
          ) : null}
        </ActionPanel>
      }
    />
  );
}

function ReplyForm(props: {
  defaultSubagents: boolean;
  onSubmit: (message: string, useSubagents: boolean) => void | Promise<void>;
}) {
  const { pop } = useNavigation();

  async function handleSubmit(values: ReplyValues) {
    const message = values.message.trim();
    if (!message) {
      await showToast({
        style: Toast.Style.Failure,
        title: "Message is required",
      });
      return;
    }

    pop();
    await props.onSubmit(message, values.useSubagents);
  }

  return (
    <Form
      actions={
        <ActionPanel>
          <Action.SubmitForm
            title="Send Reply"
            icon={Icon.Message}
            onSubmit={handleSubmit}
          />
        </ActionPanel>
      }
    >
      <Form.TextArea
        id="message"
        title="Reply"
        placeholder="Reply to Codex..."
        autoFocus
      />
      <Form.Checkbox
        id="useSubagents"
        title="Subagents"
        label="Ask Codex to spin up subagents"
        defaultValue={props.defaultSubagents}
      />
    </Form>
  );
}

function formatConversationMarkdown(
  title: string,
  state: RunState,
  props: Props,
  serviceTier: string | undefined,
): string {
  const lines = [
    `# ${title}`,
    "",
    `**Status:** ${state.status}  `,
    `**Model:** \`${props.model}\`  `,
    `**Thinking:** \`${props.effort}\`  `,
    `**Speed:** ${formatServiceTier(serviceTier)}  `,
    `**Subagents:** ${state.useSubagents ? "Requested" : "Off"}`,
  ];

  if (state.threadId) {
    lines.push(`**Thread:** \`${state.threadId}\``);
  }

  lines.push("", "---");

  for (const message of state.messages) {
    lines.push(
      "",
      `## ${message.role === "user" ? "You" : "Codex"}`,
      formatMessageText(message, state),
    );
  }

  return lines.join("\n");
}

function formatMessageText(message: ChatMessage, state: RunState): string {
  if (message.text.trim()) {
    return message.text.trim();
  }

  if (message.role === "codex" && state.isLoading) {
    return "_Waiting for Codex..._";
  }

  return message.isError ? "_Error_" : "";
}

function formatServiceTier(serviceTier: string | undefined): string {
  switch (serviceTier) {
    case "default":
      return "Standard";
    case "priority":
      return "Fast";
    default:
      return "Codex Config";
  }
}

function getLatestCodexResponse(messages: ChatMessage[]): string | undefined {
  return [...messages]
    .reverse()
    .find((message) => message.role === "codex" && message.text.trim())
    ?.text.trim();
}

function formatConversation(messages: ChatMessage[]): string {
  return messages
    .map((message) => {
      const title = message.role === "user" ? "You" : "Codex";
      return `## ${title}\n${message.text.trim()}`;
    })
    .join("\n\n");
}
