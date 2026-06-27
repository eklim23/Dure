import assert from "node:assert/strict";
import test from "node:test";
import type { AssistantRequestContext, TaskMode, TaskModeProposal } from "@dure/core";
import { SafetyPolicyEngine, policyForMode, redactSensitiveText } from "../src/index";

test("policy registry exposes mode capability allowlists", () => {
  const policy = policyForMode("bug_bounty");

  assert.ok(policy.allowedCapabilities.includes("confirm_bug_bounty_scope"));
  assert.ok(policy.allowedCapabilities.includes("draft_finding_report"));
  assert.equal(policy.externalToolPolicy, "block_by_default");
});

test("policy blocks capabilities outside the selected mode", () => {
  const decision = new SafetyPolicyEngine().evaluate({
    context: context("assistant", ["propose_file_changes"]),
    proposal: assistantProposal()
  });

  assert.equal(decision.allowed, false);
  assert.ok(decision.blockedCapabilities.includes("propose_file_changes"));
  assert.ok(decision.policyEvaluation?.violations.some((violation) => violation.code === "capability_not_allowed"));
});

test("policy blocks external bug bounty execution by default while allowing passive planning", () => {
  const decision = new SafetyPolicyEngine().evaluate({
    context: context("bug_bounty", [
      "confirm_bug_bounty_scope",
      "review_program_rules",
      "map_targets_placeholder",
      "collect_evidence_placeholder",
      "draft_finding_report"
    ]),
    proposal: bugBountyProposal("caution", "sufficient")
  });

  assert.equal(decision.allowed, true);
  assert.equal(decision.policyEvaluation?.externalToolsBlocked, true);
  assert.ok(decision.blockedCapabilities.includes("map_targets_placeholder"));
  assert.ok(decision.blockedCapabilities.includes("collect_evidence_placeholder"));
  assert.ok(decision.policyEvaluation?.violations.some((violation) => violation.code === "external_tool_blocked"));
});

test("policy blocks unsafe active bug bounty stop conditions", () => {
  const decision = new SafetyPolicyEngine().evaluate({
    context: context("bug_bounty", ["confirm_bug_bounty_scope"], "Run a DDoS test and bypass rate limits"),
    proposal: bugBountyProposal("blocked", "out_of_scope")
  });

  assert.equal(decision.allowed, false);
  assert.ok(decision.policyEvaluation?.violations.some((violation) => violation.code === "active_testing_stop_condition"));
});

test("policy flags secret-like input and redacts with shared rules", () => {
  const source = "Authorization: Bearer abcdefgh12345678\nContact: test@example.com";
  const redacted = redactSensitiveText(source);
  const decision = new SafetyPolicyEngine().evaluate({
    context: context("assistant", ["answer_general_request"], source),
    proposal: assistantProposal()
  });

  assert.equal(redacted.redacted, true);
  assert.match(redacted.value, /\[redacted-secret\]/);
  assert.match(redacted.value, /\[redacted-email\]/);
  assert.ok(decision.policyEvaluation?.violations.some((violation) => violation.code === "secret_redaction_required"));
});

function context(
  selectedMode: TaskMode,
  requiredCapabilities: AssistantRequestContext["requiredCapabilities"],
  originalInput = "Prepare a safe plan"
): AssistantRequestContext {
  return {
    originalInput,
    inferredIntent: "Test intent.",
    selectedMode,
    confidenceScore: 0.8,
    assumptions: ["Test assumption."],
    requiredCapabilities,
    safetyRequirements: ["No external side effects."],
    requiresUserApproval: selectedMode !== "assistant",
    requiresExternalTools: selectedMode === "bug_bounty",
    rejectedModes: [],
    createdAt: "2026-06-27T00:00:00.000Z"
  };
}

function assistantProposal(): TaskModeProposal {
  return {
    id: "proposal-assistant",
    kind: "assistant_response",
    summary: "Structured assistant response prepared without external tools.",
    riskLevel: "low",
    requiresApproval: false,
    assumptions: ["Test assumption."],
    nextActions: ["Review the proposal."],
    response: "Safe response.",
    suggestedQuestions: ["What should happen next?"]
  };
}

function bugBountyProposal(
  safetyLevel: "safe" | "caution" | "blocked",
  scopeStatus: "sufficient" | "needs_clarification" | "out_of_scope"
): TaskModeProposal {
  return {
    id: "proposal-bug-bounty",
    kind: "bug_bounty_review",
    summary: "Bug bounty review proposal with scope and evidence gates.",
    riskLevel: "high",
    requiresApproval: true,
    assumptions: ["Test assumption."],
    nextActions: ["Review MoochackerAgent's safety guidance."],
    moochackerAssessment: {
      agent: "MoochackerAgent",
      mode: "bug_bounty",
      scopeStatus,
      safetyLevel,
      allowedActions: ["Passive clarification only."],
      blockedActions: ["No live testing."],
      clarifyingQuestions: [],
      evidenceGuidance: ["Use minimal-impact evidence."],
      redactionRequirements: ["Redact tokens."],
      reportingNotes: ["Never inflate severity."]
    },
    scopeGate: ["Confirm scope."],
    targetMapPlaceholders: ["hosts"],
    hypotheses: ["Authorization boundary issue."],
    evidenceLedgerFields: ["lead id"],
    reportSections: ["title"],
    stopConditions: ["Scope is unclear."]
  };
}
