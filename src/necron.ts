import { randomUUID } from "node:crypto";

export type Message = { role: "user" | "assistant"; content: string };
export type Agent = { id: string; instructions: string };
export type Slop = { id: string; members: string[]; coordinator: string };
export type Destination = { kind: "agent" | "slop"; id: string };
export type Classification = { destination: Destination; message: string; reason: string };

export type NecronEvent =
  | { type: "route"; runId: string; destination: Destination; reason: string }
  | { type: "progress"; runId: string; agentId: string; message: string }
  | { type: "question"; runId: string; questionId: string; prompt: string }
  | { type: "permission_request"; runId: string; requestId: string; action: string }
  | { type: "summary"; runId: string; destination: Destination; text: string }
  | { type: "failure"; runId: string; message: string };

export type EventSink = (event: NecronEvent) => void | Promise<void>;
export interface Classifier {
  classify(input: string, agents: Agent[], slops: Slop[]): Promise<Classification>;
}
export interface Model {
  complete(agent: Agent, messages: Message[], signal?: AbortSignal): Promise<string>;
}

export const DEFAULT_AGENTS: Agent[] = [
  { id: "chief", instructions: "You are Necron's chief of staff. Give direct, useful answers. State uncertainty. Coordinate when asked." },
  { id: "researcher", instructions: "You are a research specialist. Analyze the question carefully. State uncertainty and avoid inventing sources." },
  { id: "builder", instructions: "You are an implementation specialist. Prefer concrete designs, code, and testable steps." },
];
export const DEFAULT_SLOPS: Slop[] = [
  { id: "crew", members: ["researcher", "builder"], coordinator: "chief" },
];

/** Deterministic baseline. Swap in a classifier model without changing the runtime. */
export class MentionClassifier implements Classifier {
  async classify(input: string, agents: Agent[], slops: Slop[]): Promise<Classification> {
    const mention = /^@([a-z][\w-]*)\s+([\s\S]+)/i.exec(input.trim());
    if (mention) {
      const id = mention[1]!.toLowerCase();
      const message = mention[2]!.trim();
      if (agents.some((agent) => agent.id === id)) {
        return { destination: { kind: "agent", id }, message, reason: "explicit agent mention" };
      }
      if (slops.some((slop) => slop.id === id)) {
        return { destination: { kind: "slop", id }, message, reason: "explicit slop mention" };
      }
      throw new Error(`Unknown agent or slop: @${id}`);
    }
    return { destination: { kind: "agent", id: "chief" }, message: input, reason: "default chief" };
  }
}

export class OpenAICompatibleModel implements Model {
  constructor(readonly config: { baseUrl: string; model: string; apiKey?: string }) {}

  async complete(agent: Agent, messages: Message[], signal?: AbortSignal): Promise<string> {
    const url = `${this.config.baseUrl.replace(/\/$/, "")}/chat/completions`;
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(this.config.apiKey ? { authorization: `Bearer ${this.config.apiKey}` } : {}),
      },
      body: JSON.stringify({
        model: this.config.model,
        stream: false,
        messages: [{ role: "system", content: agent.instructions }, ...messages],
      }),
      signal,
    });
    if (!response.ok) {
      const detail = (await response.text()).slice(0, 500);
      throw new Error(`Model API returned ${response.status}: ${detail}`);
    }
    const data = await response.json() as { choices?: { message?: { content?: string } }[] };
    const text = data.choices?.[0]?.message?.content?.trim();
    if (!text) throw new Error("Model API returned no assistant text");
    return text;
  }
}

export class Necron {
  readonly agents: Agent[];
  readonly slops: Slop[];
  readonly classifier: Classifier;
  readonly model: Model;

  constructor(options: { model: Model; classifier?: Classifier; agents?: Agent[]; slops?: Slop[] }) {
    this.model = options.model;
    this.classifier = options.classifier ?? new MentionClassifier();
    this.agents = options.agents ?? DEFAULT_AGENTS;
    this.slops = options.slops ?? DEFAULT_SLOPS;
    const ids = new Set(this.agents.map((agent) => agent.id));
    if (!ids.has("chief")) throw new Error("A chief agent is required");
    for (const slop of this.slops) {
      if (!ids.has(slop.coordinator) || slop.members.some((member) => !ids.has(member))) {
        throw new Error(`Slop ${slop.id} refers to an unknown agent`);
      }
    }
  }

  async run(input: string, history: Message[], emit: EventSink, signal?: AbortSignal): Promise<string> {
    const runId = randomUUID();
    try {
      const route = await this.classifier.classify(input, this.agents, this.slops);
      await emit({ type: "route", runId, destination: route.destination, reason: route.reason });
      const messages = [...history, { role: "user" as const, content: route.message }];
      let text: string;
      if (route.destination.kind === "agent") {
        const agent = this.agent(route.destination.id);
        await emit({ type: "progress", runId, agentId: agent.id, message: "working" });
        text = await this.model.complete(agent, messages, signal);
      } else {
        const slop = this.slops.find((candidate) => candidate.id === route.destination.id);
        if (!slop) throw new Error(`Unknown slop: ${route.destination.id}`);
        const reports = await Promise.all(slop.members.map(async (id) => {
          const agent = this.agent(id);
          await emit({ type: "progress", runId, agentId: id, message: "working" });
          const report = await this.model.complete(agent, messages, signal);
          await emit({ type: "progress", runId, agentId: id, message: "finished" });
          return { id, report };
        }));
        const synthesis = `${route.message}\n\nTeam reports:\n${reports.map(({ id, report }) => `[${id}] ${report}`).join("\n\n")}\n\nSynthesize one answer, noting disagreements and uncertainty.`;
        await emit({ type: "progress", runId, agentId: slop.coordinator, message: "synthesizing" });
        text = await this.model.complete(this.agent(slop.coordinator), [
          ...history,
          { role: "user", content: synthesis },
        ], signal);
      }
      await emit({ type: "summary", runId, destination: route.destination, text });
      return text;
    } catch (error) {
      await emit({ type: "failure", runId, message: error instanceof Error ? error.message : String(error) });
      throw error;
    }
  }

  private agent(id: string): Agent {
    const agent = this.agents.find((candidate) => candidate.id === id);
    if (!agent) throw new Error(`Unknown agent: ${id}`);
    return agent;
  }
}
