import type { MvpStage, MvpStageId } from "@dure/core";

export const MVP_LADDER: readonly MvpStage[] = [
  {
    id: 0,
    name: "understand project",
    objective: "Convert the natural language request into a bounded internal goal state.",
    exitCriteria: ["Goal is inferred", "Assumptions and risks are recorded"]
  },
  {
    id: 1,
    name: "create executable skeleton",
    objective: "Create the smallest runnable structure before feature work begins.",
    exitCriteria: ["Project has an entry point", "Project has a documented run command"]
  },
  {
    id: 2,
    name: "implement one core feature",
    objective: "Implement exactly one user-visible core behavior.",
    exitCriteria: ["The behavior is demonstrable", "Deferred features remain explicitly out of scope"]
  },
  {
    id: 3,
    name: "add tests",
    objective: "Add focused tests around the core behavior.",
    exitCriteria: ["Happy path is tested", "At least one failure path is tested"]
  },
  {
    id: 4,
    name: "add validation and error handling",
    objective: "Harden input handling and predictable failures.",
    exitCriteria: ["Invalid inputs are rejected", "Errors are stable and documented"]
  },
  {
    id: 5,
    name: "security and maintainability review",
    objective: "Review the implementation before expanding scope.",
    exitCriteria: ["Security risks are reviewed", "Maintainability concerns are logged"]
  },
  {
    id: 6,
    name: "deferred feature expansion",
    objective: "Promote one deferred capability only after the MVP is stable.",
    exitCriteria: ["One deferred item is selected", "The expansion has its own verification plan"]
  },
  {
    id: 7,
    name: "documentation",
    objective: "Document the stable behavior, constraints, and next safe step.",
    exitCriteria: ["Run instructions are current", "Decision history is summarized"]
  }
];

export class MvpLadder {
  readonly stages = MVP_LADDER;

  selectSmallestSafeNextStep(completedStages: readonly MvpStageId[]): MvpStage {
    const completed = new Set<MvpStageId>(completedStages);
    const next = this.stages.find((stage) => !completed.has(stage.id));
    return next ?? this.stages[this.stages.length - 1];
  }

  asDevelopmentPhases() {
    return this.stages.map((stage) => ({
      stage: stage.id,
      title: stage.name,
      objective: stage.objective,
      exitCriteria: stage.exitCriteria
    }));
  }
}
