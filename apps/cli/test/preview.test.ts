import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
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

test("approve command records approval and updates preview status", async () => {
  const tempRoot = await mkdtemp(path.join(tmpdir(), "dure-cli-approve-"));
  const record = persistRun(tempRoot, patchProposalFixture(), "development");

  const approval = runCli(tempRoot, ["approve", record.id, "--reason", "Reviewed preview output"]);
  const preview = runCli(tempRoot, ["preview", record.id]);

  assert.equal(approval.status, 0, approval.stderr);
  assert.match(approval.stdout, /Dure Approval/);
  assert.match(approval.stdout, /new status: approved/);
  assert.match(approval.stdout, /reason: Reviewed preview output/);
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
        rationale: "Declare a minimal runnable package."
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
