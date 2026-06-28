# Architecture Diagram

```mermaid
flowchart TD
  User["User natural language request"] --> CLI["apps/cli"]
  User --> UI["apps/ui static Dure Console prototype"]
  UI --> UIState["Local mock agent activity only"]
  CLI --> AssistantCore["packages/assistant-core"]
  AssistantCore --> IntentRouter["packages/intent-router"]
  IntentRouter --> TaskModes["packages/task-modes"]

  TaskModes --> Development["Development Mode"]
  TaskModes --> BugBounty["Bug Bounty Mode"]
  TaskModes --> Supporting["Supporting Modes"]

  Development --> Orchestrator["packages/orchestrator"]
  Development --> ProjectState["DevelopmentProjectState static detector"]
  Orchestrator --> Council["packages/council"]
  Orchestrator --> BuilderRuntime["packages/builder-runtime"]
  BuilderRuntime --> PatchPreview["PatchPreview metadata"]
  BuilderRuntime --> Sandbox["packages/sandbox"]
  Orchestrator --> Verifier["packages/verifier"]

  BugBounty --> Moochacker["MoochackerAgent safety assessment"]
  BugBounty --> Scope["Scope intake"]
  BugBounty --> Evidence["Evidence ledger"]
  BugBounty --> Report["Report draft"]

  TaskModes --> SafetyPolicy["packages/safety-policy"]
  SafetyPolicy --> SafetyDecision["SafetyDecision"]
  Verifier --> SafetyDecision

  AssistantCore --> Memory["packages/memory"]
  Memory --> Runs[".dure/runs/<run-id>"]
  Runs --> DecisionLog["decision-log.jsonl"]
  Runs --> ProjectStateJson["project-state.json"]
  Runs --> Export["export.md"]
  Runs --> ConsoleData["console-data JSON"]
  ConsoleData --> UI

  SkillRegistry["packages/skill-registry"] --> AssistantCore
```

## Boundaries

- `apps/cli` is the only user-facing app in v0.1.
- `apps/ui` is a read-only static prototype; it can import user-selected console-data JSON and does not execute, persist, scan, approve, apply, verify, or call a backend.
- `packages/core` owns shared types.
- `packages/assistant-core` coordinates routing, mode execution, safety decision persistence, and run records.
- `packages/task-modes` produces deterministic proposals.
- Development project state detection is static and local; it reads metadata but does not execute scripts.
- Patch preview metadata is proposal-generated and read-only; it summarizes risk, file-level change plans, and unified diff text before approval.
- `packages/safety-policy` decides whether capabilities are allowed, warning-only, or blocked.
- `packages/memory` persists run artifacts and redacted Markdown exports.
- `packages/verifier` performs proposal-time and approved-workspace verification.

No package may add uncontrolled shell execution, live bug bounty testing, or external integrations without an explicit approval layer.
