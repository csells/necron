# Spork

**spork: the self-improving, self-organizing agent harness**

An open-source, provider-neutral agent harness for one agent or a **slop** of agents. The BB plugin in this repo makes the first implementation available as a chat provider.

## What works today

- A typed async event stream for routes, progress, addressed agent messages, summaries, failures, questions, and permission requests. Human interaction events are reserved for the next slice.
- A classifier interface, with a deterministic mention classifier as the first implementation. Every input goes through it. A model classifier such as Laya can replace it without changing the runtime.
- Three agents: `chief`, `researcher`, and `builder`. In the `crew` slop, the researcher sends work to the builder, the builder replies, the researcher reviews that reply, and both send their work to the chief for one answer. BB shows the message and progress events.
- An OpenAI-compatible Chat Completions adapter. It defaults to a local Ollama endpoint and model; an API base URL, model, and optional key can point it elsewhere.
- A BB provider bridge with thread lifecycle, model listing, health, conversation history, and turn events.

This is a conversational minimum. The crew exchange is a fixed workflow within one run; agents cannot yet choose recipients, discover peers, form slops, or leave durable messages. Spork also has no tools, autonomous code changes, or evaluation-driven self-improvement yet.

## Talk to it in BB

Install [BB](https://getbb.app/) 0.43 or newer, start [Ollama](https://ollama.com/), and pull a model:

```sh
ollama pull qwen3:4b-instruct-2507-q4_K_M
bb plugin install https://github.com/csells/spork --yes
```

Choose **Spork** as the provider for a BB thread. Ask normally to reach `chief`. Start a prompt with `@researcher` or `@builder` to reach that agent, or `@crew` to consult the slop. Example:

```text
@crew How should we structure a resumable ingestion pipeline?
```

The default endpoint is `http://127.0.0.1:11434/v1`. Change the plugin's **Model API base URL** and **Model** settings to use another OpenAI-compatible endpoint. Set `SPORK_API_KEY` in BB's host environment if that endpoint requires a bearer token. The endpoint and model are configuration; the harness has no dependency on Ollama itself.

## Develop

```sh
npm install
npm run check
npm run build
bb plugin install . --yes
```

The standalone runtime API is in [`src/spork.ts`](src/spork.ts). The BB provider adapter is in [`src/provider-bridge.ts`](src/provider-bridge.ts). `npm run check` runs type checking, core tests, and BB's provider protocol conformance suite.

## Next slices

1. Stream model deltas through the event bus and BB timeline.
2. Add human question and permission round trips through BB's interaction protocol.
3. Add agent identity, discovery, durable inboxes, and slop membership APIs so agents can choose whom to contact and organize their own work.
4. Add classifier adapters and routing evaluations, including Laya when it is the best fit.
5. Add candidate generation, sandboxed trials, scored evaluations, and human approval for changes to the harness.

## License

MIT. See [LICENSE](LICENSE).
