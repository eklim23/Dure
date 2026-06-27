# Security

Dure is built around conservative agent control.

## Security Model

- Natural language input is converted into typed internal state.
- Generated work is represented as a `PatchProposal`.
- Only the builder path can create patch proposals.
- Review agents cannot write patches.
- Verification must pass before a proposal is accepted.
- v0.1 runs generated project commands only after approval and controlled apply.
- Applied workspace verification is limited to allow-listed `package.json` scripts: `test`, `lint`, and `typecheck`.
- Arbitrary shell commands, package installs, network audits, git commands, and pre/post lifecycle hooks are not allowed in the v0.1 verification path.
- Safety policy evaluation uses mode-specific capability allowlists and blocks external-tool execution by default.
- Bug bounty active-testing stop conditions block denial-of-service, brute force, rate-limit bypass, persistence, destructive testing, out-of-scope testing, and unauthorized access requests.
- Verification output is length-limited and redacts secret-like values before persistence.
- Bug bounty evidence ledger entries are user-supplied records only; Dure does not send requests, scan targets, exploit issues, or confirm findings in v0.1.
- Evidence ledger persistence applies local redaction for authorization headers, cookies, tokens, passwords, API keys, sessions, CSRF values, bearer tokens, and email-like personal data.
- Bug bounty report drafts are generated only from stored, redacted evidence; Dure does not submit reports, contact targets, or validate findings in v0.1.
- v0.1 does not execute untrusted skills.

## Responsible Disclosure

This project is new. Until a public security contact is configured, please open a private advisory or contact the maintainers through the repository owner.

Do not include live secrets in public issues.

## Reporting Useful Details

Please include:

- affected version or commit
- reproduction steps
- expected behavior
- actual behavior
- impact
- suggested mitigation if known
