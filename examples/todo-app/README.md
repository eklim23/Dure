# Todo App Example

This example is intentionally lightweight. It gives contributors a stable prompt to use when checking Development Mode behavior.

## Try It

```bash
corepack pnpm cli -- --mode development "Create a minimal todo CLI app"
```

In v0.1, Dure uses deterministic mock agents and produces `PatchProposal` summaries. It does not modify this example automatically unless the user explicitly approves and applies a controlled patch into a workspace.

## Expected Shape

- Intent Router selects Development Mode.
- Agent council proposes the smallest safe MVP step.
- BuilderRuntime emits a structured patch proposal.
- Verification and safety policy results are recorded.
- The run can be inspected with `dure runs`, `dure show <run-id>`, and `dure export <run-id>`.
