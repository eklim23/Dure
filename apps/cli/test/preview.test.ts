import assert from "node:assert/strict";
import { existsSync, readdirSync } from "node:fs";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import type {
  AssistantRequestContext,
  SafetyDecision,
  TaskModeProposal,
  VerificationResult
} from "@dure/core";
import { DecisionLogRecorder, RunStore } from "@dure/memory";

test("preview command prints a persisted development patch", async () => {
  const tempRoot = await mkdtemp(path.join(tmpdir(), "dure-cli-preview-"));
  const record = persistRun(tempRoot, patchProposalFixture(), "development");

  const result = runCli(tempRoot, ["preview", record.id]);

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Dure Preview/);
  assert.match(result.stdout, new RegExp(`id: ${record.id}`));
  assert.match(result.stdout, /mode: development/);
  assert.match(result.stdout, /run status: proposed/);
  assert.match(result.stdout, /proposal: patch-cli-test/);
  assert.match(result.stdout, /create: package\.json/);
  assert.match(result.stdout, /Patch Risk:/);
  assert.match(result.stdout, /File-Level Change Plan:/);
  assert.match(result.stdout, /Unified Diff:/);
  assert.match(result.stdout, /diff --git a\/package\.json b\/package\.json/);
  assert.match(result.stdout, /accepted: yes/);
});

test("preview command reports missing runs", async () => {
  const tempRoot = await mkdtemp(path.join(tmpdir(), "dure-cli-preview-missing-"));

  const result = runCli(tempRoot, ["preview", "run-20260627-000000Z-ffffff"]);

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Run not found/);
});

test("preview command rejects non-patch proposals for now", async () => {
  const tempRoot = await mkdtemp(path.join(tmpdir(), "dure-cli-preview-nonpatch-"));
  const record = persistRun(tempRoot, assistantProposalFixture(), "assistant");

  const result = runCli(tempRoot, ["preview", record.id]);

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /not a development patch proposal/);
});

test("runs, show, and export commands inspect persisted runs", async () => {
  const tempRoot = await mkdtemp(path.join(tmpdir(), "dure-cli-runs-show-export-"));
  const record = persistRun(tempRoot, bugBountyProposalFixture(), "bug_bounty");

  const runs = runCli(tempRoot, ["runs", "--limit", "5"]);
  const show = runCli(tempRoot, ["show", record.id]);
  const exported = runCli(tempRoot, ["export", record.id]);
  const exportPath = path.join(tempRoot, ".dure", "runs", record.id, "export.md");

  assert.equal(runs.status, 0, runs.stderr);
  assert.match(runs.stdout, /Dure Runs/);
  assert.match(runs.stdout, new RegExp(record.id));
  assert.match(runs.stdout, /bug_bounty/);
  assert.equal(show.status, 0, show.stderr);
  assert.match(show.stdout, /Dure Run/);
  assert.match(show.stdout, /Proposal:/);
  assert.match(show.stdout, /Artifacts:/);
  assert.equal(exported.status, 0, exported.stderr);
  assert.match(exported.stdout, /Dure Export/);
  assert.match(exported.stdout, /export\.md/);
  assert.ok(existsSync(exportPath));
  assert.match(await readFile(exportPath, "utf8"), /## Decision Log/);
});

test("console-data command prints and writes a read-only UI snapshot", async () => {
  const tempRoot = await mkdtemp(path.join(tmpdir(), "dure-cli-console-data-"));
  const record = persistRun(tempRoot, patchProposalFixture(), "development");
  const outputPath = path.join(tempRoot, "console-data.json");

  const printed = runCli(tempRoot, ["console-data", record.id]);
  const written = runCli(tempRoot, ["console-data", record.id, "--output", outputPath]);
  const printedSnapshot = JSON.parse(printed.stdout) as {
    source: { kind: string; readOnly: boolean; redacted: boolean };
    run: { id: string; selectedMode: string; proposalKind: string };
    decisions: unknown[];
  };
  const writtenSnapshot = JSON.parse(await readFile(outputPath, "utf8")) as {
    source: { kind: string; readOnly: boolean; redacted: boolean };
    run: { id: string };
  };

  assert.equal(printed.status, 0, printed.stderr);
  assert.equal(printedSnapshot.source.kind, "dure-console-data");
  assert.equal(printedSnapshot.source.readOnly, true);
  assert.equal(printedSnapshot.source.redacted, true);
  assert.equal(printedSnapshot.run.id, record.id);
  assert.equal(printedSnapshot.run.selectedMode, "development");
  assert.equal(printedSnapshot.run.proposalKind, "patch");
  assert.equal(printedSnapshot.decisions.length, 2);
  assert.equal(written.status, 0, written.stderr);
  assert.match(written.stdout, /Dure Console Data/);
  assert.equal(writtenSnapshot.run.id, record.id);
});

test("approve command records approval and updates preview status", async () => {
  const tempRoot = await mkdtemp(path.join(tmpdir(), "dure-cli-approve-"));
  const record = persistRun(tempRoot, patchProposalFixture(), "development");

  const missingConfirmation = runCli(tempRoot, ["approve", record.id, "--reason", "Reviewed preview output"]);
  const approval = runCli(tempRoot, [
    "approve",
    record.id,
    "--confirm-risk",
    "medium",
    "--reason",
    "Reviewed preview output"
  ]);
  const preview = runCli(tempRoot, ["preview", record.id]);

  assert.notEqual(missingConfirmation.status, 0);
  assert.match(missingConfirmation.stderr, /--confirm-risk medium/);
  assert.equal(approval.status, 0, approval.stderr);
  assert.match(approval.stdout, /Dure Approval/);
  assert.match(approval.stdout, /new status: approved/);
  assert.match(approval.stdout, /reason: Reviewed preview output/);
  assert.match(approval.stdout, /Approval Policy/);
  assert.match(approval.stdout, /confirmed risk: medium/);
  assert.match(approval.stdout, /expires at:/);
  assert.equal(preview.status, 0, preview.stderr);
  assert.match(preview.stdout, /run status: approved/);
});

test("approve command rejects non-patch proposals", async () => {
  const tempRoot = await mkdtemp(path.join(tmpdir(), "dure-cli-approve-nonpatch-"));
  const record = persistRun(tempRoot, assistantProposalFixture(), "assistant");

  const result = runCli(tempRoot, ["approve", record.id]);

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /not a patch proposal/);
});

test("apply command writes an approved patch to a controlled workspace", async () => {
  const tempRoot = await mkdtemp(path.join(tmpdir(), "dure-cli-apply-"));
  const workspaceRoot = path.join(tempRoot, "workspace");
  const record = persistRun(tempRoot, patchProposalFixture(), "development");

  const approval = runCli(tempRoot, [
    "approve",
    record.id,
    "--confirm-risk",
    "medium",
    "--reason",
    "Reviewed preview output"
  ]);
  const applied = runCli(tempRoot, ["apply", record.id, "--workspace", workspaceRoot]);
  const preview = runCli(tempRoot, ["preview", record.id]);
  const targetFile = path.join(workspaceRoot, "package.json");

  assert.equal(approval.status, 0, approval.stderr);
  assert.equal(applied.status, 0, applied.stderr);
  assert.match(applied.stdout, /Dure Apply/);
  assert.match(applied.stdout, /new status: applied/);
  assert.ok(existsSync(targetFile));
  assert.match(await readFile(targetFile, "utf8"), /generated-cli-mvp/);
  assert.equal(preview.status, 0, preview.stderr);
  assert.match(preview.stdout, /run status: applied/);
});

test("apply command rejects duplicate apply", async () => {
  const tempRoot = await mkdtemp(path.join(tmpdir(), "dure-cli-apply-duplicate-"));
  const workspaceRoot = path.join(tempRoot, "workspace");
  const record = persistRun(tempRoot, patchProposalFixture(), "development");

  assert.equal(runCli(tempRoot, ["approve", record.id, "--confirm-risk", "medium"]).status, 0);
  assert.equal(runCli(tempRoot, ["apply", record.id, "--workspace", workspaceRoot]).status, 0);
  const duplicate = runCli(tempRoot, ["apply", record.id, "--workspace", workspaceRoot]);

  assert.notEqual(duplicate.status, 0);
  assert.match(duplicate.stderr, /current status is applied/);
});

test("verify command runs applied workspace scripts and updates preview status", async () => {
  const tempRoot = await mkdtemp(path.join(tmpdir(), "dure-cli-verify-"));
  const workspaceRoot = path.join(tempRoot, "workspace");
  const record = persistRun(tempRoot, patchProposalFixture(), "development");

  assert.equal(runCli(tempRoot, ["approve", record.id, "--confirm-risk", "medium"]).status, 0);
  assert.equal(runCli(tempRoot, ["apply", record.id, "--workspace", workspaceRoot]).status, 0);
  const verification = runCli(tempRoot, ["verify", record.id, "--workspace", workspaceRoot, "--script", "test"]);
  const preview = runCli(tempRoot, ["preview", record.id]);

  assert.equal(verification.status, 0, verification.stderr);
  assert.match(verification.stdout, /Dure Verification/);
  assert.match(verification.stdout, /new status: verified/);
  assert.match(verification.stdout, /test: passed/);
  assert.equal(preview.status, 0, preview.stderr);
  assert.match(preview.stdout, /run status: verified/);
  assert.match(preview.stdout, /Workspace Verification/);
});

test("verify command returns non-zero when an applied script fails", async () => {
  const tempRoot = await mkdtemp(path.join(tmpdir(), "dure-cli-verify-fail-"));
  const workspaceRoot = path.join(tempRoot, "workspace");
  const record = persistRun(tempRoot, failingPatchProposalFixture(), "development");

  assert.equal(runCli(tempRoot, ["approve", record.id, "--confirm-risk", "medium"]).status, 0);
  assert.equal(runCli(tempRoot, ["apply", record.id, "--workspace", workspaceRoot]).status, 0);
  const verification = runCli(tempRoot, ["verify", record.id, "--workspace", workspaceRoot, "--script", "test"]);
  const preview = runCli(tempRoot, ["preview", record.id]);

  assert.notEqual(verification.status, 0);
  assert.match(verification.stdout, /new status: failed/);
  assert.match(verification.stdout, /test: failed/);
  assert.equal(preview.status, 0, preview.stderr);
  assert.match(preview.stdout, /run status: failed/);
});

test("verify command rejects unsupported scripts", async () => {
  const tempRoot = await mkdtemp(path.join(tmpdir(), "dure-cli-verify-unsupported-"));
  const result = runCli(tempRoot, ["verify", "run-20260627-000000Z-ffffff", "--script", "build"]);

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Unsupported verification script/);
});

test("scope command records bug bounty scope intake", async () => {
  const tempRoot = await mkdtemp(path.join(tmpdir(), "dure-cli-scope-"));
  const record = persistRun(tempRoot, bugBountyProposalFixture(), "bug_bounty");

  const result = runCli(tempRoot, [
    "scope",
    record.id,
    "--target",
    "api.example.com",
    "--in-scope",
    "api.example.com,/v1/*",
    "--out-of-scope",
    "admin.example.com",
    "--allowed",
    "read-only authorization checks",
    "--forbidden",
    "DoS,brute force",
    "--rate-limit",
    "10 requests per minute",
    "--roles",
    "user,admin-test",
    "--data",
    "redact tokens and personal data",
    "--authorization-note",
    "Program scope supplied by user"
  ]);

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Dure Bug Bounty Scope/);
  assert.match(result.stdout, /target: api\.example\.com/);
  assert.match(result.stdout, /status: sufficient/);
  assert.match(result.stdout, /forbidden: DoS, brute force/);
});

test("evidence command records and lists bug bounty evidence leads", async () => {
  const tempRoot = await mkdtemp(path.join(tmpdir(), "dure-cli-evidence-"));
  const record = persistRun(tempRoot, bugBountyProposalFixture(), "bug_bounty");

  assert.equal(runCli(tempRoot, [
    "scope",
    record.id,
    "--target",
    "api.example.com",
    "--in-scope",
    "api.example.com,/v1/*",
    "--out-of-scope",
    "admin.example.com",
    "--allowed",
    "read-only authorization checks",
    "--forbidden",
    "DoS,brute force",
    "--rate-limit",
    "10 requests per minute",
    "--roles",
    "user,admin-test",
    "--data",
    "redact tokens and personal data",
    "--authorization-note",
    "Program scope supplied by user"
  ]).status, 0);

  const recorded = runCli(tempRoot, [
    "evidence",
    record.id,
    "--status",
    "testing",
    "--asset",
    "api.example.com",
    "--endpoint",
    "/v1/orders/123",
    "--method",
    "GET",
    "--role",
    "user",
    "--hypothesis",
    "A user may be able to read another user's order detail.",
    "--request",
    "GET /v1/orders/123 Authorization: Bearer supersecrettoken123",
    "--response",
    "200 OK for victim@example.com",
    "--impact",
    "Potential cross-account order detail exposure.",
    "--confidence",
    "medium",
    "--scope-note",
    "api.example.com and /v1/* are in scope.",
    "--next-action",
    "Confirm with owned test accounts."
  ]);
  const listed = runCli(tempRoot, ["evidence", record.id]);
  const ledgerPath = path.join(tempRoot, ".dure", "runs", record.id, "evidence-ledger.jsonl");

  assert.equal(recorded.status, 0, recorded.stderr);
  assert.match(recorded.stdout, /Dure Evidence/);
  assert.match(recorded.stdout, /status: testing/);
  assert.match(recorded.stdout, /confidence: medium/);
  assert.match(recorded.stdout, /redacted fields: requestSummary, responseSummary/);
  assert.equal(listed.status, 0, listed.stderr);
  assert.match(listed.stdout, /Dure Evidence Ledger/);
  assert.match(listed.stdout, /entries: 1/);
  assert.match(await readFile(ledgerPath, "utf8"), /\[redacted-secret\]/);
  assert.doesNotMatch(await readFile(ledgerPath, "utf8"), /supersecrettoken123/);
});

test("report command drafts and lists bug bounty report markdown", async () => {
  const tempRoot = await mkdtemp(path.join(tmpdir(), "dure-cli-report-"));
  const record = persistRun(tempRoot, bugBountyProposalFixture(), "bug_bounty");

  assert.equal(runCli(tempRoot, [
    "scope",
    record.id,
    "--target",
    "api.example.com",
    "--in-scope",
    "api.example.com,/v1/*",
    "--out-of-scope",
    "admin.example.com",
    "--allowed",
    "read-only authorization checks",
    "--forbidden",
    "DoS,brute force",
    "--rate-limit",
    "10 requests per minute",
    "--roles",
    "user,admin-test",
    "--data",
    "redact tokens and personal data",
    "--authorization-note",
    "Program scope supplied by user"
  ]).status, 0);
  assert.equal(runCli(tempRoot, [
    "evidence",
    record.id,
    "--status",
    "confirmed",
    "--asset",
    "api.example.com",
    "--endpoint",
    "/v1/orders/123",
    "--method",
    "GET",
    "--role",
    "user",
    "--hypothesis",
    "A user may be able to read another user's order detail.",
    "--request",
    "GET /v1/orders/123 Authorization: Bearer supersecrettoken123",
    "--response",
    "200 OK for [test-user-b]",
    "--impact",
    "Confirmed cross-account order detail exposure.",
    "--confidence",
    "high",
    "--scope-note",
    "api.example.com and /v1/* are in scope.",
    "--next-action",
    "Draft a report."
  ]).status, 0);

  const ledgerPath = path.join(tempRoot, ".dure", "runs", record.id, "evidence-ledger.jsonl");
  const lead = JSON.parse((await readFile(ledgerPath, "utf8")).trim()) as { id: string };
  const drafted = runCli(tempRoot, [
    "report",
    record.id,
    "--lead",
    lead.id,
    "--title",
    "Confirmed cross-account order detail exposure",
    "--severity",
    "medium",
    "--roles",
    "user",
    "--step",
    "Use two authorized test accounts.",
    "--step",
    "Request the order detail endpoint with the second account's object id.",
    "--remediation",
    "Enforce object ownership checks.",
    "--duplicate-risk",
    "false"
  ]);
  const listed = runCli(tempRoot, ["report", record.id]);
  const reportsDir = path.join(tempRoot, ".dure", "runs", record.id, "reports");

  assert.equal(drafted.status, 0, drafted.stderr);
  assert.match(drafted.stdout, /Dure Report Draft/);
  assert.match(drafted.stdout, /severity: medium/);
  assert.match(drafted.stdout, /Confirmed cross-account order detail exposure/);
  assert.equal(listed.status, 0, listed.stderr);
  assert.match(listed.stdout, /Dure Report Drafts/);
  assert.match(listed.stdout, /reports: 1/);
  assert.ok(existsSync(reportsDir));
  assert.match(await readFile(path.join(reportsDir, (await fileNameEndingWith(reportsDir, ".md"))), "utf8"), /## Recommended Remediation/);
});

test("evidence command rejects development runs", async () => {
  const tempRoot = await mkdtemp(path.join(tmpdir(), "dure-cli-evidence-dev-"));
  const record = persistRun(tempRoot, patchProposalFixture(), "development");

  const result = runCli(tempRoot, [
    "evidence",
    record.id,
    "--asset",
    "api.example.com",
    "--hypothesis",
    "Authorization boundary check.",
    "--impact",
    "Potential cross-account exposure.",
    "--scope-note",
    "In scope.",
    "--next-action",
    "Clarify scope."
  ]);

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /not a bug bounty proposal/);
});

test("scope command rejects development runs", async () => {
  const tempRoot = await mkdtemp(path.join(tmpdir(), "dure-cli-scope-dev-"));
  const record = persistRun(tempRoot, patchProposalFixture(), "development");

  const result = runCli(tempRoot, ["scope", record.id, "--target", "api.example.com"]);

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /not a bug bounty proposal/);
});

function runCli(cwd: string, args: readonly string[]) {
  return spawnSync(process.execPath, [path.resolve("dist", "src", "index.js"), ...args], {
    cwd,
    encoding: "utf8"
  });
}

async function fileNameEndingWith(directory: string, suffix: string): Promise<string> {
  const match = readdirSync(directory).find((fileName) => fileName.endsWith(suffix));
  assert.ok(match);
  return match;
}

function persistRun(tempRoot: string, proposal: TaskModeProposal, selectedMode: AssistantRequestContext["selectedMode"]) {
  const store = new RunStore(path.join(tempRoot, ".dure", "runs"));
  const log = new DecisionLogRecorder();
  log.append("original_user_input", "Input recorded.", { originalInput: "Create a small app." });
  log.append("proposal_produced", "Proposal recorded.", { proposalKind: proposal.kind });

  return store.persistRun({
    context: contextFixture(selectedMode),
    selectedAgentTeam:
      selectedMode === "development"
        ? ["BuilderAgent", "ReviewerAgent"]
        : selectedMode === "bug_bounty"
          ? ["BugBountyAgent", "MoochackerAgent", "ScopeGuardAgent", "EvidenceAgent", "ReviewerAgent"]
          : ["AssistantAgent"],
    proposal,
    safetyDecision: safetyFixture(),
    verificationResult: proposal.kind === "patch" ? verificationFixture() : undefined,
    decisionLog: log.toDecisionLog(),
    nextRecommendedAction: "Preview the patch before approval.",
    now: new Date("2026-06-27T00:00:03.000Z")
  });
}

function contextFixture(selectedMode: AssistantRequestContext["selectedMode"]): AssistantRequestContext {
  const isDevelopment = selectedMode === "development";
  const isBugBounty = selectedMode === "bug_bounty";
  return {
    originalInput: isBugBounty ? "Prepare an authorized bug bounty scope and evidence plan." : "Create a small app.",
    inferredIntent:
      isDevelopment
        ? "Plan and propose the smallest safe development step."
        : isBugBounty
          ? "Prepare an authorized bug bounty workflow with scope, evidence, and reporting gates."
          : "Answer or structure a general assistant request safely.",
    selectedMode,
    confidenceScore: isDevelopment || isBugBounty ? 0.95 : 0.62,
    assumptions: ["No external tools are required."],
    requiredCapabilities:
      isDevelopment
        ? ["read_project_files", "propose_file_changes", "run_tests_placeholder"]
        : isBugBounty
          ? [
              "confirm_bug_bounty_scope",
              "review_program_rules",
              "map_targets_placeholder",
              "collect_evidence_placeholder",
              "draft_finding_report"
            ]
          : ["answer_general_request"],
    safetyRequirements: ["Do not modify files without approval."],
    requiresUserApproval: isDevelopment || isBugBounty,
    requiresExternalTools: isBugBounty,
    rejectedModes: selectedMode === "development" ? ["assistant", "bug_bounty"] : ["development", "bug_bounty"],
    createdAt: "2026-06-27T00:00:00.000Z"
  };
}

function patchProposalFixture(): TaskModeProposal {
  return {
    id: "patch-cli-test",
    kind: "patch",
    summary: "Controlled proposal for a minimal executable skeleton.",
    riskLevel: "medium",
    requiresApproval: true,
    assumptions: ["No files are modified automatically."],
    nextActions: ["Preview the patch before approval."],
    author: "BuilderRuntime",
    goal: "Create a small app.",
    stage: {
      id: 1,
      name: "create executable skeleton",
      objective: "Create a runnable skeleton before expanding features.",
      exitCriteria: ["A minimal command can run."]
    },
    changes: [
      {
        path: "package.json",
        operation: "create",
        rationale: "Declare a minimal runnable package.",
        content: JSON.stringify(
          {
            name: "generated-cli-mvp",
            private: true,
            scripts: {
              test: "node -e \"console.log('test ok')\""
            }
          },
          null,
          2
        )
      }
    ],
    policy: {
      singleWriter: true,
      writer: "BuilderRuntime",
      reviewers: ["ReviewerAgent"]
    },
    createdAt: "2026-06-27T00:00:00.000Z",
    status: "accepted"
  };
}

function failingPatchProposalFixture(): TaskModeProposal {
  const base = patchProposalFixture();
  assert.equal(base.kind, "patch");
  return {
    ...base,
    id: "patch-cli-failing-test",
    changes: [
      {
        path: "package.json",
        operation: "create",
        rationale: "Declare a package with a failing test script.",
        content: JSON.stringify(
          {
            name: "generated-cli-mvp",
            private: true,
            scripts: {
              test: "node -e \"process.exit(1)\""
            }
          },
          null,
          2
        )
      }
    ]
  };
}

function assistantProposalFixture(): TaskModeProposal {
  return {
    id: "proposal-cli-assistant",
    kind: "assistant_response",
    summary: "Structured assistant response prepared without external tools.",
    riskLevel: "low",
    requiresApproval: false,
    assumptions: ["No external tools are required."],
    nextActions: ["Review the structured proposal."],
    response: "Hello.",
    suggestedQuestions: ["What outcome should be considered done?"]
  };
}

function bugBountyProposalFixture(): TaskModeProposal {
  return {
    id: "proposal-cli-bug-bounty",
    kind: "bug_bounty_review",
    summary: "Bug bounty review proposal with scope and evidence gates.",
    riskLevel: "high",
    requiresApproval: true,
    assumptions: ["No active testing is performed."],
    nextActions: ["Review MoochackerAgent's safety guidance."],
    moochackerAssessment: {
      agent: "MoochackerAgent",
      mode: "bug_bounty",
      scopeStatus: "needs_clarification",
      safetyLevel: "caution",
      allowedActions: ["Passive planning only."],
      blockedActions: ["No live requests."],
      clarifyingQuestions: ["What assets are in scope?"],
      evidenceGuidance: ["Use owned test accounts only."],
      redactionRequirements: ["Redact tokens."],
      reportingNotes: ["Separate findings from hypotheses."]
    },
    scopeGate: ["Confirm the target is in scope and explicitly authorized."],
    targetMapPlaceholders: ["hosts", "endpoints"],
    hypotheses: ["Authorization boundary issues."],
    evidenceLedgerFields: ["lead id", "impact"],
    reportSections: ["title", "impact", "remediation"],
    stopConditions: ["Scope, authorization, or program rules are unclear."]
  };
}

function safetyFixture(): SafetyDecision {
  return {
    allowed: true,
    requiresApproval: false,
    externalToolsRequired: false,
    summary: "Safe deterministic proposal produced without external side effects.",
    blockedCapabilities: [],
    details: ["No external integration was required."]
  };
}

function verificationFixture(): VerificationResult {
  return {
    patchId: "patch-cli-test",
    accepted: true,
    completedAt: "2026-06-27T00:00:00.000Z",
    checks: [
      {
        name: "security_scan",
        passed: true,
        mocked: false,
        summary: "No unsafe patch paths detected.",
        details: []
      },
      {
        name: "test",
        passed: true,
        mocked: true,
        summary: "Placeholder test gate passed.",
        details: []
      }
    ]
  };
}
