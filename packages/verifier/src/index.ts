import type { PatchProposal, VerificationCheck, VerificationResult } from "@aegisforge/core";
import { ControlledWorkspace } from "@aegisforge/sandbox";

const SECRET_PATTERNS: readonly RegExp[] = [
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
  /\bAKIA[0-9A-Z]{16}\b/,
  /\b(api[_-]?key|secret|token)\s*[:=]\s*["'][^"']{8,}["']/i
];

export class PatchVerifier {
  private readonly workspace = new ControlledWorkspace();

  verifyPatch(proposal: PatchProposal): VerificationResult {
    const checks = [
      this.placeholder("test", "Test command placeholder passed.", [
        "No shell command is executed in v0.1.",
        "Future versions should run an approved test command."
      ]),
      this.placeholder("lint", "Lint command placeholder passed.", [
        "No linter is executed in v0.1.",
        "The check is represented so policy can depend on it."
      ]),
      this.placeholder("typecheck", "Typecheck command placeholder passed.", [
        "No project typecheck command is executed in v0.1.",
        "AegisForge itself is still typechecked by its package scripts."
      ]),
      this.securityScan(proposal),
      this.secretScan(proposal),
      this.placeholder("dependency_audit", "Dependency audit placeholder passed.", [
        "No network access or package audit is executed in v0.1."
      ])
    ] satisfies VerificationCheck[];

    return {
      patchId: proposal.id,
      accepted: checks.every((check) => check.passed),
      checks,
      completedAt: new Date().toISOString()
    };
  }

  private placeholder(
    name: VerificationCheck["name"],
    summary: string,
    details: readonly string[]
  ): VerificationCheck {
    return {
      name,
      passed: true,
      mocked: true,
      summary,
      details
    };
  }

  private securityScan(proposal: PatchProposal): VerificationCheck {
    const safety = this.workspace.validatePatchProposal(proposal);
    return {
      name: "security_scan",
      passed: safety.safe,
      mocked: false,
      summary: safety.safe ? "Patch paths are constrained to the controlled workspace." : "Unsafe patch path detected.",
      details: safety.safe
        ? ["All proposed paths are relative and traversal-free."]
        : safety.rejectedPaths.map((candidate) => `Rejected path: ${candidate}`)
    };
  }

  private secretScan(proposal: PatchProposal): VerificationCheck {
    const matches = proposal.changes.flatMap((change) => {
      const content = change.content ?? "";
      return SECRET_PATTERNS.some((pattern) => pattern.test(content)) ? [change.path] : [];
    });

    return {
      name: "secret_scan",
      passed: matches.length === 0,
      mocked: false,
      summary: matches.length === 0 ? "No obvious secrets found in proposed content." : "Potential secret found.",
      details: matches.length === 0
        ? ["Scanned proposed patch content with conservative local patterns."]
        : matches.map((path) => `Potential secret-like content in ${path}.`)
    };
  }
}
