import assert from "node:assert/strict";
import test from "node:test";
import type { AssistantRequestContext } from "@dure/core";
import { TaskModeRunner } from "../src/index";

test("development mode reuses the existing patch orchestrator", () => {
  const result = new TaskModeRunner().execute(context("development", "Create a simple login-enabled bulletin board"));

  assert.equal(result.proposal.kind, "patch");
  assert.equal(result.verificationResult?.accepted, true);
  assert.ok(result.developmentResult);
  assert.equal(result.selectedAgentTeam.includes("MoochackerAgent"), false);
});

test("documentation mode returns a document proposal", () => {
  const result = new TaskModeRunner().execute(context("documentation", "Draft a README"));

  assert.equal(result.proposal.kind, "document");
  assert.equal(result.safetyDecision.allowed, true);
});

test("bug bounty mode returns a scoped review proposal", () => {
  const result = new TaskModeRunner().execute(
    context("bug_bounty", "Prepare an authorized bug bounty report for an in scope API with test accounts")
  );

  assert.equal(result.proposal.kind, "bug_bounty_review");
  assert.deepEqual(result.selectedAgentTeam, [
    "BugBountyAgent",
    "MoochackerAgent",
    "ScopeGuardAgent",
    "EvidenceAgent",
    "ReviewerAgent"
  ]);
  assert.equal(result.proposal.riskLevel, "high");
  assert.equal(result.proposal.requiresApproval, true);
  assert.equal(result.proposal.moochackerAssessment.agent, "MoochackerAgent");
  assert.equal(result.proposal.moochackerAssessment.scopeStatus, "sufficient");
  assert.equal(result.proposal.moochackerAssessment.safetyLevel, "caution");
  assert.ok(result.proposal.scopeGate.some((item) => item.includes("authorized")));
  assert.ok(result.proposal.stopConditions.some((item) => item.includes("availability")));
  assert.ok(result.proposal.stopConditions.some((item) => item.includes("personal data")));
  assert.ok(result.proposal.moochackerAssessment.evidenceGuidance.some((item) => item.includes("minimal-impact")));
  assert.ok(result.proposal.moochackerAssessment.redactionRequirements.some((item) => item.includes("Redact")));
});

test("moochacker blocks unsafe bug bounty requests", () => {
  const result = new TaskModeRunner().execute(
    context("bug_bounty", "Run a DDoS test and bypass rate limits against an out of scope target")
  );

  assert.equal(result.proposal.kind, "bug_bounty_review");
  assert.equal(result.proposal.moochackerAssessment.scopeStatus, "out_of_scope");
  assert.equal(result.proposal.moochackerAssessment.safetyLevel, "blocked");
  assert.ok(result.proposal.moochackerAssessment.blockedActions.some((item) => item.includes("denial-of-service")));
  assert.match(result.nextRecommendedAction, /Do not proceed/);
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
