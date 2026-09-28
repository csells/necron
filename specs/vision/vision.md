# Spork vision

**spork: the self-improving, self-organizing agent harness**

Spork is an open-source, general-purpose harness built around two promises: agents can organize themselves to tackle work together, and the harness can learn to do that work better over time.

A **slop** is a group of agents that can act as one without making its members anonymous or unreachable. It might be a pair, a team of peers, a department, or a hierarchy of teams. A human or agent can ask the slop to solve a problem and receive one coherent answer, then contact a particular specialist for knowledge or skill only that individual has.

## What Spork should make possible

- **Self-organizing teams.** Agents can form and change slops within delegated authority. An agent can serve in several slops; a slop can join a larger slop. Each retains a stable identity, so teams can evolve without losing their address or the people inside them.
- **Conversation and awareness.** Humans, agents, and slops can find and address one another. They exchange messages and monitor relevant work through asynchronous events and notifications. Addressed messages wait through a recipient's temporary absence. Progress, questions, permission requests, summaries, and failures reach the people or agents who need them.
- **A chief of staff.** A top-level Jarvis-style agent can assemble the right people, delegate to a slop, follow its progress, ask one member for a detail, and keep its human informed without demanding constant supervision.
- **Classification throughout.** Classification helps Spork understand incoming work, choose agents and slops, select models and providers, and decide what information needs attention. Classifiers are interchangeable: Laya is a candidate, not a dependency. Explicitly addressing someone remains possible.
- **Continual self-improvement.** Spork learns from outcomes, failures, and feedback. It can propose changes to its own routing, coordination, prompts, memory, tools, and model choices; compare a candidate with current behavior; and keep improvements that actually help. This is an ongoing capability of the harness, not just a new version number.
- **Provider and host freedom.** Spork works with local and hosted models across providers. BB is the first place to converse with it, while the harness remains useful in other hosts and applications.

## North-star experiences

1. **The team as one.** A human gives a slop a problem. Members coordinate, exchange updates, and return one useful answer. The human can see the contributions behind it when needed.
2. **The reachable specialist.** The chief asks one member for a detail, receives the answer, and returns to the wider team without losing the thread of the work.
3. **The living organization.** As work changes, agents bring in other agents or slops, adjust the team within their authority, and notify the right participants.
4. **The improving harness.** Spork notices a recurring weakness, tries a better way to work, measures the result, and adopts the change when it proves useful.

## Inspiration

The [JAZ paper](https://arxiv.org/html/2609.26891v1) is a starting point for an expressive, self-improving agent loop. [Laya](https://flowtivity.ai/blog/laya-open-source-jev-alternative/) is one candidate for classification. Spork's defining addition is agents and slops that can discover, address, observe, and work with one another.
