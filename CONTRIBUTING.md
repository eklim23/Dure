# Contributing

Thanks for helping build AegisForge.

## Principles

- Keep the MVP ladder intact.
- Prefer small, reversible patches.
- Preserve Single Writer, Multi Reviewer.
- Do not add uncontrolled shell execution.
- Do not require external API keys for baseline tests.
- Record major decisions.

## Development

```bash
pnpm install
pnpm build
pnpm test
```

Run the CLI:

```bash
pnpm cli -- run "Create a simple login-enabled bulletin board"
```

## Package Boundaries

- Put shared contracts in `packages/core`.
- Keep orchestration in `packages/orchestrator`.
- Keep agent review behavior in `packages/council`.
- Keep patch proposal logic in `packages/builder-runtime`.
- Keep verification in `packages/verifier`.
- Keep skill metadata loading in `packages/skill-registry`.

## Pull Requests

Good PRs should include:

- a clear explanation of the goal
- focused changes
- tests for policy or behavior changes
- documentation updates when user-facing behavior changes

Avoid broad rewrites unless they remove real complexity or fix a concrete design problem.
