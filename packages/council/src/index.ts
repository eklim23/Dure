import type {
  AgentFinding,
  CouncilDecision,
  GoalState,
  MvpStage,
  ReviewerRole
} from "@aegisforge/core";

interface MockAgent {
  readonly role: ReviewerRole;
  evaluate(goalState: GoalState, nextStep: MvpStage): AgentFinding;
}

const reviewerRoles: readonly ReviewerRole[] = [
  "IntentAgent",
  "ProductAgent",
  "ArchitectAgent",
  "SecurityAgent",
  "MaintainerAgent",
  "TesterAgent",
  "ReviewerAgent"
];

export class CouncilRunner {
  private readonly agents: readonly MockAgent[] = reviewerRoles.map((role) => new DeterministicMockAgent(role));

  decide(goalState: GoalState, selectedNextStep: MvpStage): CouncilDecision {
    const findings = this.agents.map((agent) => agent.evaluate(goalState, selectedNextStep));
    const hasRejection = findings.some((finding) => finding.vote === "reject");
    const needsChanges = findings.some((finding) => finding.vote === "request_changes");

    return {
      goal: goalState.inferredGoal,
      mvpScope: goalState.mvpScope,
      deferredScope: goalState.deferredScope,
      findings,
      rejectedIdeas: buildRejectedIdeas(goalState),
      acceptedPlan: [
        "Treat the inferred GoalState as the audit anchor.",
        `Proceed only with Stage ${selectedNextStep.id}: ${selectedNextStep.name}.`,
        "Represent generated work as a PatchProposal before any acceptance decision.",
        "Require verifier success before the proposal can be accepted."
      ],
      selectedNextStep,
      decision: hasRejection ? "rejected" : needsChanges ? "needs_changes" : "approved",
      rationale: "The council selected the smallest safe next step and deferred high-risk expansion."
    };
  }
}

class DeterministicMockAgent implements MockAgent {
  constructor(readonly role: ReviewerRole) {}

  evaluate(goalState: GoalState, nextStep: MvpStage): AgentFinding {
    switch (this.role) {
      case "IntentAgent":
        return finding(this.role, "Intent is clear enough for an MVP ladder.", [
          `Inferred goal: ${goalState.inferredGoal}`,
          `Risk level: ${goalState.riskLevel}`
        ], [
          "Keep the GoalState immutable for auditability."
        ], [], "approve", []);

      case "ProductAgent":
        return finding(this.role, "MVP is intentionally narrow.", [
          `First safe step is Stage ${nextStep.id}: ${nextStep.name}.`,
          "Deferred scope protects the first runnable version from feature sprawl."
        ], [
          "Ship one demonstrable workflow before expanding the product surface."
        ], [], "approve", []);

      case "ArchitectAgent":
        return finding(this.role, "Architecture should start as a simple executable skeleton.", [
          "Package boundaries should stay explicit.",
          "The first patch should avoid framework lock-in."
        ], [
          "Use replaceable interfaces for LLM providers, verification, memory, and skills."
        ], [], "approve", []);

      case "SecurityAgent":
        return finding(this.role, "Security accepts the step only because auth remains staged.", [
          "Authentication-related requests are high risk.",
          "No production credential storage should be introduced in the skeleton patch."
        ], [
          "Keep secret scanning and permission review in the verification gate."
        ], goalState.riskLevel === "high" ? ["Auth expansion can create unsafe defaults if rushed."] : [], "approve", []);

      case "MaintainerAgent":
        return finding(this.role, "Maintainability depends on small, reversible patches.", [
          "Single Writer, Multi Reviewer is suitable for rollback and audit trails.",
          "Decision logs should be generated for each run."
        ], [
          "Prefer stable interfaces over broad early abstractions."
        ], [], "approve", []);

      case "TesterAgent":
        return finding(this.role, "Tests should appear as soon as the skeleton exists.", [
          "Stage 3 is dedicated to tests, but v0.1 still needs basic orchestrator tests.",
          "Verifier placeholders must report what is mocked."
        ], [
          "Convert mocked command checks to approved local execution later."
        ], [], "approve", []);

      case "ReviewerAgent":
        return finding(this.role, "The plan is reviewable and constrained.", [
          "PatchProposal structure makes generated changes inspectable.",
          "Rejected ideas are recorded before implementation."
        ], [
          "Reject any patch that bypasses the BuilderRuntime policy."
        ], [], "approve", []);
    }
  }
}

function finding(
  role: ReviewerRole,
  summary: string,
  observations: readonly string[],
  recommendations: readonly string[],
  risks: readonly string[],
  vote: AgentFinding["vote"],
  requiredActions: readonly string[]
): AgentFinding {
  return { role, summary, observations, recommendations, risks, vote, requiredActions };
}

function buildRejectedIdeas(goalState: GoalState): readonly string[] {
  const rejected = [
    "Skip slash-command workflow and infer intent from natural language instead.",
    "Reject broad feature generation before the executable skeleton is stable.",
    "Reject uncontrolled autonomous file modification."
  ];

  if (goalState.riskLevel === "high") {
    rejected.push("Reject production authentication features in the first patch.");
  }

  return rejected;
}
