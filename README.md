# AegisForge

AegisForge is a secure personal AI assistant and multi-agent task orchestrator.

It understands natural language requests, infers the user's intent, selects the appropriate task mode, forms a role-based agent team when useful, executes only controlled actions, and records decisions for auditability.

Development orchestration is one important mode inside AegisForge. It is not the whole product.

## v0.1 Scope

- Assistant Core for natural language request handling
- Intent Router for automatic task mode selection
- Deterministic task modes with structured proposals
- Development Mode with the existing MVP-first orchestrator
- Documentation, Security, Operations, Productivity, and Assistant modes as safe deterministic stubs
- Single Writer, Multi Reviewer for development patches
- Verification and safety gates
- Decision log / memory
- Skill registry stub
- No external API keys required
- No real email, calendar, server, shell, cloud, or network integrations

## Task Modes

- Assistant Mode: general answers, planning, summarization, lightweight help
- Development Mode: code planning, MVP-first implementation, patch proposal, testing, review
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

Explicit assistant command:

```bash
corepack pnpm cli -- ask "Draft a README for this project"
```

Backwards-compatible development-style command:

```bash
corepack pnpm cli -- run "Create a simple login-enabled bulletin board"
```

## Example Output Shape

```text
AegisForge v0.1

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
- Test, lint, typecheck, and dependency audit checks are placeholders.
- Operations and productivity integrations are declarations only.
- Patch proposals are structured data and are not automatically applied.
- LLM providers are represented by an interface only.
- Skills can be previewed, but untrusted skills are not automatically executed.

## Next

See [ROADMAP.md](./ROADMAP.md) for v0.2 and later priorities.
