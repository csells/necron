# Spork vision

Spork is an open-source, self-improving harness for agents that can work alone or together. Its defining idea is the **slop**: a group of agents that can act as one without making its members anonymous or unreachable.

A slop might be a pair, a team of peers, a department, or a hierarchy of teams. A human or another agent can give work to the slop and receive a coherent answer. Inside it, members can find each other, talk directly, and follow one another's progress. A chief of staff can also bypass the group to ask one specialist for the knowledge or skill only that individual has.

## What Spork should make possible

- **Assemble the right people for the work.** Agents can form and change slops within authority delegated to them. An agent can serve in several slops. A slop can itself join a larger slop. Each agent and slop keeps a stable identity that others can address.
- **Work together without constant supervision.** Members exchange work, updates, questions, and results as a task unfolds. They can monitor relevant activity through notifications. Messages addressed to an agent or slop wait for it when it is offline.
- **Speak naturally with humans.** Humans can talk to an individual or a slop and receive useful progress, questions, permission requests, summaries, and failures. A top-level Jarvis-style agent can act as chief of staff, keeping a person informed without making them manage every interaction.
- **Choose the right route.** Classification is built into how Spork chooses agents, slops, models, and providers. Laya is a candidate classifier, not a permanent dependency. Explicitly contacting a particular agent or slop remains possible.
- **Improve with experience.** Spork should learn from the outcomes of work and improve its own harness, with changes evaluated before they are adopted.
- **Travel across hosts and providers.** The harness should be useful outside BB and work with local or hosted models from different providers. The BB provider plugin is the first way to talk to it, not the boundary of the project.

## North-star experiences

1. **The team as one.** A human asks a slop to solve a problem. Its members coordinate, and the human gets one useful answer while retaining the ability to see the contributions behind it.
2. **The individual in the team.** The chief asks a particular specialist for a detail, receives the answer, and returns to the wider team without losing the thread of the work.
3. **The living organization.** As a problem grows, agents bring in other agents or slops, notify the right people, and adjust the team within their delegated authority.
4. **The improving harness.** Spork tries a better way to route, coordinate, remember, or use a model; measured results show whether to keep it.

## Inspiration

The [JAZ paper](https://arxiv.org/html/2609.26891v1) is a starting point for a small, expressive, self-improving agent loop. [Laya](https://flowtivity.ai/blog/laya-open-source-jev-alternative/) is one candidate for classification. Spork's center of gravity is agents and slops that can discover, address, observe, and work with one another.
