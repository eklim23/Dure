# Contributing

Thanks for helping build Dure.

This project optimizes for stability, auditability, and conservative automation. A small, reviewable change is better than a broad rewrite.

## Principles

- Keep the MVP ladder intact.
- Prefer small, reversible patches.
- Preserve Single Writer, Multi Reviewer.
- Do not add uncontrolled shell execution.
- Do not require external API keys for baseline tests.
- Record major decisions.
- Keep Bug Bounty Mode passive unless explicit authorization, scope, and a future approved adapter layer exist.
- Treat `.dure/runs` as local generated state and do not commit it.

## Development

```bash
corepack enable
corepack pnpm install
corepack pnpm build
corepack pnpm test
```

Run the CLI:

```bash
corepack pnpm cli -- run "Create a simple login-enabled bulletin board"
```

## Package Boundaries

- Put shared contracts in `packages/core`.
- Keep orchestration in `packages/orchestrator`.
- Keep agent review behavior in `packages/council`.
- Keep patch proposal logic in `packages/builder-runtime`.
- Keep verification in `packages/verifier`.
- Keep safety policy in `packages/safety-policy`.
- Keep skill metadata loading in `packages/skill-registry`.

## Local Checklist

Before opening a PR:

- Run `corepack pnpm test`.
- Add or update tests when behavior changes.
- Update docs when CLI output, run artifacts, or safety behavior changes.
- Confirm no generated `.dure/`, `dist/`, secrets, or local reports are staged.

## Pull Requests

Good PRs should include:

- a clear explanation of the goal
- focused changes
- tests for policy or behavior changes
- documentation updates when user-facing behavior changes

Avoid broad rewrites unless they remove real complexity or fix a concrete design problem.

Use the PR template. For release work, use [docs/release-checklist.md](./docs/release-checklist.md).
