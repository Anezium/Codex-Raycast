import { Action, ActionPanel, Icon, List } from "@raycast/api";
import { useEffect, useMemo, useState } from "react";

import { NewChatForm } from "./components/NewChatForm";
import { ThreadDetailView } from "./components/ThreadDetailView";
import { CodexAppServerClient } from "./lib/codex-client";
import { formatThreadTitle, formatTimestamp, showFailure } from "./lib/format";
import { getCodexPreferences, getCodexRuntimeOptions } from "./lib/preferences";
import { getLastThreadId } from "./lib/storage";
import type { CodexThread } from "./lib/types";

export default function ChatCommand() {
  const preferences = useMemo(() => getCodexPreferences(), []);
  const [threads, setThreads] = useState<CodexThread[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchText, setSearchText] = useState("");
  const [lastThreadId, setLastThreadId] = useState<string>();

  async function loadThreads() {
    setIsLoading(true);
    let client: CodexAppServerClient | undefined;
    try {
      const remembered = await getLastThreadId();
      setLastThreadId(remembered);

      client = await CodexAppServerClient.connect(
        getCodexRuntimeOptions(preferences),
      );
      const response = await client.listThreads(50);
      setThreads(response.data);
    } catch (error) {
      await showFailure("Could not load Codex topics", error);
    } finally {
      client?.dispose();
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadThreads();
  }, []);

  const filteredThreads = threads.filter((thread) => {
    const needle = searchText.trim().toLowerCase();
    if (!needle) {
      return true;
    }

    return [thread.name, thread.preview, thread.id, thread.cwd].some((value) =>
      String(value ?? "")
        .toLowerCase()
        .includes(needle),
    );
  });

  return (
    <List
      isLoading={isLoading}
      searchBarPlaceholder="Search Codex topics..."
      onSearchTextChange={setSearchText}
      throttle
      actions={
        <ActionPanel>
          <Action.Push
            title="New Chat"
            icon={Icon.Plus}
            target={<NewChatForm />}
          />
          <Action
            title="Refresh"
            icon={Icon.ArrowClockwise}
            onAction={loadThreads}
          />
        </ActionPanel>
      }
    >
      <List.EmptyView
        icon={Icon.Message}
        title={isLoading ? "Loading Topics" : "No Topics"}
        actions={
          <ActionPanel>
            <Action.Push
              title="New Chat"
              icon={Icon.Plus}
              target={<NewChatForm />}
            />
            <Action
              title="Refresh"
              icon={Icon.ArrowClockwise}
              onAction={loadThreads}
            />
          </ActionPanel>
        }
      />
      {lastThreadId &&
      !filteredThreads.some((thread) => thread.id === lastThreadId) ? (
        <List.Item
          icon={Icon.Clock}
          title="Last Topic"
          subtitle={lastThreadId}
          actions={
            <ActionPanel>
              <Action.Push
                title="Open Topic"
                icon={Icon.Message}
                target={<ThreadDetailView threadId={lastThreadId} />}
              />
            </ActionPanel>
          }
        />
      ) : null}
      {filteredThreads.map((thread) => (
        <List.Item
          key={thread.id}
          icon={thread.parentThreadId ? Icon.Person : Icon.Message}
          title={formatThreadTitle(thread)}
          subtitle={thread.preview}
          accessories={[
            { text: "Codex" },
            {
              date: thread.updatedAt
                ? new Date(thread.updatedAt * 1000)
                : undefined,
              tooltip: formatTimestamp(thread.updatedAt),
            },
          ]}
          actions={
            <ActionPanel>
              <Action.Push
                title="Open Topic"
                icon={Icon.Message}
                target={<ThreadDetailView threadId={thread.id} />}
              />
              <Action.Push
                title="New Chat"
                icon={Icon.Plus}
                target={<NewChatForm />}
              />
              <Action
                title="Refresh"
                icon={Icon.ArrowClockwise}
                onAction={loadThreads}
              />
              <Action.CopyToClipboard
                title="Copy Thread ID"
                icon={Icon.Tag}
                content={thread.id}
              />
            </ActionPanel>
          }
        />
      ))}
    </List>
  );
}
