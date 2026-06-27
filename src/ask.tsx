import type { LaunchProps } from "@raycast/api";

import { NewChatForm } from "./components/NewChatForm";
import { RunTurnView } from "./components/RunTurnView";
import { getCodexPreferences } from "./lib/preferences";

type Arguments = {
  prompt?: string;
};

export default function AskCommand(
  props: LaunchProps<{ arguments?: Arguments }>,
) {
  const prompt = props.fallbackText?.trim() || props.arguments?.prompt?.trim();
  const preferences = getCodexPreferences();

  if (!prompt) {
    return (
      <NewChatForm
        defaultTopicName="Ask"
        defaultModel={preferences.fastModel}
        defaultEffort={preferences.fastEffort}
        defaultSubagents={Boolean(preferences.fastSubagents)}
        submitTitle="Ask Fast"
      />
    );
  }

  return (
    <RunTurnView
      topicName="Ask"
      prompt={prompt}
      model={preferences.fastModel}
      effort={preferences.fastEffort}
      cwd={preferences.defaultCwd}
      useSubagents={Boolean(preferences.fastSubagents)}
    />
  );
}
