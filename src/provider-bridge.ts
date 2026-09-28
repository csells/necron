import { randomUUID } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import {
  BRIDGE_JSON_RPC_ERRORS,
  BRIDGE_NOTIFICATION_METHODS,
  BRIDGE_REQUEST_METHODS,
  PROVIDER_BRIDGE_PROTOCOL_VERSION,
  THREAD_DELTA_GRAMMAR_V3,
  THREAD_DELTA_NOTIFICATION_METHOD,
  createBridgeIo,
  experimental_defineProviderBridge,
  initializeParamsSchema,
  modelListParamsSchema,
  providerMaintenanceParamsSchema,
  runBridgeRequest,
  threadResumeParamsSchema,
  threadStartParamsSchema,
  threadStopParamsSchema,
  turnStartParamsSchema,
  turnSteerParamsSchema,
  type ClientTurnRequestId,
  type PromptInput,
  type ThreadDelta,
} from "@get-bb/plugin-sdk/provider-bridge";
import { Necron, OpenAICompatibleModel, type Message } from "./necron.js";

type Session = {
  threadId: string;
  providerThreadId: string;
  history: Message[];
  turn: number;
  abort?: AbortController;
};
const sessions = new Map<string, Session>();
let dataDir: string | undefined;
function historyPath(providerThreadId: string): string | undefined {
  return dataDir && /^necron_[a-f0-9-]+$/.test(providerThreadId)
    ? join(dataDir, `${providerThreadId}.json`) : undefined;
}
function loadHistory(providerThreadId: string): Message[] {
  const path = historyPath(providerThreadId);
  if (!path) return [];
  try {
    const value: unknown = JSON.parse(readFileSync(path, "utf8"));
    if (Array.isArray(value) && value.every((item) =>
      item && typeof item === "object" &&
      (item.role === "user" || item.role === "assistant") &&
      typeof item.content === "string")) return value as Message[];
  } catch { /* A new session has no history file. */ }
  return [];
}
const io = createBridgeIo<{ jsonrpc: "2.0" } & Record<string, unknown>>();
const optionsSchema = z.object({
  baseUrl: z.string().url().default("http://127.0.0.1:11434/v1"),
  model: z.string().min(1).default("qwen3:4b-instruct-2507-q4_K_M"),
});

function notify(method: string, params: Record<string, unknown>) {
  io.send({ jsonrpc: "2.0", method, params });
}
function deltas(threadId: string, items: ThreadDelta[]) {
  notify(THREAD_DELTA_NOTIFICATION_METHOD, { threadId, deltas: items });
}
function promptText(input: readonly PromptInput[]) {
  return input.filter((item): item is Extract<PromptInput, { type: "text" }> => item.type === "text")
    .map((item) => item.text).join("\n");
}
function openSession(threadId: string, providerThreadId: string): Session {
  const session: Session = { threadId, providerThreadId, history: loadHistory(providerThreadId), turn: 0 };
  sessions.set(threadId, session);
  notify(BRIDGE_NOTIFICATION_METHODS.threadIdentity, { threadId, providerThreadId });
  deltas(threadId, [{ kind: "session.reset" }]);
  return session;
}

function runTurn(session: Session, input: readonly PromptInput[], providerOptions: unknown, clientRequestId?: ClientTurnRequestId) {
  const prompt = promptText(input);
  if (prompt.trim() === "/noop") {
    deltas(session.threadId, [
      ...(clientRequestId === undefined ? [] : [{ kind: "input.accepted" as const, clientRequestId }]),
      { kind: "turn.boundary", status: "completed", claimIfIdle: true },
    ]);
    return;
  }
  const turn = ++session.turn;
  const key = { providerItemId: `${session.providerThreadId}:${turn}:answer` };
  const abort = new AbortController();
  session.abort = abort;
  deltas(session.threadId, [
    ...(clientRequestId === undefined ? [] : [{ kind: "input.accepted" as const, clientRequestId }]),
    { kind: "turn.open" },
    { kind: "item.open", key, item: { type: "agentMessage", text: "" } },
  ]);
  const options = optionsSchema.safeParse(providerOptions);
  const config = options.success ? options.data : optionsSchema.parse({
    baseUrl: process.env.NECRON_BASE_URL,
    model: process.env.NECRON_MODEL,
  });
  const harness = new Necron({
    model: new OpenAICompatibleModel({ ...config, apiKey: process.env.NECRON_API_KEY }),
  });
  void harness.run(prompt, session.history, () => {}, abort.signal).then((answer) => {
    if (sessions.get(session.threadId) !== session || abort.signal.aborted) return;
    session.history.push({ role: "user", content: prompt }, { role: "assistant", content: answer });
    const path = historyPath(session.providerThreadId);
    if (path) writeFileSync(path, JSON.stringify(session.history));
    deltas(session.threadId, [
      { kind: "item.textDelta", key, channel: "agentMessage", text: answer },
      { kind: "item.textClose", key, channel: "agentMessage", text: answer },
      { kind: "turn.boundary", status: "completed" },
    ]);
  }).catch((error: unknown) => {
    if (sessions.get(session.threadId) !== session || abort.signal.aborted) return;
    const message = `Necron failed: ${error instanceof Error ? error.message : String(error)}`;
    deltas(session.threadId, [
      { kind: "item.textDelta", key, channel: "agentMessage", text: message },
      { kind: "item.textClose", key, channel: "agentMessage", text: message },
      { kind: "turn.boundary", status: "failed" },
    ]);
  }).finally(() => {
    if (session.abort === abort) session.abort = undefined;
  });
}

type Id = string | number;
function invalid(id: Id, method: string, issues: unknown) {
  io.send({ jsonrpc: "2.0", id, error: { code: BRIDGE_JSON_RPC_ERRORS.INVALID_PARAMS, message: `Invalid params for ${method}`, data: issues } });
}
function parsed<T extends z.ZodType>(id: Id, method: string, schema: T, params: unknown): z.output<T> | undefined {
  const result = schema.safeParse(params);
  if (!result.success) { invalid(id, method, result.error.issues); return undefined; }
  return result.data;
}
type Handler = (id: Id, params: unknown) => void;
const handlers: Record<string, Handler> = {
  [BRIDGE_REQUEST_METHODS.initialize]: (id, params) => {
    if (!parsed(id, BRIDGE_REQUEST_METHODS.initialize, initializeParamsSchema, params)) return;
    io.sendResult(id, {
      protocolVersion: PROVIDER_BRIDGE_PROTOCOL_VERSION,
      capabilities: {
        grammarVersions: [THREAD_DELTA_GRAMMAR_V3, THREAD_DELTA_GRAMMAR_V3],
        sessionRestore: true, threadArchive: false, threadRename: false,
        threadGoalClear: false, fork: "none", approvalEnforcedBy: "runtime", steerMode: "queue",
      },
    });
  },
  [BRIDGE_REQUEST_METHODS.modelList]: (id, params) => {
    if (!parsed(id, BRIDGE_REQUEST_METHODS.modelList, modelListParamsSchema, params)) return;
    io.sendResult(id, { models: [{ model: "default", displayName: "Configured model", isDefault: true }], selectedOnlyModels: [] });
  },
  [BRIDGE_REQUEST_METHODS.providerHealth]: (id, params) => {
    if (!parsed(id, BRIDGE_REQUEST_METHODS.providerHealth, providerMaintenanceParamsSchema, params)) return;
    io.sendResult(id, { supported: true, health: {
      status: "ready", statusMessage: null, accountEmail: null, planLabel: null,
      installedVersion: null, minimumSupportedVersion: null,
      canInstall: false, canUpdate: false, loginCommand: null,
    } });
  },
  [BRIDGE_REQUEST_METHODS.threadStart]: (id, params) => {
    const value = parsed(id, BRIDGE_REQUEST_METHODS.threadStart, threadStartParamsSchema, params);
    if (!value) return;
    const providerThreadId = `necron_${randomUUID()}`;
    const session = openSession(value.threadId, providerThreadId);
    io.sendResult(id, { providerThreadId, sessionRestorable: true });
    if (value.input?.length) runTurn(session, value.input, value.options.providerOptions);
  },
  [BRIDGE_REQUEST_METHODS.threadResume]: (id, params) => {
    const value = parsed(id, BRIDGE_REQUEST_METHODS.threadResume, threadResumeParamsSchema, params);
    if (!value) return;
    openSession(value.threadId, value.providerThreadId);
    io.sendResult(id, { providerThreadId: value.providerThreadId, sessionRestorable: true });
  },
  [BRIDGE_REQUEST_METHODS.turnStart]: (id, params) => {
    const value = parsed(id, BRIDGE_REQUEST_METHODS.turnStart, turnStartParamsSchema, params);
    if (!value) return;
    const session = sessions.get(value.threadId);
    if (!session) { io.sendError(id, BRIDGE_JSON_RPC_ERRORS.INVALID_PARAMS, "No Necron session; start or resume the thread first"); return; }
    if (session.abort) { io.sendError(id, BRIDGE_JSON_RPC_ERRORS.INVALID_PARAMS, "A turn is already running"); return; }
    io.sendResult(id, {});
    runTurn(session, value.input, value.options.providerOptions, value.clientRequestId);
  },
  [BRIDGE_REQUEST_METHODS.turnSteer]: (id, params) => {
    const value = parsed(id, BRIDGE_REQUEST_METHODS.turnSteer, turnSteerParamsSchema, params);
    if (!value) return;
    io.sendError(id, BRIDGE_JSON_RPC_ERRORS.NO_ACTIVE_TURN, `No turn to steer (expected ${value.expectedTurnId})`);
  },
  [BRIDGE_REQUEST_METHODS.threadStop]: (id, params) => {
    const value = parsed(id, BRIDGE_REQUEST_METHODS.threadStop, threadStopParamsSchema, params);
    if (!value) return;
    const session = sessions.get(value.threadId);
    session?.abort?.abort();
    sessions.delete(value.threadId);
    io.sendResult(id, {});
  },
};

export function handleLine(line: string): void {
  let value: unknown;
  try { value = JSON.parse(line); } catch { return; }
  if (!value || typeof value !== "object" || Array.isArray(value)) return;
  const { id, method, params } = value as { id?: unknown; method?: unknown; params?: unknown };
  if (typeof method !== "string" || (typeof id !== "string" && typeof id !== "number")) return;
  const handler = handlers[method];
  if (!handler) { io.sendError(id, BRIDGE_JSON_RPC_ERRORS.METHOD_NOT_FOUND, `Method not found: ${method}`); return; }
  runBridgeRequest({ request: { id, method, params }, sendError: io.sendError, handleRequest: async () => handler(id, params) });
}

export const experimental_providerBridge = experimental_defineProviderBridge({
  handleLine,
  start(context) { dataDir = context.dataDir; },
});
