import { createServer } from "node:http";
import { createRequire } from "node:module";
import { afterAll, beforeAll, expect, test } from "vitest";

// The SDK's published ESM bundle includes a CommonJS dependency.
(globalThis as { require?: NodeRequire }).require = createRequire(import.meta.url);
const { experimental_captureBridgeJsonRpcOutput, experimental_runBridgeConformance } = await import("@get-bb/plugin-sdk/provider-bridge/testing");
const { handleLine } = await import("../src/provider-bridge.js");

const server = createServer((_request, response) => {
  response.setHeader("content-type", "application/json");
  response.end(JSON.stringify({ choices: [{ message: { content: "Hello from Spork" } }] }));
});

beforeAll(async () => {
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("No test server port");
  process.env.SPORK_BASE_URL = `http://127.0.0.1:${address.port}/v1`;
  process.env.SPORK_MODEL = "test-model";
});
afterAll(async () => {
  await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  delete process.env.SPORK_BASE_URL;
  delete process.env.SPORK_MODEL;
});

test("BB provider bridge passes the canonical protocol suite", async () => {
  const output = experimental_captureBridgeJsonRpcOutput();
  try {
    const report = await experimental_runBridgeConformance({
      transport: { send: handleLine, takeMessages: output.takeMessages },
      providerId: "spork",
      session: {
        cwd: process.cwd(),
        promptInput: [{ type: "text", text: "say hello", mentions: [] }],
        zeroWorkPromptInput: [{ type: "text", text: "/noop", mentions: [] }],
      },
      timeoutMs: 10_000,
    });
    expect(report.passed, JSON.stringify(report.results)).toBe(true);
  } finally {
    output.restore();
  }
});
