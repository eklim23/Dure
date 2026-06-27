import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import type { AssistantRequestContext, SafetyDecision, TaskModeProposal, VerificationResult } from "@dure/core";
import { createRunId, DecisionLogRecorder, RunStore } from "../src/index";

test("decision log records typed entries in order", () => {
  const recorder = new DecisionLogRecorder();
  recorder.append("inferred_goal", "Goal inferred.", { goal: "Build a test project." });
  recorder.append("verification_result", "Verification passed.", { accepted: true });

  const log = recorder.toDecisionLog();
  assert.equal(log.entries.length, 2);
  assert.equal(log.entries[0].type, "inferred_goal");
  assert.equal(log.entries[1].data.accepted, true);
});

test("createRunId uses the expected timestamp and entropy format", () => {
  const runId = createRunId(new Date("2026-06-27T00:00:00.000Z"));

  assert.match(runId, /^run-20260627-000000Z-[0-9a-f]{6}$/);
});

test("run store persists parseable run artifacts and JSONL decisions", async () => {
  const tempRoot = await mkdtemp(path.join(tmpdir(), "dure-runs-"));
  const store = new RunStore(path.join(tempRoot, ".dure", "runs"));
  const log = new DecisionLogRecorder();
  log.append("original_user_input", "Input recorded.", { originalInput: "hello" });
  log.append("proposal_produced", "Proposal recorded.", { proposalKind: "assistant_response" });

  const record = store.persistRun({
    context: contextFixture(),
    selectedAgentTeam: ["AssistantAgent"],
    proposal: proposalFixture(),
    safetyDecision: safetyFixture(),
    decisionLog: log.toDecisionLog(),
    nextRecommendedAction: "Review the structured proposal.",
    now: new Date("2026-06-27T00:00:01.000Z")
  });

  assert.equal(record.status, "proposed");
  assert.equal(record.selectedMode, "assistant");
  assert.ok(record.artifactPaths.runDir.startsWith(path.join(tempRoot, ".dure", "runs")));
  assert.ok(existsSync(record.artifactPaths.request));
  assert.ok(existsSync(record.artifactPaths.context));
  assert.ok(existsSync(record.artifactPaths.proposal));
  assert.ok(existsSync(record.artifactPaths.safety));
  assert.ok(existsSync(record.artifactPaths.metadata));

  const request = JSON.parse(await readFile(record.artifactPaths.request, "utf8")) as { originalInput: string };
  const proposal = JSON.parse(await readFile(record.artifactPaths.proposal, "utf8")) as { kind: string };
  const metadata = JSON.parse(await readFile(record.artifactPaths.metadata, "utf8")) as { id: string };
  const decisionLines = (await readFile(record.artifactPaths.decisionLog, "utf8")).trim().split("\n");

  assert.equal(request.originalInput, "hello");
  assert.equal(proposal.kind, "assistant_response");
  assert.equal(metadata.id, record.id);
  assert.equal(decisionLines.length, 2);
  assert.deepEqual(
    decisionLines.map((line) => JSON.parse(line) as { type: string }).map((entry) => entry.type),
    ["original_user_input", "proposal_produced"]
  );
});

test("run store loads a persisted development patch preview", async () => {
  const tempRoot = await mkdtemp(path.join(tmpdir(), "dure-preview-"));
  const store = new RunStore(path.join(tempRoot, ".dure", "runs"));
  const log = new DecisionLogRecorder();
  log.append("original_user_input", "Input recorded.", { originalInput: "Create a small app." });
  log.append("proposal_produced", "Patch proposal recorded.", { proposalKind: "patch" });

  const record = store.persistRun({
    context: developmentContextFixture(),
    selectedAgentTeam: ["IntentAgent", "ProductAgent", "BuilderAgent", "ReviewerAgent"],
    proposal: patchProposalFixture(),
    safetyDecision: safetyFixture(),
    verificationResult: verificationFixture(),
    decisionLog: log.toDecisionLog(),
    nextRecommendedAction: "Preview the patch before approval.",
    now: new Date("2026-06-27T00:00:02.000Z")
  });

  const preview = store.loadPreview(record.id);

  assert.equal(preview.metadata.id, record.id);
  assert.equal(preview.metadata.selectedMode, "development");
  assert.equal(preview.metadata.proposalKind, "patch");
  assert.equal(preview.metadata.nextRecommendedAction, "Preview the patch before approval.");
  assert.equal(preview.request.originalInput, "Create a small app.");
  assert.equal(preview.proposal.kind, "patch");
  assert.equal(preview.proposal.changes[0].path, "package.json");
  assert.equal(preview.verificationResult?.accepted, true);
  assert.equal(preview.decisionLog.entries.length, 2);
  assert.ok(preview.artifactPaths.runDir.endsWith(record.id));
});

test("run store rejects unsafe and missing run ids", async () => {
  const tempRoot = await mkdtemp(path.join(tmpdir(), "dure-preview-missing-"));
  const store = new RunStore(path.join(tempRoot, ".dure", "runs"));

  assert.throws(() => store.loadPreview("../outside"), /Invalid run id/);
  assert.throws(() => store.loadPreview("run-20260627-000000Z-ffffff"), /Run not found/);
});

test("run store reports malformed artifact names", async () => {
  const tempRoot = await mkdtemp(path.join(tmpdir(), "dure-preview-bad-"));
  const runId = "run-20260627-000000Z-abcdef";
  const runDir = path.join(tempRoot, ".dure", "runs", runId);
  await mkdir(runDir, { recursive: true });

  await writeFile(path.join(runDir, "metadata.json"), `${JSON.stringify(metadataFixture(runId))}\n`, "utf8");
  await writeFile(path.join(runDir, "request.json"), `${JSON.stringify({ originalInput: "hello", receivedAt: "2026-06-27T00:00:00.000Z" })}\n`, "utf8");
  await writeFile(path.join(runDir, "context.json"), `${JSON.stringify(contextFixture())}\n`, "utf8");
  await writeFile(path.join(runDir, "proposal.json"), "{not-json", "utf8");
  await writeFile(path.join(runDir, "safety.json"), `${JSON.stringify(safetyFixture())}\n`, "utf8");
  await writeFile(path.join(runDir, "decision-log.jsonl"), "", "utf8");

  const store = new RunStore(path.join(tempRoot, ".dure", "runs"));

  assert.throws(() => store.loadPreview(runId), /Malformed run artifact: proposal\.json/);
});

function contextFixture(): AssistantRequestContext {
  return {
    originalInput: "hello",
    inferredIntent: "Answer or structure a general assistant request safely.",
    selectedMode: "assistant",
    confidenceScore: 0.62,
    assumptions: ["No external tools are required."],
    requiredCapabilities: ["answer_general_request"],
    safetyRequirements: ["Return structured help without external side effects."],
    requiresUserApproval: false,
    requiresExternalTools: false,
    rejectedModes: ["development", "bug_bounty"],
    createdAt: "2026-06-27T00:00:00.000Z"
  };
}

function proposalFixture(): TaskModeProposal {
  return {
    id: "proposal-test",
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

function developmentContextFixture(): AssistantRequestContext {
  return {
    ...contextFixture(),
    originalInput: "Create a small app.",
    inferredIntent: "Plan and propose the smallest safe development step.",
    selectedMode: "development",
    confidenceScore: 0.95,
    requiredCapabilities: ["read_project_files", "propose_file_changes", "run_tests_placeholder"],
    safetyRequirements: ["Patch proposals require review before file changes."],
    requiresUserApproval: true,
    rejectedModes: ["assistant", "bug_bounty"]
  };
}

function patchProposalFixture(): TaskModeProposal {
  return {
    id: "patch-test",
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

function verificationFixture(): VerificationResult {
  return {
    patchId: "patch-test",
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

function metadataFixture(runId: string) {
  return {
    id: runId,
    status: "proposed",
    createdAt: "2026-06-27T00:00:00.000Z",
    updatedAt: "2026-06-27T00:00:00.000Z",
    input: "hello",
    selectedMode: "assistant",
    confidenceScore: 0.62,
    proposalKind: "assistant_response",
    proposalId: "proposal-test",
    requiresApproval: false,
    artifactPaths: {
      runDir: "ignored",
      request: "ignored",
      context: "ignored",
      proposal: "ignored",
      safety: "ignored",
      decisionLog: "ignored",
      metadata: "ignored"
    },
    selectedAgentTeam: ["AssistantAgent"],
    nextRecommendedAction: "Review the structured proposal."
  };
}
