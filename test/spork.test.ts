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

test("a slop runs specialists then speaks through its coordinator", async () => {
  const called: string[] = [];
  const harness = new Spork({ model: {
    async complete(agent, messages) {
      called.push(agent.id);
      return `${agent.id}: ${messages.at(-1)?.content}`;
    },
  } });
  const answer = await harness.run("@crew Design a widget", [], () => {});
  assert.deepEqual(called, ["researcher", "builder", "chief"]);
  assert.match(answer, /\[researcher\] researcher:/);
  assert.match(answer, /\[builder\] builder:/);
});

test("model failures surface as failure events", async () => {
  const events: SporkEvent[] = [];
  const harness = new Spork({ model: { async complete() { throw new Error("offline"); } } });
  await assert.rejects(harness.run("hello", [], (event) => { events.push(event); }), /offline/);
  assert.equal(events.at(-1)?.type, "failure");
});
