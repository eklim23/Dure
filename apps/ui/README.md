# Dure Console Prototype

`apps/ui` is a static, read-only Stage 16 prototype for visualizing how Dure's agents coordinate.

Open `index.html` directly in a browser. The prototype has no backend, no network calls, no persistence, no target access, and no patch application behavior.

## What It Shows

- Development Mode with green operational lighting
- Bug Bounty / Security Mode with red operational lighting
- Clickable agent dots with distinct shapes
- Curated internal discussion notes for each agent
- PM approval criteria for the prototype scope
- Explicit simulated/read-only status copy

## What It Does Not Do

- It does not execute tasks.
- It does not call an LLM provider.
- It does not read or write run records.
- It does not scan targets or make HTTP requests.
- It does not approve, apply, or verify patches.

