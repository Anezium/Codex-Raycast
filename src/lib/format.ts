import { showToast, Toast } from "@raycast/api";

import type { CodexThread, ThreadItem, UserInput } from "./types";

export function formatThreadTitle(
  thread: Pick<CodexThread, "name" | "preview" | "id">,
): string {
  return (
    thread.name?.trim() ||
    firstLine(thread.preview) ||
    `Thread ${thread.id.slice(0, 8)}`
  );
}

export function formatTimestamp(timestamp?: number | null): string {
  if (!timestamp) {
    return "Unknown";
  }

  return new Date(timestamp * 1000).toLocaleString();
}

export function formatThreadMarkdown(thread: CodexThread): string {
  const lines: string[] = [
    `# ${formatThreadTitle(thread)}`,
    "",
    `**Thread:** \`${thread.id}\`  `,
    `**Model Provider:** ${thread.modelProvider || "Unknown"}  `,
    `**Updated:** ${formatTimestamp(thread.updatedAt)}  `,
    `**Source:** ${thread.source || "Unknown"}`,
    "",
    "---",
  ];

  const items = thread.turns.flatMap((turn) => turn.items);
  if (items.length === 0) {
    lines.push("", "_No messages loaded yet._");
    return lines.join("\n");
  }

  for (const item of items) {
    const rendered = formatThreadItem(item);
    if (rendered) {
      lines.push("", rendered);
    }
  }

  return lines.join("\n");
}

export function formatRunMarkdown(input: {
  title: string;
  prompt: string;
  output: string;
  model: string;
  effort: string;
  status: string;
  threadId?: string;
  useSubagents: boolean;
}): string {
  const parts = [
    `# ${input.title}`,
    "",
    `**Status:** ${input.status}  `,
    `**Model:** \`${input.model}\`  `,
    `**Thinking:** \`${input.effort}\`  `,
    `**Subagents:** ${input.useSubagents ? "Requested" : "Off"}`,
  ];

  if (input.threadId) {
    parts.push(`**Thread:** \`${input.threadId}\``);
  }

  parts.push(
    "",
    "## You",
    input.prompt.trim(),
    "",
    "## Codex",
    input.output.trim() || "_Waiting for Codex..._",
  );

  return parts.join("\n");
}

export async function showFailure(title: string, error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  await showToast({ style: Toast.Style.Failure, title, message });
}

function formatThreadItem(item: ThreadItem): string | undefined {
  switch (item.type) {
    case "userMessage":
      return `## You\n${formatUserInput(item.content) || "_Empty message_"}`;
    case "agentMessage":
      return `## Codex\n${item.text || "_Empty response_"}`;
    case "plan":
      return `### Plan\n${item.text}`;
    case "reasoning":
      return item.summary.length > 0
        ? `### Reasoning\n${item.summary.join("\n")}`
        : undefined;
    case "commandExecution":
      return `### Command\n\`\`\`bash\n${item.command}\n\`\`\`\n${item.aggregatedOutput ? `\`\`\`\n${item.aggregatedOutput}\n\`\`\`` : ""}`;
    case "collabAgentToolCall":
      return `### Subagent Activity\n${item.tool} · ${item.status}`;
    case "subAgentActivity":
      return `### Subagent\n${item.kind} · \`${item.agentThreadId}\``;
    case "webSearch":
      return `### Web Search\n${item.query}`;
    default:
      return undefined;
  }
}

function formatUserInput(content: UserInput[]): string {
  return content
    .map((input) => {
      if (input.type === "text") {
        return input.text;
      }
      if (input.type === "localImage") {
        return `[Local image: ${input.path}]`;
      }
      if (input.type === "image") {
        return `[Image: ${input.url}]`;
      }
      if (input.type === "mention" || input.type === "skill") {
        return `[@${input.name}](${input.path})`;
      }
      return "";
    })
    .filter(Boolean)
    .join("\n\n");
}

function firstLine(value: string): string {
  return value.trim().split(/\r?\n/)[0]?.trim() ?? "";
}
