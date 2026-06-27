# Architecture

AegisForge v0.1 is assistant-first. The development orchestrator remains intact, but it now sits under a higher-level Assistant Core and Intent Router.

## Flow

```text
User Natural Language Input
  -> Assistant Core
  -> Intent Router
  -> Task Mode Selection
       -> Assistant Mode
       -> Development Mode
       -> Documentation Mode
       -> Security Mode
       -> Operations Mode
       -> Personal Productivity Mode
  -> Mode-specific Agent Team
  -> Controlled Execution / Proposal
  -> Verification / Safety Gate
  -> Decision Log / Memory
```

## Layers

1. CLI

   `apps/cli` accepts natural language directly:

   - `aegisforge "request"`
   - `aegisforge ask "request"`
   - `aegisforge run "request"`

2. Assistant Core

   `packages/assistant-core` creates `AssistantRequestContext`, records assistant-level decisions, executes the selected task mode, and returns a unified result.

3. Intent Router

   `packages/intent-router` classifies requests into task modes using deterministic v0.1 routing. It returns confidence, assumptions, capabilities, safety requirements, rejected modes, and whether approval or external tools are required.

4. Task Modes

   `packages/task-modes` owns mode-specific deterministic behavior:

   - Development Mode returns a `PatchProposal`.
   - Documentation Mode returns a `DocumentProposal`.
   - Security Mode returns a `SecurityReviewProposal`.
   - Operations Mode returns an `OpsPlanProposal`.
   - Personal Productivity Mode returns a `ProductivityPlanProposal`.
   - Assistant Mode returns an `AssistantResponseProposal`.

5. Development Orchestrator

   `packages/orchestrator` is reused by Development Mode. It keeps the previous design: `GoalState`, Agent Council, MVP Ladder, Single Writer / Multi Reviewer, `PatchProposal`, verification, and development decision logging.

6. Agent Councils

   `packages/council` contains deterministic mock development reviewers. Other task modes select lightweight role teams in `packages/task-modes` for v0.1.

7. Controlled Execution

   Development patches are proposals, not automatic edits. Non-development modes produce structured proposals only.

8. Verification / Safety Gate

   `packages/verifier` handles patch verification. Non-development modes use `SafetyDecision` to record blocked placeholder integrations and approval needs.

9. Skill Registry

   `packages/skill-registry` previews manifests and refuses to load untrusted skills without explicit approval.

10. Memory / Decision Log

   `packages/memory` records assistant-level routing, selected agent team, produced proposal, safety decision, and next recommended step.

## MVP Ladder For Development Mode

```text
Stage 0: understand project
Stage 1: create executable skeleton
Stage 2: implement one core feature
Stage 3: add tests
Stage 4: add validation and error handling
Stage 5: security and maintainability review
Stage 6: deferred feature expansion
Stage 7: documentation
```

## Naming

The product is currently named AegisForge, but core abstractions use generic assistant, routing, task mode, proposal, and safety concepts so the name can be changed later with limited surface area.
