# Dure

Dure is a secure personal AI assistant and multi-agent task orchestrator focused on two primary workflows: development and authorized bug bounty work.

It understands natural language requests, infers the user's intent, selects the appropriate task mode, forms a role-based agent team when useful, executes only controlled actions, and records decisions for auditability.

Dure is intentionally mode-driven. The long-term product should make it easy to choose or infer one of two primary modes:

- Development Mode
- Bug Bounty Mode

Other assistant capabilities can exist as supporting utilities, but they should not blur the main product direction.

## v0.1 Scope

- Assistant Core for natural language request handling
- Intent Router for automatic task mode selection
- Deterministic task modes with structured proposals
- Development Mode with the existing MVP-first orchestrator
- Bug Bounty Mode with authorization, scope, evidence, and report gates
- Documentation, Security, Operations, Productivity, and Assistant modes as supporting deterministic stubs
- Single Writer, Multi Reviewer for development patches
- Verification and safety gates
- Decision log / memory
- Skill registry stub
- No external API keys required
- No real email, calendar, server, shell, cloud, or network integrations

## Primary Modes

- Development Mode: code planning, MVP-first implementation, patch proposal, testing, review
- Bug Bounty Mode: authorized web security review planning, scope control, MoochackerAgent safety assessment, endpoint mapping placeholders, evidence ledger scaffolding, report drafting

## Supporting Modes

- Assistant Mode: general answers, planning, summarization, lightweight help
- Documentation Mode: README, reports, specs, architecture docs, summaries
- Security Mode: security review, threat modeling, dependency risk, secret scanning placeholders
- Operations Mode: server/project status review, deployment planning, log review placeholders
- Personal Productivity Mode: schedule/email/task planning placeholders

## Install

```bash
cd C:\Users\eklim\EKLIM\Works\Dure
corepack pnpm install
corepack pnpm build
```

## Run

Assistant-first:

```bash
corepack pnpm cli -- "Create a simple login-enabled bulletin board"
```

Force one of the primary modes:

```bash
corepack pnpm cli -- --mode development "Create a simple login-enabled bulletin board"
corepack pnpm cli -- --mode bug-bounty "Prepare an authorized bug bounty scope and evidence plan"
```

Explicit assistant command:

```bash
corepack pnpm cli -- ask "Draft a README for this project"
```

Backwards-compatible development-style command:

```bash
corepack pnpm cli -- run "Create a simple login-enabled bulletin board"
```

Preview a persisted development patch proposal:

```bash
corepack pnpm cli -- preview <run-id>
```

The preview command is read-only. It loads `.dure/runs/<run-id>/`, prints the patch summary, proposed file changes, and verification summary, and does not approve, apply, or execute anything.

Approve or reject a persisted patch proposal:

```bash
corepack pnpm cli -- approve <run-id> --reason "Reviewed the patch proposal"
corepack pnpm cli -- reject <run-id> --reason "Needs a narrower scope"
```

Approval records `.dure/runs/<run-id>/approval.json`, updates run metadata to `approved` or `rejected`, and appends to `decision-log.jsonl`. It does not apply files, run commands, commit, push, or execute tests.

Record bug bounty scope intake:

```bash
corepack pnpm cli -- scope <run-id> --target "api.example.com" --in-scope "api.example.com,/v1/*" --out-of-scope "admin.example.com" --allowed "read-only authorization checks" --forbidden "DoS,brute force" --rate-limit "10 requests per minute" --roles "user,admin-test" --data "redact tokens and personal data" --authorization-note "Program scope supplied by user"
```

Scope intake writes `.dure/runs/<run-id>/scope.json`, records MoochackerAgent's passive scope assessment, and never contacts the target.

## Example Output Shape

```text
Dure v0.1

Original Request:
  - Create a simple login-enabled bulletin board

Selected Mode:
  - development
  - confidence: 0.95
  - intent: Plan and propose the smallest safe development step.

Assistant Core Summary:
  - requires approval: yes
  - external tools required: no
  - capabilities: read_project_files, propose_file_changes, run_tests_placeholder

Proposal Summary:
  - patch-... (patch)
  - Controlled proposal for Stage 1: create executable skeleton.

Verification Result:
  - patch accepted: yes
```

Patch preview example:

```text
Dure Preview

Run:
  - id: run-20260627-000003Z-abc123
  - mode: development
  - run status: proposed
  - proposal: patch-...

Patch:
  - status: accepted
  - risk: high
  - approval required: yes
```

Approval example:

```text
Dure Approval

Run:
  - id: run-20260627-000003Z-abc123
  - previous status: proposed
  - new status: approved
  - proposal: patch-...
```

Bug bounty scope example:

```text
Dure Bug Bounty Scope

Scope:
  - status: sufficient
  - safety: caution
  - in scope: api.example.com, /v1/*
  - forbidden: DoS, brute force
```

Bug bounty example:

```text
Dure v0.1

Original Request:
  - Prepare an authorized bug bounty scope and evidence plan

Selected Mode:
  - bug_bounty
  - intent: Prepare an authorized bug bounty workflow with scope, evidence, and reporting gates.

Proposal Summary:
  - proposal-bug-bounty-review-... (bug_bounty_review)
  - Bug bounty review proposal with scope and evidence gates.

Safety Result:
  - Only a plan was produced; real external integrations remain blocked in v0.1.
```

## Workspace Layout

```text
apps/cli                 CLI entry point
packages/core            Shared strict types
packages/assistant-core  Assistant-level request context and run flow
packages/intent-router   Deterministic task mode classification
packages/task-modes      Mode-specific deterministic proposal builders
packages/orchestrator    Development mode intent, MVP ladder, council, verification
packages/council         Deterministic mock reviewer agents
packages/builder-runtime Single-writer patch proposal runtime
packages/verifier        Verification gate interfaces and local scans
packages/skill-registry  Previewable skill manifest registry
packages/sandbox         Controlled path and workspace helpers
packages/memory          Decision log recorder
docs/                    Architecture, threat model, council, skills
skills/                  Example local skill manifests
examples/                Future example projects
```

## What Is Mocked In v0.1

- Agent reasoning is deterministic and rule-based.
- Task mode routing is keyword/signal based.
- MoochackerAgent produces structured bug bounty safety guidance only; active testing, target access, and external requests are not executed.
- Approval records are durable gates for later controlled apply; approval itself does not modify files.
- Test, lint, typecheck, and dependency audit checks are placeholders.
- Operations and productivity integrations are declarations only.
- Patch proposals are structured data and are not automatically applied.
- LLM providers are represented by an interface only.
- Skills can be previewed, but untrusted skills are not automatically executed.

## Next

See [ROADMAP.md](./ROADMAP.md) for v0.2 and later priorities.
