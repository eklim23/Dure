import type {
  AssistantAgentRole,
  AssistantRequestContext,
  Capability,
  DocumentProposal,
  OpsPlanProposal,
  ProductivityPlanProposal,
  RiskLevel,
  SafetyDecision,
  SecurityReviewProposal,
  TaskModeExecutionResult,
  TaskModeProposal,
  AssistantResponseProposal
} from "@aegisforge/core";
import { createStableId } from "@aegisforge/core";
import { AegisForgeOrchestrator } from "@aegisforge/orchestrator";

export class TaskModeRunner {
  private readonly developmentOrchestrator = new AegisForgeOrchestrator();

  execute(context: AssistantRequestContext): TaskModeExecutionResult {
    switch (context.selectedMode) {
      case "development":
        return this.runDevelopmentMode(context);
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
  const blockedCapabilities = context.requiresExternalTools ? context.requiredCapabilities : [];
  return {
    allowed: true,
    requiresApproval: context.requiresUserApproval,
    externalToolsRequired: context.requiresExternalTools,
    summary: context.requiresExternalTools
      ? "Only a plan was produced; real external integrations remain blocked in v0.1."
      : "Safe deterministic proposal produced without external side effects.",
    blockedCapabilities,
    details: [
      ...context.safetyRequirements,
      context.requiresExternalTools
        ? "No real email, calendar, server, shell, network, or cloud resource was accessed."
        : "No external integration was required."
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
      "Should this become a development, documentation, security, operations, or productivity task?"
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
