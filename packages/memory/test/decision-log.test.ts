import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import type { AssistantRequestContext, SafetyDecision, TaskModeProposal } from "@dure/core";
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
