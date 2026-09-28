import assert from "node:assert/strict";
import { test } from "node:test";
import { Spork, type Agent, type Message, type SporkEvent } from "../src/spork.js";

const model = {
  async complete(agent: Agent, messages: Message[]) {
    return `${agent.id}: ${messages.at(-1)?.content}`;
  },
};

test("directs a named specialist and emits a summary", async () => {
  const events: SporkEvent[] = [];
  const answer = await new Spork({ model }).run("@researcher What is known?", [], (event) => { events.push(event); });
  assert.equal(answer, "researcher: What is known?");
  assert.equal(events[0]?.type, "route");
  assert.deepEqual((events[0] as Extract<SporkEvent, { type: "route" }>).destination, { kind: "agent", id: "researcher" });
  assert.equal(events.at(-1)?.type, "summary");
});

test("a slop delivers messages both ways before its coordinator answers", async () => {
  const calls: { id: string; prompt: string }[] = [];
  const events: SporkEvent[] = [];
  const harness = new Spork({ model: {
    async complete(agent, messages) {
      calls.push({ id: agent.id, prompt: messages.at(-1)?.content ?? "" });
      return `${agent.id} report ${calls.length}`;
    },
  } });
  const answer = await harness.run("@crew Design a widget", [], (event) => { events.push(event); });
  assert.deepEqual(calls.map((call) => call.id), ["researcher", "builder", "researcher", "chief"]);
  assert.match(calls[1]!.prompt, /Message from @researcher to you:\nresearcher report 1/);
  assert.match(calls[2]!.prompt, /Reply from @builder:\nbuilder report 2/);
  assert.match(calls[3]!.prompt, /Follow-up review: researcher report 3/);
  assert.deepEqual(events.filter((event) => event.type === "message").map((event) => [event.from, event.to]), [
    ["researcher", "builder"], ["builder", "researcher"],
    ["researcher", "chief"], ["builder", "chief"], ["researcher", "chief"],
  ]);
  assert.equal(answer, "chief report 4");
  assert.equal(events.at(-1)?.type, "summary");
});

test("model failures surface as failure events", async () => {
  const events: SporkEvent[] = [];
  const harness = new Spork({ model: { async complete() { throw new Error("offline"); } } });
  await assert.rejects(harness.run("hello", [], (event) => { events.push(event); }), /offline/);
  assert.equal(events.at(-1)?.type, "failure");
});
