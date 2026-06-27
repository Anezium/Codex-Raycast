import {
  Action,
  ActionPanel,
  Detail,
  Icon,
  Toast,
  confirmAlert,
  showToast,
} from "@raycast/api";
import { useEffect, useMemo, useState } from "react";

import { CodexAppServerClient } from "../lib/codex-client";
import {
  formatThreadMarkdown,
  formatThreadTitle,
  showFailure,
} from "../lib/format";
import {
  getCodexPreferences,
  getCodexRuntimeOptions,
} from "../lib/preferences";
import { rememberLastThread } from "../lib/storage";
import type { CodexThread } from "../lib/types";
import { RenameThreadForm } from "./RenameThreadForm";
import { SendMessageForm } from "./SendMessageForm";

type Props = {
  threadId: string;
};

export function ThreadDetailView(props: Props) {
  const preferences = useMemo(() => getCodexPreferences(), []);
  const [thread, setThread] = useState<CodexThread>();
  const [isLoading, setIsLoading] = useState(true);

  async function loadThread() {
    setIsLoading(true);
    let client: CodexAppServerClient | undefined;
    try {
      client = await CodexAppServerClient.connect(
        getCodexRuntimeOptions(preferences),
      );
      const loadedThread = await client.readThread(props.threadId);
      setThread(loadedThread);
      await rememberLastThread(loadedThread.id);
    } catch (error) {
      await showFailure("Could not load topic", error);
    } finally {
      client?.dispose();
      setIsLoading(false);
    }
  }

  async function archiveThread() {
    const confirmed = await confirmAlert({
      title: "Archive Topic?",
      message: "The thread will be archived in Codex.",
      primaryAction: { title: "Archive" },
    });

    if (!confirmed) {
      return;
    }

    let client: CodexAppServerClient | undefined;
    try {
      client = await CodexAppServerClient.connect(
        getCodexRuntimeOptions(preferences),
      );
      await client.archiveThread(props.threadId);
      await showToast({ style: Toast.Style.Success, title: "Topic archived" });
    } catch (error) {
      await showFailure("Could not archive topic", error);
    } finally {
      client?.dispose();
    }
  }

  useEffect(() => {
    loadThread();
  }, [props.threadId]);

  const title = thread ? formatThreadTitle(thread) : "Codex Topic";

  return (
    <Detail
      isLoading={isLoading}
      markdown={thread ? formatThreadMarkdown(thread) : "# Loading Topic"}
      actions={
        <ActionPanel>
          <Action.Push
            title="Send Message"
            icon={Icon.Message}
            target={<SendMessageForm threadId={props.threadId} title={title} />}
          />
          <Action
            title="Refresh"
            icon={Icon.ArrowClockwise}
            onAction={loadThread}
          />
          {thread ? (
            <Action.Push
              title="Rename Topic"
              icon={Icon.Pencil}
              target={
                <RenameThreadForm
                  threadId={thread.id}
                  currentName={thread.name ?? title}
                />
              }
            />
          ) : null}
          <Action.CopyToClipboard
            title="Copy Thread ID"
            icon={Icon.Tag}
            content={props.threadId}
          />
          <Action
            title="Archive Topic"
            icon={Icon.Box}
            style={Action.Style.Destructive}
            onAction={archiveThread}
          />
        </ActionPanel>
      }
    />
  );
}
