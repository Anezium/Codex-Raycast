import type { LaunchProps } from "@raycast/api";

import { NewChatForm } from "./components/NewChatForm";
import { RunTurnView } from "./components/RunTurnView";
import { getCodexPreferences } from "./lib/preferences";

type Arguments = {
  prompt?: string;
};

export default function NewChatCommand(
  props: LaunchProps<{ arguments: Arguments }>,
) {
  const prompt = props.arguments.prompt?.trim();
  const preferences = getCodexPreferences();

  if (prompt) {
    return (
      <RunTurnView
        topicName="New Chat"
        prompt={prompt}
        model={preferences.defaultModel}
        effort={preferences.defaultEffort}
        cwd={preferences.defaultCwd}
        useSubagents={Boolean(preferences.defaultSubagents)}
      />
    );
  }

  return <NewChatForm />;
}
