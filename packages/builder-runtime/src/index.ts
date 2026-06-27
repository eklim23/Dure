import type {
  AgentRole,
  CouncilDecision,
  GoalState,
  MvpStage,
  PatchChange,
  PatchProposal,
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
      changes: buildChanges(input.goalState, input.nextStep),
      policy: {
        singleWriter: true,
        writer,
        reviewers: REVIEWERS
      },
      createdAt: new Date().toISOString(),
      status: "proposed"
    };

    const safety = this.workspace.validatePatchProposal(proposal);
    if (!safety.safe) {
      throw new Error(`PatchProposal contains unsafe paths: ${safety.rejectedPaths.join(", ")}`);
    }

    return proposal;
  }
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
