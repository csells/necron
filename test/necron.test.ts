import assert from "node:assert/strict";
import { test } from "node:test";
import { Necron, type Agent, type Message, type NecronEvent } from "../src/necron.js";

const model = {
  async complete(agent: Agent, messages: Message[]) {
    return `${agent.id}: ${messages.at(-1)?.content}`;
  },
};

test("directs a named specialist and emits a summary", async () => {
  const events: NecronEvent[] = [];
  const answer = await new Necron({ model }).run("@researcher What is known?", [], (event) => { events.push(event); });
  assert.equal(answer, "researcher: What is known?");
  assert.equal(events[0]?.type, "route");
  assert.deepEqual((events[0] as Extract<NecronEvent, { type: "route" }>).destination, { kind: "agent", id: "researcher" });
  assert.equal(events.at(-1)?.type, "summary");
});

test("a slop runs specialists then speaks through its coordinator", async () => {
  const called: string[] = [];
  const harness = new Necron({ model: {
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
  const events: NecronEvent[] = [];
  const harness = new Necron({ model: { async complete() { throw new Error("offline"); } } });
  await assert.rejects(harness.run("hello", [], (event) => { events.push(event); }), /offline/);
  assert.equal(events.at(-1)?.type, "failure");
});
