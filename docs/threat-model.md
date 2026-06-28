# Threat Model

Dure assumes autonomous coding systems can create real security, stability, and maintainability risk if they modify files without review.

## Assets

- User source code
- Local secrets and credentials
- Build and test environment
- Git history and audit trail
- Skill manifests and loaded tools
- Decision logs
- Bug bounty scope, evidence, and report drafts

## Primary Risks

1. Uncontrolled file modification

   A broad agent may overwrite unrelated files or introduce hard-to-review changes.

2. Secret exposure

   Generated patches may include tokens, keys, or copied private material.

3. Prompt or skill injection

   Untrusted skill content may attempt to override policy or request unsafe execution.

4. Unsafe shell execution

   Running tests, package managers, or scanners can trigger scripts, network calls, or destructive behavior.

5. Feature sprawl

   Implementing too much too early can hide security and rollback risks.

6. Weak auditability

   If decisions are not recorded, reviewers cannot understand why a patch exists.

7. Out-of-scope bug bounty testing

   Active testing without explicit authorization, scope, or rules of engagement can harm third-party systems or violate program rules.

## v0.1 Controls

- Natural language input is converted to a typed `GoalState`.
- The MVP ladder selects the smallest safe next step.
- Only `BuilderAgent` or `BuilderRuntime` can create `PatchProposal` objects.
- Reviewer agents cannot write patches.
- Verification must pass before a patch is accepted.
- Proposed paths must be relative and traversal-free.
- Secret scanning checks patch content with local patterns.
- Test, lint, typecheck, and dependency audit commands are placeholders unless they pass through the approval-controlled workspace verification path. Workspace verification records structured gates, failure reasons, and redacted output artifact metadata.
- Untrusted skills cannot be loaded automatically.
- Bug Bounty Mode produces passive plans only until scope and authorization are confirmed.
- Bug bounty evidence must avoid real user data and redact sensitive artifacts.

## Out Of Scope In v0.1

- Real shell execution for generated projects
- Network dependency auditing
- Real LLM provider calls
- Automatic application of generated patches
- Sandboxed execution of skill code
- Active bug bounty target testing

## Future Controls

- Explicit command approval workflow
- Isolated execution sandbox
- Cryptographic skill signatures
- Persistent append-only decision logs
- Policy packs for regulated environments
