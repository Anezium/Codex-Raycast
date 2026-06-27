export type JsonRpcError = {
  code?: number;
  message: string;
  data?: unknown;
};

export type JsonRpcResponse<T> = {
  id: number;
  result?: T;
  error?: JsonRpcError;
};

export type JsonRpcNotification = {
  method: string;
  params?: Record<string, unknown>;
};

export type UserInput =
  | { type: "text"; text: string; text_elements: [] }
  | { type: "image"; url: string; detail?: string }
  | { type: "localImage"; path: string; detail?: string }
  | { type: "skill"; name: string; path: string }
  | { type: "mention"; name: string; path: string };

export type ThreadItem =
  | {
      type: "userMessage";
      id: string;
      clientId: string | null;
      content: UserInput[];
    }
  | {
      type: "agentMessage";
      id: string;
      text: string;
      phase: string | null;
      memoryCitation: unknown | null;
    }
  | { type: "plan"; id: string; text: string }
  | { type: "reasoning"; id: string; summary: string[]; content: string[] }
  | {
      type: "commandExecution";
      id: string;
      command: string;
      cwd: string;
      status: string;
      aggregatedOutput: string | null;
      exitCode: number | null;
      durationMs: number | null;
      [key: string]: unknown;
    }
  | {
      type: "collabAgentToolCall";
      id: string;
      tool: string;
      status: string;
      senderThreadId: string;
      receiverThreadIds: string[];
      prompt: string | null;
      model: string | null;
      reasoningEffort: string | null;
      [key: string]: unknown;
    }
  | {
      type: "subAgentActivity";
      id: string;
      kind: string;
      agentThreadId: string;
      agentPath: string;
    }
  | { type: "webSearch"; id: string; query: string; action: unknown | null }
  | { type: "imageView"; id: string; path: string }
  | { type: "sleep"; id: string; durationMs: number }
  | { type: "contextCompaction"; id: string };

export type CodexTurn = {
  id: string;
  items: ThreadItem[];
  itemsView: string;
  status: string;
  error: unknown | null;
  startedAt: number | null;
  completedAt: number | null;
  durationMs: number | null;
};

export type CodexThread = {
  id: string;
  sessionId: string;
  forkedFromId: string | null;
  parentThreadId: string | null;
  preview: string;
  ephemeral: boolean;
  modelProvider: string;
  createdAt: number;
  updatedAt: number;
  recencyAt: number | null;
  status: string;
  path: string | null;
  cwd: string;
  cliVersion: string;
  source: string;
  threadSource: string | null;
  agentNickname: string | null;
  agentRole: string | null;
  gitInfo: unknown | null;
  name: string | null;
  turns: CodexTurn[];
};

export type ThreadListResponse = {
  data: CodexThread[];
  nextCursor: string | null;
  backwardsCursor: string | null;
};

export type ThreadResponse = {
  thread: CodexThread;
  model?: string;
  reasoningEffort?: string | null;
};

export type ModelListResponse = {
  data: Array<{
    id: string;
    model: string;
    displayName: string;
    description: string;
    hidden: boolean;
    defaultReasoningEffort: string;
    isDefault: boolean;
    supportedReasoningEfforts: Array<{
      reasoningEffort: string;
      description: string;
    }>;
  }>;
  nextCursor: string | null;
};

export type AccountReadResponse = {
  account:
    | null
    | { type: "apiKey" }
    | { type: "chatgpt"; email: string | null; planType: string }
    | Record<string, unknown>;
  requiresOpenaiAuth: boolean;
};

export type AuthStatusResponse = {
  authMethod: string | null;
  authToken: string | null;
  requiresOpenaiAuth: boolean | null;
};

export type LoginResponse =
  | { type: "apiKey" }
  | { type: "chatgpt"; loginId: string; authUrl: string }
  | {
      type: "chatgptDeviceCode";
      loginId: string;
      verificationUrl: string;
      userCode: string;
    }
  | { type: "chatgptAuthTokens" };
