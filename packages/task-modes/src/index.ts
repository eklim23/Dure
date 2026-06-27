import type {
  AssistantAgentRole,
  AssistantRequestContext,
  BugBountyReviewProposal,
  Capability,
  DocumentProposal,
  MoochackerAssessment,
  OpsPlanProposal,
  ProductivityPlanProposal,
  RiskLevel,
  SafetyDecision,
  SecurityReviewProposal,
  TaskModeExecutionResult,
  TaskModeProposal,
  AssistantResponseProposal
} from "@dure/core";
import { createStableId } from "@dure/core";
import { DureOrchestrator } from "@dure/orchestrator";

export class TaskModeRunner {
  private readonly developmentOrchestrator = new DureOrchestrator();

  execute(context: AssistantRequestContext): TaskModeExecutionResult {
    switch (context.selectedMode) {
      case "development":
        return this.runDevelopmentMode(context);
      case "bug_bounty":
        return buildStaticModeResult(
          context,
          ["BugBountyAgent", "MoochackerAgent", "ScopeGuardAgent", "EvidenceAgent", "ReviewerAgent"],
          buildBugBountyReviewProposal(context)
        );
      case "documentation":
        return buildStaticModeResult(context, ["DocumentationAgent", "ReviewerAgent"], buildDocumentProposal(context));
      case "security":
        return buildStaticModeResult(context, ["SecurityReviewAgent", "MaintainerAgent", "ReviewerAgent"], buildSecurityReviewProposal(context));
      case "operations":
        return buildStaticModeResult(context, ["OperationsAgent", "SecurityAgent", "MaintainerAgent"], buildOpsPlanProposal(context));
      case "personal_productivity":
        return buildStaticModeResult(context, ["ProductivityAgent", "AssistantAgent"], buildProductivityPlanProposal(context));
      case "assistant":
        return buildStaticModeResult(context, ["AssistantAgent"], buildAssistantResponseProposal(context));
    }
  }

  private runDevelopmentMode(context: AssistantRequestContext): TaskModeExecutionResult {
    const developmentResult = this.developmentOrchestrator.run(context.originalInput);
    const selectedAgentTeam: readonly AssistantAgentRole[] = developmentResult.goalState.requiredAgents;
    const safetyDecision: SafetyDecision = {
      allowed: developmentResult.verificationResult.accepted,
      requiresApproval: context.requiresUserApproval,
      externalToolsRequired: context.requiresExternalTools,
      summary: developmentResult.verificationResult.accepted
        ? "Development patch proposal passed the v0.1 verification gate."
        : "Development patch proposal failed the v0.1 verification gate.",
      blockedCapabilities: [],
      details: developmentResult.verificationResult.checks.map(
        (check) => `${check.name}: ${check.passed ? "pass" : "fail"} (${check.mocked ? "mocked" : "local"})`
      )
    };

    return {
      mode: "development",
      selectedAgentTeam,
      proposal: developmentResult.patchProposal,
      safetyDecision,
      verificationResult: developmentResult.verificationResult,
      developmentResult,
      nextRecommendedAction: developmentResult.nextRecommendedAction
    };
  }
}

function buildStaticModeResult(
  context: AssistantRequestContext,
  selectedAgentTeam: readonly AssistantAgentRole[],
  proposal: TaskModeProposal
): TaskModeExecutionResult {
  return {
    mode: context.selectedMode,
    selectedAgentTeam,
    proposal,
    safetyDecision: buildSafetyDecision(context),
    nextRecommendedAction: proposal.nextActions[0] ?? "Review the proposal before taking action."
  };
}

function buildSafetyDecision(context: AssistantRequestContext): SafetyDecision {
  const blockedCapabilities = context.requiresExternalTools
    ? context.requiredCapabilities.filter((capability) => capability.endsWith("_placeholder"))
    : [];
  const externalToolDetail =
    context.selectedMode === "bug_bounty"
      ? "No real target, test account, browser session, scanner, network request, or external service was accessed."
      : "No real email, calendar, server, shell, network, or cloud resource was accessed.";

  return {
    allowed: true,
    requiresApproval: context.requiresUserApproval,
    externalToolsRequired: context.requiresExternalTools,
    summary:
      context.selectedMode === "bug_bounty"
        ? "Only passive bug bounty planning was produced; active testing remains blocked in v0.1."
        : context.requiresExternalTools
          ? "Only a plan was produced; real external integrations remain blocked in v0.1."
          : "Safe deterministic proposal produced without external side effects.",
    blockedCapabilities,
    details: [
      ...context.safetyRequirements,
      context.requiresExternalTools ? externalToolDetail : "No external integration was required."
    ]
  };
}

function buildDocumentProposal(context: AssistantRequestContext): DocumentProposal {
  return {
    ...baseProposal(context, "document", "Draft documentation proposal for the inferred request.", "low", false),
    kind: "document",
    title: "Documentation Draft Proposal",
    targetFormat: "markdown",
    outline: [
      "Purpose and audience",
      "Current known context",
      "Proposed structure",
      "Open questions",
      "Next review step"
    ],
    contentSummary: "Create reviewable Markdown content without writing files automatically."
  };
}

function buildBugBountyReviewProposal(context: AssistantRequestContext): BugBountyReviewProposal {
  const moochackerAssessment = buildMoochackerAssessment(context);

  return {
    ...baseProposal(context, "bug_bounty_review", "Bug bounty review proposal with scope and evidence gates.", "high", true),
    kind: "bug_bounty_review",
    nextActions: buildBugBountyNextActions(moochackerAssessment),
    moochackerAssessment,
    scopeGate: [
      "Confirm the target is in scope and explicitly authorized.",
      "Capture allowed and forbidden vulnerability classes.",
      "Record rate limits, automation limits, and denial-of-service restrictions.",
      "Confirm test accounts, roles, and data handling rules before active testing."
    ],
    targetMapPlaceholders: [
      "hosts",
      "applications",
      "API bases",
      "auth states",
      "roles",
      "endpoints",
      "parameters",
      "state-changing actions"
    ],
    hypotheses: [
      "Authorization boundary issues such as IDOR or role confusion.",
      "Input validation issues with low-impact proof markers.",
      "Session, token, redirect, and file-flow trust boundary issues.",
      "Duplicate-risk checks before spending effort on common findings."
    ],
    evidenceLedgerFields: [
      "lead id",
      "status",
      "asset",
      "endpoint",
      "method",
      "auth state",
      "user role",
      "hypothesis",
      "test performed",
      "evidence",
      "impact",
      "confidence",
      "program rule notes",
      "next action"
    ],
    reportSections: [
      "title",
      "severity",
      "confidence",
      "affected asset",
      "impact",
      "reproduction",
      "evidence",
      "remediation",
      "limitations and scope notes"
    ],
    stopConditions: [
      "Scope, authorization, or program rules are unclear.",
      "The next step could affect availability, billing, production data, or other users.",
      "The next step requires bypassing rate limits, evading detection, persistence, or destructive testing.",
      "Evidence suggests access to real secrets, personal data, or privileged systems.",
      "The issue is proven enough to report safely."
    ]
  };
}

function buildMoochackerAssessment(context: AssistantRequestContext): MoochackerAssessment {
  const normalized = context.originalInput.toLowerCase();
  const dangerousSignals = [
    "ddos",
    "dos",
    "brute force",
    "credential stuffing",
    "password spraying",
    "bypass rate limit",
    "dump database",
    "dump data",
    "steal",
    "destructive",
    "persistence",
    "evade detection",
    "out of scope",
    "without permission",
    "unauthorized"
  ];
  const authorizationSignals = [
    "authorized",
    "bug bounty",
    "program",
    "in scope",
    "scope",
    "safe harbor",
    "test account",
    "allowed"
  ];
  const hasDangerousSignal = dangerousSignals.some((signal) => hasTextSignal(normalized, signal));
  const hasAuthorizationSignal = authorizationSignals.some((signal) => hasTextSignal(normalized, signal));
  const scopeStatus = hasDangerousSignal
    ? "out_of_scope"
    : hasAuthorizationSignal
      ? "sufficient"
      : "needs_clarification";
  const safetyLevel = hasDangerousSignal ? "blocked" : scopeStatus === "sufficient" ? "caution" : "caution";

  return {
    agent: "MoochackerAgent",
    mode: "bug_bounty",
    scopeStatus,
    safetyLevel,
    allowedActions:
      safetyLevel === "blocked"
        ? ["Passive clarification only.", "Record why the requested action is blocked."]
        : [
            "Review user-provided scope and program rules.",
            "Draft a target map from authorized artifacts only.",
            "Prepare minimal-impact hypotheses without sending live requests.",
            "Draft an evidence ledger and report outline."
          ],
    blockedActions: [
      "No real HTTP requests, browser sessions, scanners, exploit execution, or active testing in v0.1.",
      "No denial-of-service, brute force, credential attacks, persistence, stealth, or rate-limit bypass.",
      "No access, collection, alteration, or publication of real user data.",
      "No testing outside explicitly authorized scope."
    ],
    clarifyingQuestions:
      scopeStatus === "sufficient"
        ? []
        : [
            "What exact assets are in scope?",
            "Which techniques are allowed and forbidden by the program rules?",
            "What test account roles are authorized?",
            "What rate limits, automation limits, and data handling rules apply?"
          ],
    evidenceGuidance: [
      "Use owned test accounts, benign marker values, and reversible actions only.",
      "Prefer read-only or minimal-impact verification when evidence is enough.",
      "Record request/response placeholders, auth role, timestamp, impact, confidence, and scope notes.",
      "Stop once the issue is proven enough to report safely."
    ],
    redactionRequirements: [
      "Redact tokens, cookies, passwords, personal data, internal hostnames, and account identifiers.",
      "Use placeholders such as [redacted-session-cookie], [test-user-a], and [owned-test-object].",
      "Keep sensitive evidence local unless the user explicitly asks for a redacted report."
    ],
    reportingNotes: [
      "Separate confirmed findings, hypotheses, tested non-issues, and blind spots.",
      "Calibrate severity by business impact, exploitability, affected users, required privileges, and program policy.",
      "Include remediation guidance without overstating confidence."
    ]
  };
}

function hasTextSignal(source: string, signal: string): boolean {
  if (/^[a-z0-9]+$/.test(signal) && signal.length <= 3) {
    return new RegExp(`\\b${signal}\\b`, "i").test(source);
  }

  return source.includes(signal);
}

function buildBugBountyNextActions(assessment: MoochackerAssessment): readonly string[] {
  if (assessment.safetyLevel === "blocked") {
    return [
      "Do not proceed with active testing.",
      "Clarify authorization, scope, and program rules before any further bug bounty workflow.",
      "Record the blocked request and the reason in the decision log."
    ];
  }

  if (assessment.scopeStatus === "needs_clarification") {
    return [
      "Answer MoochackerAgent's scope and authorization questions.",
      "Provide in-scope assets, forbidden techniques, rate limits, test roles, and data handling rules.",
      "Continue with passive planning only until scope is sufficient."
    ];
  }

  return [
    "Review MoochackerAgent's safety guidance.",
    "Build the target map from authorized artifacts only.",
    "Record evidence and redactions before drafting a report."
  ];
}

function buildSecurityReviewProposal(context: AssistantRequestContext): SecurityReviewProposal {
  return {
    ...baseProposal(context, "security_review", "Basic security review proposal with placeholder scans.", "high", true),
    kind: "security_review",
    checklist: [
      "Identify trust boundaries.",
      "Check for secret handling risks.",
      "Review dependency and configuration exposure.",
      "Record mitigations before implementation."
    ],
    findings: [
      "No live scan was executed in v0.1.",
      "Security review should stay advisory until approved local checks are available."
    ],
    scanPlaceholders: ["secret_scan_placeholder", "inspect_dependencies_placeholder"]
  };
}

function buildOpsPlanProposal(context: AssistantRequestContext): OpsPlanProposal {
  return {
    ...baseProposal(context, "ops_plan", "Operations review plan with live integrations disabled.", "medium", true),
    kind: "ops_plan",
    statusAreas: ["service status", "deployment readiness", "logs", "rollback plan"],
    planSteps: [
      "Define the target environment.",
      "List health checks to run after approval.",
      "Prepare rollback notes before deployment.",
      "Keep live access disabled in v0.1."
    ],
    integrationPlaceholders: ["read_logs_placeholder", "inspect_server_status_placeholder"]
  };
}

function buildProductivityPlanProposal(context: AssistantRequestContext): ProductivityPlanProposal {
  return {
    ...baseProposal(context, "productivity_plan", "Personal productivity plan with external integrations disabled.", "low", true),
    kind: "productivity_plan",
    tasks: [
      "Clarify the desired outcome.",
      "Break preparation into small tasks.",
      "Identify deadlines and dependencies.",
      "Review before creating tasks in any external system."
    ],
    scheduleBlocks: ["prep block", "review block", "buffer block"],
    integrationPlaceholders: ["read_calendar_placeholder", "read_email_placeholder", "create_task_placeholder"]
  };
}

function buildAssistantResponseProposal(context: AssistantRequestContext): AssistantResponseProposal {
  return {
    ...baseProposal(context, "assistant_response", "Structured assistant response prepared without external tools.", "low", false),
    kind: "assistant_response",
    response: "I can help structure the request, identify assumptions, and recommend a safe next step.",
    suggestedQuestions: [
      "What outcome should be considered done?",
      "Are there files or systems that must stay untouched?",
      "Should this become a development or bug bounty task?"
    ]
  };
}

function baseProposal(
  context: AssistantRequestContext,
  kind: TaskModeProposal["kind"],
  summary: string,
  riskLevel: RiskLevel,
  requiresApproval: boolean
) {
  return {
    id: createStableId("proposal", [kind, context.originalInput]),
    kind,
    summary,
    riskLevel,
    requiresApproval,
    assumptions: context.assumptions,
    nextActions: [
      "Review the structured proposal.",
      "Confirm whether controlled execution should proceed.",
      "Record the decision before expanding scope."
    ]
  };
}
