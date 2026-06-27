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
  initialPrompt?: string;
  defaultModel?: string;
  defaultEffort?: ReasoningEffort;
  defaultSubagents?: boolean;
  defaultTopicName?: string;
  submitTitle?: string;
};

type NewChatValues = {
  topicName?: string;
  message: string;
  model: string;
  effort: ReasoningEffort;
  cwd?: string;
  useSubagents: boolean;
};

export function NewChatForm(props: Props) {
  const preferences = useMemo(() => getCodexPreferences(), []);
  const { push } = useNavigation();

  async function handleSubmit(values: NewChatValues) {
    if (!values.message.trim()) {
      await showToast({
        style: Toast.Style.Failure,
        title: "Message is required",
      });
      return;
    }

    push(
      <RunTurnView
        topicName={values.topicName}
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
            title={props.submitTitle ?? "Start Chat"}
            icon={Icon.Message}
            onSubmit={handleSubmit}
          />
        </ActionPanel>
      }
    >
      <Form.TextField
        id="topicName"
        title="Topic"
        placeholder="Optional topic name"
        defaultValue={props.defaultTopicName}
      />
      <Form.TextArea
        id="message"
        title="Message"
        placeholder="Ask Codex..."
        autoFocus
        defaultValue={props.initialPrompt}
      />
      <ModelEffortFields
        defaultModel={props.defaultModel ?? preferences.defaultModel}
        defaultEffort={props.defaultEffort ?? preferences.defaultEffort}
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
        defaultValue={
          props.defaultSubagents ?? Boolean(preferences.defaultSubagents)
        }
      />
    </Form>
  );
}
