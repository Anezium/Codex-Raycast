import { ChildProcessWithoutNullStreams, spawn } from "node:child_process";
import * as readline from "node:readline";

import {
  CodexRuntime,
  CodexRuntimeOptions,
  resolveCodexRuntime,
} from "./codex-runtime";
import type {
  CodexApprovalPolicy,
  CodexSandboxMode,
  CodexServiceTier,
} from "./preferences";
import type {
  AccountReadResponse,
  AuthStatusResponse,
  CodexThread,
  JsonRpcNotification,
  JsonRpcResponse,
  LoginResponse,
  ModelListResponse,
  ThreadListResponse,
  ThreadResponse,
} from "./types";

type PendingRequest = {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
};

type TurnStreamOptions = {
  threadId: string;
  prompt: string;
  model: string;
  effort: string;
  cwd?: string;
  sandbox?: CodexSandboxMode;
  approvalPolicy?: CodexApprovalPolicy;
  serviceTier?: CodexServiceTier;
  onDelta?: (delta: string) => void;
  onStatus?: (status: string) => void;
};

export class CodexAppServerClient {
  private readonly runtime: CodexRuntime;
  private process?: ChildProcessWithoutNullStreams;
  private nextId = 1;
  private pending = new Map<number, PendingRequest>();
  private notificationHandlers = new Set<
    (notification: JsonRpcNotification) => void
  >();
  private stderr = "";

  constructor(runtimeOptions?: CodexRuntimeOptions | string) {
    this.runtime = resolveCodexRuntime(runtimeOptions);
  }

  static async connect(
    runtimeOptions?: CodexRuntimeOptions | string,
  ): Promise<CodexAppServerClient> {
    const client = new CodexAppServerClient(runtimeOptions);
    client.start();
    await client.initialize();
    return client;
  }

  dispose() {
    for (const pending of this.pending.values()) {
      pending.reject(new Error("Codex app-server connection closed"));
    }
    this.pending.clear();

    if (this.process && !this.process.killed) {
      this.process.kill();
    }
  }

  async listThreads(limit = 50): Promise<ThreadListResponse> {
    return this.request<ThreadListResponse>("thread/list", {
      limit,
      archived: false,
      sortKey: "updated_at",
      sortDirection: "desc",
    });
  }

  async readThread(threadId: string): Promise<CodexThread> {
    const response = await this.request<{ thread: CodexThread }>(
      "thread/read",
      { threadId, includeTurns: true },
    );
    return response.thread;
  }

  async startThread(options: {
    model: string;
    cwd?: string;
    sandbox?: CodexSandboxMode;
    approvalPolicy?: CodexApprovalPolicy;
    serviceTier?: CodexServiceTier;
  }): Promise<ThreadResponse> {
    return this.request<ThreadResponse>("thread/start", {
      model: options.model,
      ...(options.serviceTier ? { serviceTier: options.serviceTier } : {}),
      cwd: options.cwd ?? null,
      sandbox: options.sandbox ?? null,
      approvalPolicy: options.approvalPolicy ?? null,
      threadSource: "raycast",
    });
  }

  async resumeThread(options: {
    threadId: string;
    model: string;
    cwd?: string;
    sandbox?: CodexSandboxMode;
    approvalPolicy?: CodexApprovalPolicy;
    serviceTier?: CodexServiceTier;
  }): Promise<ThreadResponse> {
    return this.request<ThreadResponse>("thread/resume", {
      threadId: options.threadId,
      model: options.model,
      ...(options.serviceTier ? { serviceTier: options.serviceTier } : {}),
      cwd: options.cwd ?? null,
      sandbox: options.sandbox ?? null,
      approvalPolicy: options.approvalPolicy ?? null,
    });
  }

  async setThreadName(threadId: string, name: string): Promise<void> {
    await this.request("thread/name/set", { threadId, name });
  }

  async archiveThread(threadId: string): Promise<void> {
    await this.request("thread/archive", { threadId });
  }

  async listModels(): Promise<ModelListResponse> {
    return this.request<ModelListResponse>("model/list", {});
  }

  async readAccount(refreshToken = false): Promise<AccountReadResponse> {
    return this.request<AccountReadResponse>("account/read", { refreshToken });
  }

  async getAuthStatus(): Promise<AuthStatusResponse> {
    return this.request<AuthStatusResponse>("getAuthStatus", {
      includeToken: false,
      refreshToken: false,
    });
  }

  async startChatGptLogin(): Promise<LoginResponse> {
    return this.request<LoginResponse>("account/login/start", {
      type: "chatgpt",
      codexStreamlinedLogin: true,
    });
  }

  async startDeviceCodeLogin(): Promise<LoginResponse> {
    return this.request<LoginResponse>("account/login/start", {
      type: "chatgptDeviceCode",
    });
  }

  async startTurnAndStream(options: TurnStreamOptions): Promise<string> {
    let output = "";
    let turnId: string | undefined;

    options.onStatus?.("Starting turn");

    const removeHandler = this.onNotification((notification) => {
      const params = notification.params ?? {};

      if (
        notification.method === "turn/started" &&
        params.threadId === options.threadId
      ) {
        turnId =
          typeof params.turnId === "string"
            ? params.turnId
            : extractNestedTurnId(params);
        options.onStatus?.("Codex is thinking");
      }

      if (
        notification.method === "item/agentMessage/delta" &&
        params.threadId === options.threadId
      ) {
        const delta = typeof params.delta === "string" ? params.delta : "";
        output += delta;
        options.onDelta?.(delta);
      }

      if (
        notification.method === "item/reasoning/summaryTextDelta" &&
        params.threadId === options.threadId
      ) {
        options.onStatus?.("Reasoning");
      }

      if (
        notification.method === "item/commandExecution/outputDelta" &&
        params.threadId === options.threadId
      ) {
        options.onStatus?.("Running command");
      }
    });

    try {
      const response = await this.request<{ turn: { id: string } }>(
        "turn/start",
        {
          threadId: options.threadId,
          input: [{ type: "text", text: options.prompt, text_elements: [] }],
          cwd: options.cwd ?? null,
          model: options.model,
          ...(options.serviceTier ? { serviceTier: options.serviceTier } : {}),
          effort: options.effort,
          approvalPolicy: options.approvalPolicy ?? null,
        },
      );

      turnId = response.turn.id;

      await this.waitForTurnCompletion(options.threadId, turnId, (status) =>
        options.onStatus?.(status),
      );
      return output;
    } finally {
      removeHandler();
    }
  }

  private start() {
    this.process = spawn(this.runtime.command, this.runtime.args, {
      stdio: ["pipe", "pipe", "pipe"],
      env: { ...process.env, ...this.runtime.env, NO_COLOR: "1" },
    });

    this.process.stderr.on("data", (chunk: Buffer) => {
      this.stderr += chunk.toString("utf8");
    });

    this.process.on("error", (error) => {
      this.rejectAll(
        new Error(
          `Failed to start Codex app-server from ${this.runtime.displayPath}: ${error.message}`,
        ),
      );
    });

    this.process.on("exit", (code, signal) => {
      const suffix = this.stderr.trim() ? `\n\n${this.stderr.trim()}` : "";
      this.rejectAll(
        new Error(
          `Codex app-server exited (${signal ?? code ?? "unknown"}).${suffix}`,
        ),
      );
    });

    const lines = readline.createInterface({ input: this.process.stdout });
    lines.on("line", (line: string) => this.handleLine(line));
  }

  private async initialize() {
    await this.request("initialize", {
      clientInfo: {
        name: "raycast_codex",
        title: "Raycast Codex Chat",
        version: "0.1.0",
      },
      capabilities: {
        experimentalApi: true,
        requestAttestation: false,
      },
    });

    this.send({ method: "initialized" });
  }

  private request<T = unknown>(method: string, params: unknown): Promise<T> {
    const id = this.nextId++;
    const payload = { method, id, params };

    return new Promise<T>((resolve, reject) => {
      this.pending.set(id, {
        resolve: (value) => resolve(value as T),
        reject,
      });
      this.send(payload);
    });
  }

  private send(payload: unknown) {
    if (!this.process?.stdin.writable) {
      throw new Error("Codex app-server is not writable");
    }

    this.process.stdin.write(`${JSON.stringify(payload)}\n`);
  }

  private handleLine(line: string) {
    if (!line.trim()) {
      return;
    }

    let message: JsonRpcResponse<unknown> | JsonRpcNotification;
    try {
      message = JSON.parse(line) as
        | JsonRpcResponse<unknown>
        | JsonRpcNotification;
    } catch {
      return;
    }

    if (
      "id" in message &&
      "method" in message &&
      typeof message.method === "string"
    ) {
      this.handleServerRequest(
        message as JsonRpcResponse<unknown> & { method: string },
      );
      return;
    }

    if ("id" in message) {
      const pending = this.pending.get(message.id);
      if (!pending) {
        return;
      }

      this.pending.delete(message.id);
      if (message.error) {
        pending.reject(new Error(message.error.message));
      } else {
        pending.resolve(message.result);
      }
      return;
    }

    for (const handler of Array.from(this.notificationHandlers)) {
      handler(message);
    }
  }

  private onNotification(
    handler: (notification: JsonRpcNotification) => void,
  ): () => void {
    this.notificationHandlers.add(handler);
    return () => this.notificationHandlers.delete(handler);
  }

  private handleServerRequest(
    message: JsonRpcResponse<unknown> & { method: string },
  ) {
    switch (message.method) {
      case "item/commandExecution/requestApproval":
      case "item/fileChange/requestApproval":
        this.send({ id: message.id, result: { decision: "decline" } });
        break;
      case "execCommandApproval":
      case "applyPatchApproval":
        this.send({ id: message.id, result: { decision: "denied" } });
        break;
      default:
        this.send({
          id: message.id,
          error: {
            code: -32601,
            message: `Raycast Codex Chat does not support server request ${message.method}`,
          },
        });
    }
  }

  private waitForTurnCompletion(
    threadId: string,
    turnId: string,
    onStatus: (status: string) => void,
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const removeHandler = this.onNotification((notification) => {
        const params = notification.params ?? {};
        if (params.threadId !== threadId) {
          return;
        }

        if (notification.method === "turn/completed") {
          const completedTurnId = extractNestedTurnId(params);
          if (!completedTurnId || completedTurnId === turnId) {
            removeHandler();
            onStatus("Completed");
            resolve();
          }
        }

        if (notification.method === "error") {
          removeHandler();
          reject(new Error(extractErrorMessage(params)));
        }
      });
    });
  }

  private rejectAll(error: Error) {
    for (const pending of this.pending.values()) {
      pending.reject(error);
    }
    this.pending.clear();
  }
}

function extractNestedTurnId(
  params: Record<string, unknown>,
): string | undefined {
  if (typeof params.turnId === "string") {
    return params.turnId;
  }

  const turn = params.turn;
  if (
    turn &&
    typeof turn === "object" &&
    "id" in turn &&
    typeof turn.id === "string"
  ) {
    return turn.id;
  }

  return undefined;
}

function extractErrorMessage(params: Record<string, unknown>): string {
  const error = params.error;
  if (
    error &&
    typeof error === "object" &&
    "message" in error &&
    typeof error.message === "string"
  ) {
    return error.message;
  }

  return "Codex turn failed";
}
