import assert from "node:assert/strict";
import test from "node:test";
import type { AssistantRequestContext } from "@dure/core";
import { TaskModeRunner } from "../src/index";

test("development mode reuses the existing patch orchestrator", () => {
  const result = new TaskModeRunner().execute(context("development", "Create a simple login-enabled bulletin board"));

  assert.equal(result.proposal.kind, "patch");
  assert.equal(result.verificationResult?.accepted, true);
  assert.ok(result.developmentResult);
});

test("documentation mode returns a document proposal", () => {
  const result = new TaskModeRunner().execute(context("documentation", "Draft a README"));

  assert.equal(result.proposal.kind, "document");
  assert.equal(result.safetyDecision.allowed, true);
});

test("bug bounty mode returns a scoped review proposal", () => {
  const result = new TaskModeRunner().execute(context("bug_bounty", "Prepare a bug bounty report"));

  assert.equal(result.proposal.kind, "bug_bounty_review");
  assert.deepEqual(result.selectedAgentTeam, ["BugBountyAgent", "ScopeGuardAgent", "EvidenceAgent", "ReviewerAgent"]);
});

function context(selectedMode: AssistantRequestContext["selectedMode"], originalInput: string): AssistantRequestContext {
  return {
    originalInput,
    inferredIntent: "Test intent.",
    selectedMode,
    confidenceScore: 0.8,
    assumptions: ["Test assumption."],
    requiredCapabilities: ["answer_general_request"],
    safetyRequirements: ["No external side effects."],
    requiresUserApproval: selectedMode !== "assistant",
    requiresExternalTools: false,
    rejectedModes: [],
    createdAt: "2026-06-27T00:00:00.000Z"
  };
}
