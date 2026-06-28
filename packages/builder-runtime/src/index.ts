import type {
  AgentRole,
  CouncilDecision,
  GoalState,
  MvpStage,
  PatchChange,
  PatchChangePlan,
  PatchPreview,
  PatchProposal,
  PatchRiskAssessment,
  RiskLevel,
  ReviewerRole
} from "@dure/core";
import { createStableId } from "@dure/core";
import { ControlledWorkspace } from "@dure/sandbox";

export interface PatchProposalInput {
  readonly writer: AgentRole | "BuilderRuntime";
  readonly goalState: GoalState;
  readonly councilDecision: CouncilDecision;
  readonly nextStep: MvpStage;
}

const REVIEWERS: readonly ReviewerRole[] = [
  "IntentAgent",
  "ProductAgent",
  "ArchitectAgent",
  "SecurityAgent",
  "MaintainerAgent",
  "TesterAgent",
  "ReviewerAgent"
];

export class BuilderRuntime {
  private readonly workspace = new ControlledWorkspace();

  createPatchProposal(input: PatchProposalInput): PatchProposal {
    const writer = authorizeWriter(input.writer);
    const summary = `Controlled proposal for Stage ${input.nextStep.id}: ${input.nextStep.name}.`;
    const createdAt = new Date().toISOString();
    const changes = buildChanges(input.goalState, input.nextStep);
    const proposal: PatchProposal = {
      id: createStableId("patch", [input.goalState.inferredGoal, String(input.nextStep.id), summary]),
      kind: "patch",
      author: writer,
      goal: input.goalState.inferredGoal,
      stage: input.nextStep,
      summary,
      riskLevel: input.goalState.riskLevel,
      requiresApproval: true,
      assumptions: input.goalState.assumptions,
      nextActions: [
        "Review the proposed file changes.",
        "Run the verification gate before accepting the patch.",
        "Apply the patch only through a controlled workspace path."
      ],
      changes,
      preview: buildPatchPreview(summary, changes, input.goalState.riskLevel, createdAt),
      policy: {
        singleWriter: true,
        writer,
        reviewers: REVIEWERS
      },
      createdAt,
      status: "proposed"
    };

    const safety = this.workspace.validatePatchProposal(proposal);
    if (!safety.safe) {
      throw new Error(`PatchProposal contains unsafe paths: ${safety.rejectedPaths.join(", ")}`);
    }

    return proposal;
  }
}

function buildPatchPreview(
  summary: string,
  changes: readonly PatchChange[],
  proposalRisk: RiskLevel,
  generatedAt: string
): PatchPreview {
  const changePlan = changes.map(buildChangePlan);
  const riskAssessment = assessPatchRisk(changePlan, proposalRisk);

  return {
    summary: `${summary} Review ${changes.length} planned file change${changes.length === 1 ? "" : "s"} before approval.`,
    changePlan,
    riskAssessment,
    unifiedDiff: buildUnifiedDiff(changes),
    generatedAt
  };
}

function buildChangePlan(change: PatchChange): PatchChangePlan {
  const riskLevel = riskForChange(change);
  const requiresSeparateApproval = change.operation === "delete" || isSensitivePath(change.path);

  return {
    path: change.path,
    operation: change.operation,
    purpose: change.rationale,
    expectedImpact: expectedImpact(change),
    riskLevel,
    requiresApproval: true,
    requiresSeparateApproval,
    reviewFocus: reviewFocus(change, riskLevel, requiresSeparateApproval)
  };
}

function assessPatchRisk(
  changePlan: readonly PatchChangePlan[],
  proposalRisk: RiskLevel
): PatchRiskAssessment {
  const changeRisk = maxRisk(changePlan.map((change) => change.riskLevel));
  const overallRisk = maxRisk([proposalRisk, changeRisk]);
  const separateApprovalRequired = changePlan.some((change) => change.requiresSeparateApproval);
  const reasons = [
    `proposal risk: ${proposalRisk}`,
    `highest file risk: ${changeRisk}`,
    separateApprovalRequired
      ? "one or more changes touch deletion or sensitive paths"
      : "all changes can use the normal patch approval gate"
  ];

  return {
    overallRisk,
    approvalRequired: true,
    separateApprovalRequired,
    reasons
  };
}

function riskForChange(change: PatchChange): RiskLevel {
  if (change.operation === "delete" || isSensitivePath(change.path)) {
    return "high";
  }
  if (change.operation === "modify" || isManifestPath(change.path)) {
    return "medium";
  }
  return "low";
}

function isSensitivePath(filePath: string): boolean {
  const normalized = filePath.toLowerCase();
  return [
    ".env",
    "auth",
    "authentication",
    "authorization",
    "credential",
    "secret",
    "security",
    "token"
  ].some((signal) => normalized.includes(signal));
}

function isManifestPath(filePath: string): boolean {
  const normalized = filePath.toLowerCase();
  return normalized === "package.json"
    || normalized.endsWith("package.json")
    || normalized.endsWith("pnpm-lock.yaml")
    || normalized.endsWith("package-lock.json")
    || normalized.endsWith("yarn.lock")
    || normalized.endsWith("bun.lock")
    || normalized.endsWith("bun.lockb")
    || normalized.endsWith("tsconfig.json");
}

function expectedImpact(change: PatchChange): string {
  switch (change.operation) {
    case "create":
      return `Creates ${change.path} as new project surface.`;
    case "modify":
      return `Updates existing behavior or configuration in ${change.path}.`;
    case "delete":
      return `Removes ${change.path}; this requires separate approval in v0.1.`;
  }
}

function reviewFocus(
  change: PatchChange,
  riskLevel: RiskLevel,
  requiresSeparateApproval: boolean
): readonly string[] {
  return [
    "Confirm the path is inside the controlled workspace.",
    "Confirm the change matches the selected MVP stage.",
    change.content === undefined ? "Confirm no generated content is required for this operation." : "Review generated content before apply.",
    riskLevel === "high" ? "Security-sensitive path or deletion requires extra review." : "No high-risk path signal detected.",
    requiresSeparateApproval ? "Separate approval is required before apply." : "Normal patch approval is sufficient."
  ];
}

function buildUnifiedDiff(changes: readonly PatchChange[]): string {
  return changes.map(diffForChange).join("\n");
}

function diffForChange(change: PatchChange): string {
  const target = change.path.replace(/\\/g, "/");
  const contentLines = splitLines(change.content ?? "");
  if (change.operation === "create") {
    return [
      `diff --git a/${target} b/${target}`,
      "new file mode 100644",
      "--- /dev/null",
      `+++ b/${target}`,
      `@@ -0,0 +1,${Math.max(contentLines.length, 1)} @@`,
      ...contentLines.map((line) => `+${line}`)
    ].join("\n");
  }

  if (change.operation === "delete") {
    return [
      `diff --git a/${target} b/${target}`,
      "deleted file mode 100644",
      `--- a/${target}`,
      "+++ /dev/null",
      "@@ -1 +0,0 @@",
      "-[existing file content not captured in proposal preview]"
    ].join("\n");
  }

  return [
    `diff --git a/${target} b/${target}`,
    `--- a/${target}`,
    `+++ b/${target}`,
    `@@ -1 +1,${Math.max(contentLines.length, 1)} @@`,
    "-[existing file content not captured in proposal preview]",
    ...contentLines.map((line) => `+${line}`)
  ].join("\n");
}

function splitLines(content: string): readonly string[] {
  const normalized = content.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const withoutTrailingNewline = normalized.endsWith("\n") ? normalized.slice(0, -1) : normalized;
  return withoutTrailingNewline.length > 0 ? withoutTrailingNewline.split("\n") : [""];
}

function maxRisk(values: readonly RiskLevel[]): RiskLevel {
  if (values.includes("high")) {
    return "high";
  }
  if (values.includes("medium")) {
    return "medium";
  }
  return "low";
}

function authorizeWriter(writer: AgentRole | "BuilderRuntime"): "BuilderAgent" | "BuilderRuntime" {
  if (writer === "BuilderAgent" || writer === "BuilderRuntime") {
    return writer;
  }

  throw new Error(`Single Writer policy rejected ${writer}; only BuilderAgent or BuilderRuntime can propose patches.`);
}

function buildChanges(goalState: GoalState, nextStep: MvpStage): readonly PatchChange[] {
  if (nextStep.id === 1) {
    return [
      {
        path: "package.json",
        operation: "create",
        rationale: "Introduce a minimal executable project manifest.",
        content: JSON.stringify(
          {
            name: "generated-mvp",
            version: "0.1.0",
            private: true,
            scripts: {
              start: "node src/index.js",
              test: "node --test"
            }
          },
          null,
          2
        )
      },
      {
        path: "src/index.js",
        operation: "create",
        rationale: "Provide the smallest runnable entry point for the MVP.",
        content: `console.log(${JSON.stringify(goalState.inferredGoal)});\n`
      },
      {
        path: "README.md",
        operation: "create",
        rationale: "Document the initial goal, MVP scope, and deferred work.",
        content: `# Generated MVP\n\nGoal: ${goalState.inferredGoal}\n\nMVP scope:\n${goalState.mvpScope
          .map((item) => `- ${item}`)
          .join("\n")}\n`
      }
    ];
  }

  return [
    {
      path: `docs/stage-${nextStep.id}.md`,
      operation: "create",
      rationale: "Record the selected stage before implementation.",
      content: `# Stage ${nextStep.id}: ${nextStep.name}\n\n${nextStep.objective}\n`
    }
  ];
}
