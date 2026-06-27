# Agent Council

The council is a deterministic group of role-based mock agents in v0.1. Each agent produces structured output rather than free-form text.

## Roles

- `IntentAgent`: validates the inferred goal and assumptions.
- `ProductAgent`: narrows MVP scope and defers expansion.
- `ArchitectAgent`: checks package boundaries and implementation shape.
- `SecurityAgent`: identifies sensitive features and unsafe defaults.
- `MaintainerAgent`: checks rollback, auditability, and long-term upkeep.
- `TesterAgent`: requires testability and verification clarity.
- `ReviewerAgent`: performs final review of plan constraints.

`BuilderAgent` is not a reviewer. It is part of the writer policy and may create patch proposals only through the controlled builder path.

## Flow

1. User writes a natural language request.
2. Intent inference creates a `GoalState`.
3. MVP ladder selects the smallest safe next step.
4. Each reviewer agent returns an `AgentFinding`.
5. The council produces a `CouncilDecision`.
6. BuilderRuntime creates a `PatchProposal`.
7. Verifier decides whether the proposal is accepted.
8. Memory records the decision log.

## Single Writer, Multi Reviewer

Only `BuilderAgent` or `BuilderRuntime` may produce a `PatchProposal`.

All other agents can:

- observe
- recommend
- identify risks
- approve
- request changes
- reject

They cannot modify files or produce patches.

## Structured Finding Shape

Each finding includes:

- role
- summary
- observations
- recommendations
- risks
- vote
- required actions
