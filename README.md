# Dure

[![CI](https://github.com/eklim23/Dure/actions/workflows/ci.yml/badge.svg)](https://github.com/eklim23/Dure/actions/workflows/ci.yml)

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
- Development Mode with the existing MVP-first orchestrator, read-only project state detection, and patch preview metadata
- Bug Bounty Mode with authorization, scope, passive target mapping, evidence, and report gates
- Documentation, Security, Operations, Productivity, and Assistant modes as supporting deterministic stubs
- Single Writer, Multi Reviewer for development patches
- Verification and safety policy gates
- Decision log / memory
- Skill registry stub
- Read-only Dure Console static UI prototype
- No external API keys required
- No real email, calendar, server, shell, cloud, or network integrations

## Primary Modes

- Development Mode: code planning, read-only project state detection, MVP-first implementation, patch proposal, patch preview, testing, review
- Bug Bounty Mode: authorized web security review planning, scope control, MoochackerAgent safety assessment, passive target mapping, evidence ledger scaffolding, report drafting

## Supporting Modes

- Assistant Mode: general answers, planning, summarization, lightweight help
- Documentation Mode: README, reports, specs, architecture docs, summaries
- Security Mode: security review, threat modeling, dependency risk, secret scanning placeholders
- Operations Mode: server/project status review, deployment planning, log review placeholders
- Personal Productivity Mode: schedule/email/task planning placeholders

## Install

Requirements:

- Node.js 22+
- pnpm 9+ through Corepack

```bash
cd C:\Users\eklim\EKLIM\Works\Dure
corepack enable
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

Inspect persisted runs:

```bash
corepack pnpm cli -- runs --limit 10
corepack pnpm cli -- show <run-id>
corepack pnpm cli -- export <run-id>
corepack pnpm cli -- console-data <run-id> --output .dure/runs/<run-id>/console-data.json
```

`runs` lists recent `.dure/runs` records, `show` prints a mode-neutral run summary, `export` writes a redacted Markdown audit summary to `.dure/runs/<run-id>/export.md`, and `console-data` emits a redacted read-only JSON snapshot for the static UI prototype.

Development runs also persist `.dure/runs/<run-id>/project-state.json`. This records file index summary, package manager evidence, detected languages/frameworks, configured `test`/`lint`/`typecheck`/`build` scripts, and a current MVP stage estimate. Dure does not execute those scripts during project state detection.

Preview a persisted development patch proposal:

```bash
corepack pnpm cli -- preview <run-id>
```

The preview command is read-only. It loads `.dure/runs/<run-id>/`, prints the patch summary, risk assessment, file-level change plan, proposed unified diff, and verification summary, and does not approve, apply, or execute anything.

Approve or reject a persisted patch proposal:

```bash
corepack pnpm cli -- approve <run-id> --confirm-risk medium --reason "Reviewed the patch proposal"
corepack pnpm cli -- reject <run-id> --reason "Needs a narrower scope"
```

Approval records `.dure/runs/<run-id>/approval.json`, stores a policy checklist, captures risk confirmation, sets an approval expiration timestamp, updates run metadata to `approved` or `rejected`, and appends to `decision-log.jsonl`. Medium/high risk patches and separate-approval conditions require `--confirm-risk <level>`. Approval does not apply files, run commands, commit, push, or execute tests.

Apply an approved patch to a controlled workspace:

```bash
corepack pnpm cli -- apply <run-id>
corepack pnpm cli -- apply <run-id> --workspace C:\path\to\controlled-workspace
```

Without `--workspace`, Dure applies into `.dure/workspaces/<run-id>`. Apply requires an approved, unexpired, verified patch proposal, runs a local preflight, writes only create/modify operations, blocks deletes, unsafe paths, unsafe workspace roots, and symlinked paths, records `apply.json` and `rollback.json`, and does not run verification or git commands.

Verify an applied workspace:

```bash
corepack pnpm cli -- verify <run-id>
corepack pnpm cli -- verify <run-id> --script test --timeout-ms 30000
```

Verification only runs allow-listed `package.json` scripts: `test`, `lint`, and `typecheck`. It must target the same workspace recorded in `apply.json`, blocks pre/post lifecycle hooks in v0.1, redacts secret-like output, records `workspace-verification.json` plus `verification-output/`, stores structured summary/gate/output artifact metadata, and updates the run to `verified` or `failed`.

Record bug bounty scope intake:

```bash
corepack pnpm cli -- scope <run-id> --target "api.example.com" --in-scope "api.example.com,/v1/*" --out-of-scope "admin.example.com" --allowed "read-only authorization checks" --forbidden "DoS,brute force" --rate-limit "10 requests per minute" --roles "user,admin-test" --data "redact tokens and personal data" --authorization-note "Program scope supplied by user"
```

Scope intake writes `.dure/runs/<run-id>/scope.json`, records MoochackerAgent's passive scope assessment, stores an intake checklist, classifies target boundaries, redacts secret-like scope fields, and never contacts the target.

Record or list a passive bug bounty target map:

```bash
corepack pnpm cli -- target-map <run-id>
corepack pnpm cli -- target-map <run-id> --host "api.example.com" --app "Public API" --api-base "https://api.example.com/v1" --auth-state "authenticated" --role-access "user|authenticated|GET /v1/orders/{id}|GET /admin|Owned test user only" --endpoint "GET|api.example.com|/v1/orders/{id}|authenticated|user|false|none|id|||Read order detail" --artifact "user supplied OpenAPI excerpt"
```

Target maps require a sufficient scope intake and write `.dure/runs/<run-id>/target-map.json`. They record hosts, apps, API bases, auth states, role access, endpoints, state-changing actions, file upload/download flows, redirects, third-party integrations, source artifacts, out-of-scope references, redaction metadata, and next recommended actions. Dure builds this only from user-supplied artifacts and makes no requests in v0.1.

Record or list bug bounty evidence leads:

```bash
corepack pnpm cli -- evidence <run-id>
corepack pnpm cli -- evidence <run-id> --status testing --asset "api.example.com" --endpoint "/v1/orders/{id}" --method GET --role "user" --hypothesis "Possible object-level authorization issue" --impact "Potential cross-account order detail exposure" --confidence medium --scope-note "api.example.com and /v1/* are in scope" --next-action "Confirm safely with owned test accounts"
```

Evidence entries are append-only records in `.dure/runs/<run-id>/evidence-ledger.jsonl`. Dure records lead id, hypothesis, status, request/response placeholders, impact, confidence, scope notes, and next action. It applies redaction before persistence and does not send HTTP requests, run scanners, access targets, or validate findings in v0.1.

Draft or list bug bounty reports:

```bash
corepack pnpm cli -- report <run-id>
corepack pnpm cli -- report <run-id> --lead <lead-id> --severity medium --title "Confirmed cross-account order detail exposure"
```

Report drafts are generated from existing evidence ledger entries only. Dure writes `.dure/runs/<run-id>/reports/<report-id>.json` and `.md`, calibrates severity conservatively, blocks high or critical severity for unconfirmed leads, and does not validate, reproduce, submit, or disclose findings in v0.1.

## UI Prototype

Dure also includes a static, read-only console prototype:

```text
apps/ui/index.html
```

Open that file directly in a browser to preview the Stage 16 UI concept. It shows clickable agent dots, curated council discussion, green Development Mode lighting, and red Bug Bounty / Security Mode lighting.

To inspect a persisted run in the prototype, generate a console snapshot and import the JSON from the Run Snapshot panel:

```bash
corepack pnpm cli -- console-data <run-id> --output .dure/runs/<run-id>/console-data.json
```

Imported development snapshots can also show detected project state plus patch preview risk and file counts. The prototype is intentionally local-only. It does not call a backend, store run records, execute tools, scan targets, approve patches, apply files, or verify workspaces. Browser import uses a user-selected JSON file rather than direct filesystem access.

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

Patch Risk:
  - overall risk: high
  - separate approval required: yes

File-Level Change Plan:
  - package.json: modify, medium risk

Unified Diff:
  diff --git a/package.json b/package.json
```

Approval example:

```text
Dure Approval

Run:
  - id: run-20260627-000003Z-abc123
  - previous status: proposed
  - new status: approved
  - proposal: patch-...

Approval Policy:
  - risk: medium
  - confirmation required: yes
  - confirmed risk: medium
```

Bug bounty scope example:

```text
Dure Bug Bounty Scope

Scope:
  - status: sufficient
  - safety: safe
  - in scope: api.example.com, /v1/*
  - forbidden: DoS, brute force

Intake Assessment:
  - missing fields: none
  - blocked reasons: none
  - redacted fields: none

Boundaries:
  - in_scope: host api.example.com -> api.example.com
```

Bug bounty evidence example:

```text
Dure Evidence

Run:
  - id: run-20260627-000003Z-abc123
  - lead: lead-20260627-000004Z-def456

Lead:
  - status: testing
  - confidence: medium
  - asset: api.example.com

Redaction:
  - applied: yes
```

Bug bounty report draft example:

```text
Dure Report Draft

Run:
  - id: run-20260627-000003Z-abc123
  - report: report-20260627-000005Z-ghi789
  - lead: lead-20260627-000004Z-def456

Finding:
  - title: Confirmed cross-account order detail exposure
  - severity: medium
  - confidence: high
  - asset: api.example.com

Artifacts:
  - markdown: .dure/runs/run-20260627-000003Z-abc123/reports/report-20260627-000005Z-ghi789.md
```

Controlled apply example:

```text
Dure Apply

Run:
  - id: run-20260627-000003Z-abc123
  - previous status: approved
  - new status: applied

Preflight:
  - checks passed: 6/6
  - creates: 2
  - modifies: 0
  - backups planned: 0

Changes:
  - create: package.json
  - create: src/index.js
```

Workspace verification example:

```text
Dure Verification

Run:
  - id: run-20260627-000003Z-abc123
  - previous status: applied
  - new status: verified

Summary:
  - passed commands: 1
  - required gates passed: yes
  - dependency audit: placeholder

Commands:
  - test: passed (exit 0, 320ms)
  - lint: not_configured (exit n/a, 0ms)

Verification Gates:
  - passed: test (required)
  - skipped: dependency_audit (optional)
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
packages/builder-runtime Single-writer patch proposal runtime and preview metadata
packages/verifier        Verification gate interfaces and local scans
packages/safety-policy   Mode capability policy and stop-condition engine
packages/skill-registry  Previewable skill manifest registry
packages/sandbox         Controlled path and workspace helpers
packages/memory          Decision log, run store, and Markdown run export
docs/                    Architecture, threat model, council, skills
skills/                  Example local skill manifests
examples/                Future example projects
```

## Project Docs

- [Architecture](./docs/architecture.md)
- [Architecture diagram](./docs/architecture-diagram.md)
- [Threat model](./docs/threat-model.md)
- [Agent council](./docs/agent-council.md)
- [Skill format](./docs/skill-format.md)
- [Demo transcript](./docs/demo-transcript.md)
- [Release checklist](./docs/release-checklist.md)
- [Roadmap](./ROADMAP.md)
- [Security](./SECURITY.md)
- [Contributing](./CONTRIBUTING.md)
- [Code of conduct](./CODE_OF_CONDUCT.md)

## What Is Mocked In v0.1

- Agent reasoning is deterministic and rule-based.
- Task mode routing is keyword/signal based.
- Development project state detection is static and local; it reads manifests, lockfiles, file names, and package scripts but does not execute scripts.
- Development patch previews are proposal-generated; modify/delete diffs use placeholders instead of reading existing file content.
- Safety policy evaluation is deterministic and local; policy configuration is not user-editable yet.
- Run export produces a local redacted Markdown summary; richer export formats are not implemented yet.
- MoochackerAgent produces structured bug bounty safety guidance only; active testing, target access, and external requests are not executed.
- Bug bounty evidence records are user-supplied ledger entries; Dure does not prove, reproduce, or actively test findings in v0.1.
- Bug bounty report drafts are generated from stored evidence only; Dure does not validate findings, submit reports, or contact targets.
- Bug bounty scope intake assessment is passive and local; it classifies user-supplied boundaries but does not discover related assets.
- Approval records are durable gates for later controlled apply; approval itself does not modify files and expires before stale apply operations.
- Controlled apply writes only approved patch content into a controlled workspace after preflight checks and records rollback metadata, but rollback execution is not implemented yet.
- Proposal-time test, lint, and typecheck checks are placeholders.
- Applied workspace verification can run allow-listed `test`, `lint`, and `typecheck` package scripts only, with structured gate summaries and redacted output artifact metadata.
- Dependency audit remains a placeholder and never contacts registries in v0.1.
- Operations and productivity integrations are declarations only.
- Patch proposals are structured data and are not automatically applied.
- LLM providers are represented by an interface only.
- Skills can be previewed, but untrusted skills are not automatically executed.

## Next

See [ROADMAP.md](./ROADMAP.md) for v0.2 and later priorities.

## License

Dure is released under the [MIT License](./LICENSE).
