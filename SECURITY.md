# Security

AegisForge is built around conservative agent control.

## Security Model

- Natural language input is converted into typed internal state.
- Generated work is represented as a `PatchProposal`.
- Only the builder path can create patch proposals.
- Review agents cannot write patches.
- Verification must pass before a proposal is accepted.
- v0.1 does not run generated project shell commands.
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
