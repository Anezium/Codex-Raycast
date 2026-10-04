# Codex Chat for Raycast

Chat with Codex from Raycast through `codex app-server`. The extension bundles the Codex CLI runtime and reuses your Codex/ChatGPT sign-in, so it does not ask for OpenAI API keys.

## Setup

1. Run the `Codex Status` command and start ChatGPT sign-in from Raycast.
2. Optionally check the extension preferences:
   - `Codex Runtime` lets you choose Auto, the bundled runtime, the installed Codex app, `codex` from PATH, or a custom binary path.
   - `Custom Codex CLI Path` is only needed when the runtime is set to `Custom Path`.
   - `Codex Speed` lets you inherit Codex config, force Standard, or force Fast (`priority` service tier).
   - `Default Model` and `Default Thinking Effort` are used for new turns unless you override them in a chat form.
   - `Default Working Directory` is optional, but useful for repo-aware Codex chats.
   - `Default Sandbox` uses your Codex config by default.
   - `Default Approval Policy` uses your Codex config by default.
3. During development, run:

```bash
pnpm install
pnpm dev
```

Raycast's official docs use `npm install && npm run dev`; this workspace currently has a bundled `pnpm` runtime available, so the checked-in lockfile is generated with `pnpm`.

## Commands

- `Chat`: browse recent Codex discussions, open a topic, send messages, and create new topics.
- `New Chat`: launch directly into a new Codex chat, optionally with a Raycast argument prompt.
- `Ask`: short command name for long fast prompts. Type `Ask <prompt>` in Raycast; the short title leaves more room for the prompt pill.
- `Codex Status`: check account/login state and start ChatGPT OAuth sign-in.

## Fast Fallback

`Ask` uses `GPT-5.5` with low thinking effort by default. To use it without the argument pill, enable it as a fallback command in Raycast settings, then type the prompt itself in the root search bar.

## Subagents

Codex only starts subagents when explicitly asked. In message forms, enable `Use Subagents` to prepend a delegation instruction that asks Codex to spawn parallel explorer/worker subagents and consolidate their findings.

## License

Licensed under the [MIT License](LICENSE).
