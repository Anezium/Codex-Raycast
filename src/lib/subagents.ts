export function withSubagentInstruction(
  prompt: string,
  useSubagents: boolean,
): string {
  const trimmed = prompt.trim();

  if (!useSubagents) {
    return trimmed;
  }

  return [
    "Use Codex subagents for this request where they help. Spawn specialized agents in parallel, wait for their results, and consolidate the final answer.",
    "Use read-heavy explorer agents for context gathering and worker agents only for bounded implementation work. Keep the final response concise and include the useful findings from each subagent.",
    "",
    "User request:",
    trimmed,
  ].join("\n");
}
