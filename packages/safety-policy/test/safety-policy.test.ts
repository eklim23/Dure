import assert from "node:assert/strict";
import test from "node:test";
import type {
  AssistantRequestContext,
  BugBountyEvidenceInput,
  BugBountyScopeRecord,
  BugBountyTargetMapRecord,
  TaskMode,
  TaskModeProposal
} from "@dure/core";
import { SafetyPolicyEngine, evaluateBugBountyRunGate, policyForMode, redactSensitiveText } from "../src/index";

test("policy registry exposes mode capability allowlists", () => {
  const policy = policyForMode("bug_bounty");

  assert.ok(policy.allowedCapabilities.includes("confirm_bug_bounty_scope"));
  assert.ok(policy.allowedCapabilities.includes("record_passive_target_map"));
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
      "record_passive_target_map",
      "map_targets_placeholder",
      "collect_evidence_placeholder",
      "draft_finding_report"
    ]),
    proposal: bugBountyProposal("caution", "sufficient")
  });

  assert.equal(decision.allowed, true);
  assert.equal(decision.policyEvaluation?.externalToolsBlocked, true);
  assert.equal(decision.blockedCapabilities.includes("record_passive_target_map"), false);
  assert.ok(decision.blockedCapabilities.includes("map_targets_placeholder"));
  assert.ok(decision.blockedCapabilities.includes("collect_evidence_placeholder"));
  assert.ok(decision.policyEvaluation?.violations.some((violation) => violation.code === "external_tool_blocked"));
});

test("bug bounty run gate blocks unsafe target maps while allowing blocked audit notes", () => {
  const scope = scopeRecordFixture();
  const unsafeMap = targetMapRecordFixture({
    assessment: {
      ...targetMapRecordFixture().assessment,
      safetyLevel: "blocked",
      outOfScopeReferences: ["admin.example.com"]
    }
  });
  const evidence = evidenceFixture({ status: "testing", asset: "api.example.com", endpoint: "/v1/orders/123" });
  const blockedEvidence = evidenceFixture({ status: "blocked", asset: "admin.example.com", endpoint: "/admin" });

  const evidenceGate = evaluateBugBountyRunGate({
    action: "record_evidence",
    scope,
    targetMap: unsafeMap,
    evidence
  });
  const blockedAuditGate = evaluateBugBountyRunGate({
    action: "record_evidence",
    scope,
    targetMap: unsafeMap,
    evidence: blockedEvidence
  });
  const reportGate = evaluateBugBountyRunGate({
    action: "draft_report",
    scope,
    targetMap: unsafeMap,
    evidence
  });

  assert.equal(evidenceGate.allowed, false);
  assert.ok(evidenceGate.checks.some((check) => check.id === "target-map-safety" && check.status === "blocked"));
  assert.equal(blockedAuditGate.allowed, true);
  assert.ok(blockedAuditGate.warningReasons.some((reason) => reason.includes("blocked evidence notes")));
  assert.equal(reportGate.allowed, false);
  assert.ok(reportGate.blockedReasons.some((reason) => reason.includes("Target map safety gate")));
});

test("bug bounty run gate warns when evidence is not covered by the passive target map", () => {
  const gate = evaluateBugBountyRunGate({
    action: "record_evidence",
    scope: scopeRecordFixture(),
    targetMap: targetMapRecordFixture(),
    evidence: evidenceFixture({ endpoint: "/v1/profile" })
  });

  assert.equal(gate.allowed, true);
  assert.ok(gate.checks.some((check) => check.id === "evidence-target-map-coverage" && check.status === "warning"));
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

function scopeRecordFixture(): BugBountyScopeRecord {
  return {
    target: "api.example.com",
    inScopeAssets: ["api.example.com", "/v1/*"],
    outOfScopeAssets: ["admin.example.com"],
    allowedTechniques: ["read-only authorization checks"],
    forbiddenTechniques: ["DoS", "brute force"],
    rateLimits: ["10 requests per minute"],
    testAccountRoles: ["user"],
    dataHandlingRules: ["redact tokens and personal data"],
    authorizationNote: "Program scope supplied by user.",
    runId: "run-20260627-000000Z-abcdef",
    recordedBy: "user",
    createdAt: "2026-06-27T00:00:01.000Z",
    intakeAssessment: {
      status: "sufficient",
      safetyLevel: "safe",
      passiveOnly: true,
      authorizationPresent: true,
      programRulesPresent: false,
      missingFields: [],
      conflictWarnings: [],
      blockedReasons: [],
      redactedFields: [],
      checks: [],
      boundaries: [
        {
          source: "target",
          kind: "host",
          value: "api.example.com",
          normalizedValue: "api.example.com"
        },
        {
          source: "in_scope",
          kind: "host",
          value: "api.example.com",
          normalizedValue: "api.example.com"
        },
        {
          source: "in_scope",
          kind: "wildcard",
          value: "/v1/*",
          normalizedValue: "/v1/*"
        },
        {
          source: "out_of_scope",
          kind: "host",
          value: "admin.example.com",
          normalizedValue: "admin.example.com"
        }
      ],
      nextAllowedActions: ["Build a passive target map."],
      blockedUntilClarified: false
    },
    moochackerAssessment: {
      agent: "MoochackerAgent",
      mode: "bug_bounty",
      scopeStatus: "sufficient",
      safetyLevel: "safe",
      allowedActions: ["Passive planning."],
      blockedActions: ["No live testing."],
      clarifyingQuestions: [],
      evidenceGuidance: ["Use minimal-impact evidence."],
      redactionRequirements: ["Redact tokens."],
      reportingNotes: ["Never inflate severity."]
    }
  };
}

function targetMapRecordFixture(overrides: Partial<BugBountyTargetMapRecord> = {}): BugBountyTargetMapRecord {
  const base: BugBountyTargetMapRecord = {
    id: "target-map-20260627-000002Z-abcdef",
    runId: "run-20260627-000000Z-abcdef",
    recordedBy: "user",
    createdAt: "2026-06-27T00:00:02.000Z",
    scopeTarget: "api.example.com",
    hosts: ["api.example.com"],
    applications: ["Public API"],
    apiBases: ["https://api.example.com/v1"],
    authStates: ["authenticated"],
    roleAccess: [
      {
        role: "user",
        authState: "authenticated",
        canAccess: ["GET /v1/orders/{id}"],
        cannotAccess: ["GET /admin"]
      }
    ],
    endpoints: [
      {
        id: "endpoint-001",
        method: "GET",
        host: "api.example.com",
        apiBase: "https://api.example.com/v1",
        path: "/v1/orders/{id}",
        parameters: ["id"],
        authState: "authenticated",
        roles: ["user"],
        stateChanging: false,
        fileFlow: "none",
        redirects: [],
        thirdPartyIntegrations: []
      }
    ],
    fileFlows: ["none observed"],
    redirects: [],
    thirdPartyIntegrations: [],
    sourceArtifacts: ["user supplied API notes"],
    assessment: {
      passiveOnly: true,
      noRequestsMade: true,
      scopeStatus: "sufficient",
      safetyLevel: "safe",
      missingFields: [],
      outOfScopeReferences: [],
      redactedFields: [],
      checks: [],
      endpointCount: 1,
      stateChangingEndpoints: 0,
      fileFlowEndpoints: 0,
      thirdPartyIntegrationCount: 0,
      nextRecommendedActions: ["Record scoped evidence."]
    }
  };

  return {
    ...base,
    ...overrides,
    assessment: {
      ...base.assessment,
      ...overrides.assessment
    }
  };
}

function evidenceFixture(overrides: Partial<BugBountyEvidenceInput> = {}): BugBountyEvidenceInput {
  return {
    status: "testing",
    asset: "api.example.com",
    endpoint: "/v1/orders/123",
    method: "GET",
    authState: "authenticated",
    userRole: "user",
    hypothesis: "Possible object-level authorization issue.",
    impact: "Potential cross-account order detail exposure.",
    confidence: "medium",
    scopeNote: "api.example.com and /v1/* are in scope.",
    nextAction: "Confirm safely with owned test accounts.",
    ...overrides
  };
}
