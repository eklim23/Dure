# Release Checklist

Use this checklist before tagging a Dure release.

## Scope

- [ ] Confirm the release goal and version.
- [ ] Confirm no unfinished experimental UI or external integration is included.
- [ ] Confirm v0.1 behavior remains deterministic and usable without API keys.
- [ ] Confirm bug bounty flows remain passive unless explicit authorization and future adapter layers exist.

## Verification

- [ ] `corepack pnpm install --frozen-lockfile`
- [ ] `corepack pnpm test`
- [ ] Smoke: `corepack pnpm cli -- --mode development "Create a tiny CLI app"`
- [ ] Smoke: `corepack pnpm cli -- --mode bug-bounty "Prepare an authorized bug bounty scope and evidence plan"`
- [ ] Smoke: `corepack pnpm cli -- runs --limit 5`

## Documentation

- [ ] README command examples still match CLI behavior.
- [ ] ROADMAP reflects completed and next work.
- [ ] SECURITY reflects current safety gates.
- [ ] Demo transcript is updated.
- [ ] Architecture diagram still matches package boundaries.

## GitHub

- [ ] CI is passing on `main`.
- [ ] Issues and PR templates render correctly.
- [ ] Release notes mention known mocked behavior.
- [ ] Tag format is `vX.Y.Z`.

## v0.1 Known Limits

- No web UI.
- No real LLM provider wiring.
- No arbitrary shell execution.
- No external bug bounty target access, scanning, exploitation, or report submission.
- No rollback command yet, only rollback metadata.
