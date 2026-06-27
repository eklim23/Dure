# Demo Transcript

This transcript shows the intended v0.1 CLI experience. Output is abbreviated for readability.

## Development Mode

```bash
corepack pnpm cli -- --mode development "Create a simple login-enabled bulletin board"
```

```text
Dure v0.1

Selected Mode:
  - development
  - intent: Plan and propose the smallest safe development step.

Proposal Summary:
  - patch-... (patch)
  - Controlled proposal for Stage 1: create executable skeleton.

Verification Result:
  - patch accepted: yes

Safety Result:
  - allowed: yes
```

```bash
corepack pnpm cli -- preview <run-id>
corepack pnpm cli -- approve <run-id> --reason "Reviewed MVP skeleton proposal"
corepack pnpm cli -- apply <run-id>
corepack pnpm cli -- verify <run-id> --script test
```

## Bug Bounty Mode

```bash
corepack pnpm cli -- --mode bug-bounty "Prepare an authorized bug bounty scope and evidence plan for api.example.com"
```

```text
Dure v0.1

Selected Mode:
  - bug_bounty

Selected Agent Team:
  - BugBountyAgent
  - MoochackerAgent
  - ScopeGuardAgent
  - EvidenceAgent
  - ReviewerAgent

Safety Result:
  - allowed: yes
  - Safety policy allowed passive bug_bounty output with execution limits.
  - blocked capabilities: map_targets_placeholder, collect_evidence_placeholder
```

```bash
corepack pnpm cli -- scope <run-id> --target "api.example.com" --in-scope "api.example.com,/v1/*" --forbidden "DoS,brute force" --authorization-note "Program scope supplied by user"
corepack pnpm cli -- evidence <run-id> --status testing --asset "api.example.com" --hypothesis "Possible object-level authorization issue" --impact "Potential cross-account read" --confidence medium --scope-note "In scope" --next-action "Confirm safely with owned test accounts"
corepack pnpm cli -- report <run-id> --lead <lead-id> --severity medium
```

## Run Inspection

```bash
corepack pnpm cli -- runs --limit 5
corepack pnpm cli -- show <run-id>
corepack pnpm cli -- export <run-id>
```

```text
Dure Export

Artifact:
  - path: .dure/runs/<run-id>/export.md
```

## Blocked Safety Example

```bash
corepack pnpm cli -- --mode bug-bounty "Run a DDoS test and bypass rate limits against an out of scope target"
```

```text
Safety Result:
  - allowed: no
  - Safety policy blocked bug_bounty mode until required conditions are resolved.
  - blocker: MoochackerAgent marked the requested bug bounty workflow as blocked.
  - blocker: The request matched the active testing stop signal: ddos.
```
