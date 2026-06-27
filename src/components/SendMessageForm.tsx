import {
  Action,
  ActionPanel,
  Form,
  Icon,
  Toast,
  showToast,
  useNavigation,
} from "@raycast/api";
import { useMemo } from "react";

import { getCodexPreferences, ReasoningEffort } from "../lib/preferences";
import { ModelEffortFields } from "./ModelEffortFields";
import { RunTurnView } from "./RunTurnView";

type Props = {
  threadId: string;
  title?: string;
};

type MessageValues = {
  message: string;
  model: string;
  effort: ReasoningEffort;
  cwd?: string;
  useSubagents: boolean;
};

export function SendMessageForm(props: Props) {
  const preferences = useMemo(() => getCodexPreferences(), []);
  const { push } = useNavigation();

  async function handleSubmit(values: MessageValues) {
    if (!values.message.trim()) {
      await showToast({
        style: Toast.Style.Failure,
        title: "Message is required",
      });
      return;
    }

    push(
      <RunTurnView
        threadId={props.threadId}
        topicName={props.title}
        prompt={values.message}
        model={values.model}
        effort={values.effort}
        cwd={values.cwd}
        useSubagents={values.useSubagents}
      />,
    );
  }

  return (
    <Form
      enableDrafts
      actions={
        <ActionPanel>
          <Action.SubmitForm
            title="Send Message"
            icon={Icon.Message}
            onSubmit={handleSubmit}
          />
        </ActionPanel>
      }
    >
      <Form.TextArea
        id="message"
        title="Message"
        placeholder="Ask Codex..."
        autoFocus
      />
      <ModelEffortFields
        defaultModel={preferences.defaultModel}
        defaultEffort={preferences.defaultEffort}
      />
      <Form.TextField
        id="cwd"
        title="Working Directory"
        placeholder="/Users/you/project"
        defaultValue={preferences.defaultCwd}
      />
      <Form.Checkbox
        id="useSubagents"
        title="Subagents"
        label="Ask Codex to spin up subagents"
        defaultValue={Boolean(preferences.defaultSubagents)}
      />
    </Form>
  );
}
