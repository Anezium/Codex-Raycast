import {
  Action,
  ActionPanel,
  Form,
  Icon,
  Toast,
  showToast,
  useNavigation,
} from "@raycast/api";
import { useMemo, useState } from "react";

import { CodexAppServerClient } from "../lib/codex-client";
import { showFailure } from "../lib/format";
import {
  getCodexPreferences,
  getCodexRuntimeOptions,
} from "../lib/preferences";

type Props = {
  threadId: string;
  currentName?: string | null;
};

type RenameValues = {
  name: string;
};

export function RenameThreadForm(props: Props) {
  const preferences = useMemo(() => getCodexPreferences(), []);
  const [isLoading, setIsLoading] = useState(false);
  const { pop } = useNavigation();

  async function handleSubmit(values: RenameValues) {
    const name = values.name.trim();
    if (!name) {
      await showToast({
        style: Toast.Style.Failure,
        title: "Topic name is required",
      });
      return;
    }

    setIsLoading(true);
    let client: CodexAppServerClient | undefined;
    try {
      client = await CodexAppServerClient.connect(
        getCodexRuntimeOptions(preferences),
      );
      await client.setThreadName(props.threadId, name);
      await showToast({ style: Toast.Style.Success, title: "Topic renamed" });
      pop();
    } catch (error) {
      await showFailure("Could not rename topic", error);
    } finally {
      client?.dispose();
      setIsLoading(false);
    }
  }

  return (
    <Form
      isLoading={isLoading}
      actions={
        <ActionPanel>
          <Action.SubmitForm
            title="Rename Topic"
            icon={Icon.Pencil}
            onSubmit={handleSubmit}
          />
        </ActionPanel>
      }
    >
      <Form.TextField
        id="name"
        title="Name"
        defaultValue={props.currentName ?? ""}
        autoFocus
      />
    </Form>
  );
}
