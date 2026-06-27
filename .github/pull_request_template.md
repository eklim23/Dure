## Summary

- What changed?
- Why is this the smallest useful change?

## Safety

- [ ] No uncontrolled shell execution was added.
- [ ] No external network/API behavior was added without an approval gate.
- [ ] Patch/apply behavior still follows Single Writer, Multi Reviewer.
- [ ] Bug bounty behavior remains passive unless explicit authorization exists.

## Verification

- [ ] `corepack pnpm test`
- [ ] Documentation updated for user-facing behavior.
- [ ] Decision log or run artifact behavior reviewed, if changed.

## Notes

Link related issues, design notes, or follow-up tasks here.
