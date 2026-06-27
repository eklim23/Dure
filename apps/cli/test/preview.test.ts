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
    selectedAgentTeam: selectedMode === "development" ? ["BuilderAgent", "ReviewerAgent"] : ["AssistantAgent"],
    proposal,
    safetyDecision: safetyFixture(),
    verificationResult: proposal.kind === "patch" ? verificationFixture() : undefined,
    decisionLog: log.toDecisionLog(),
    nextRecommendedAction: "Preview the patch before approval.",
    now: new Date("2026-06-27T00:00:03.000Z")
  });
}

function contextFixture(selectedMode: AssistantRequestContext["selectedMode"]): AssistantRequestContext {
  return {
    originalInput: "Create a small app.",
    inferredIntent:
      selectedMode === "development"
        ? "Plan and propose the smallest safe development step."
        : "Answer or structure a general assistant request safely.",
    selectedMode,
    confidenceScore: selectedMode === "development" ? 0.95 : 0.62,
    assumptions: ["No external tools are required."],
    requiredCapabilities:
      selectedMode === "development"
        ? ["read_project_files", "propose_file_changes", "run_tests_placeholder"]
        : ["answer_general_request"],
    safetyRequirements: ["Do not modify files without approval."],
    requiresUserApproval: selectedMode === "development",
    requiresExternalTools: false,
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
