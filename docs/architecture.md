# Architecture

Dure v0.1 is assistant-first and mode-driven. The product direction has two primary modes: Development Mode and Bug Bounty Mode. The existing development orchestrator remains intact, but it now sits under a higher-level Assistant Core and Intent Router.

## Flow

```text
User Natural Language Input
  -> Assistant Core
  -> Intent Router
  -> Task Mode Selection
       -> Assistant Mode
       -> Development Mode
       -> Bug Bounty Mode
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

   - `dure "request"`
   - `dure --mode development "request"`
   - `dure --mode bug-bounty "request"`
   - `dure ask "request"`
   - `dure run "request"`

2. Assistant Core

   `packages/assistant-core` creates `AssistantRequestContext`, records assistant-level decisions, executes the selected task mode, and returns a unified result.

3. Intent Router

   `packages/intent-router` classifies requests into task modes using deterministic v0.1 routing. It returns confidence, assumptions, capabilities, safety requirements, rejected modes, and whether approval or external tools are required.

4. Task Modes

   `packages/task-modes` owns mode-specific deterministic behavior:

   - Development Mode returns a `PatchProposal`.
   - Bug Bounty Mode returns a `BugBountyReviewProposal`.
   - Documentation Mode returns a `DocumentProposal`.
   - Security Mode returns a `SecurityReviewProposal`.
   - Operations Mode returns an `OpsPlanProposal`.
   - Personal Productivity Mode returns a `ProductivityPlanProposal`.
   - Assistant Mode returns an `AssistantResponseProposal`.

5. Primary Modes

   Development Mode and Bug Bounty Mode are the primary product surface.

   Development Mode is for MVP-first software work and controlled patch proposals.

   Bug Bounty Mode is for authorized web security review planning. In v0.1 it creates only passive scope, target-map, hypothesis, evidence-ledger, and report scaffolds. It does not access targets or run active tests.

6. Development Orchestrator

   `packages/orchestrator` is reused by Development Mode. It keeps the previous design: `GoalState`, Agent Council, MVP Ladder, Single Writer / Multi Reviewer, `PatchProposal`, verification, and development decision logging.

7. Agent Councils

   `packages/council` contains deterministic mock development reviewers. Other task modes select lightweight role teams in `packages/task-modes` for v0.1.

8. Controlled Execution

   Development patches are proposals, not automatic edits. Bug Bounty Mode produces scope and evidence plans only until explicit authorization and rules of engagement are known.

9. Verification / Safety Gate

   `packages/verifier` handles patch verification. Non-development modes use `SafetyDecision` to record blocked placeholder integrations and approval needs.

10. Skill Registry

   `packages/skill-registry` previews manifests and refuses to load untrusted skills without explicit approval.

11. Memory / Decision Log

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

## Bug Bounty Safety Gate

Bug Bounty Mode must record:

- in-scope and out-of-scope assets
- allowed and forbidden techniques
- rate limits and automation rules
- authorized account roles
- no-real-user-data handling
- stop conditions
- evidence ledger fields
- report sections

Before scope is known, Dure should continue with passive planning only.

## Naming

The product name is Dure. Core abstractions still use generic assistant, routing, task mode, proposal, and safety concepts so the product can evolve without tying every type to the name.
