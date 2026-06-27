import assert from "node:assert/strict";
import test from "node:test";
import type { CouncilDecision, GoalState, MvpStage } from "@aegisforge/core";
import { BuilderRuntime } from "../src/index";

test("BuilderRuntime can create a controlled patch proposal", () => {
  const builder = new BuilderRuntime();
  const proposal = builder.createPatchProposal({
    writer: "BuilderRuntime",
    goalState: goalState(),
    councilDecision: councilDecision(),
    nextStep: stageOne()
  });

  assert.equal(proposal.policy.singleWriter, true);
  assert.equal(proposal.author, "BuilderRuntime");
  assert.ok(proposal.changes.some((change) => change.path === "src/index.js"));
});

test("non-builder agents cannot create patch proposals", () => {
  const builder = new BuilderRuntime();

  assert.throws(
    () =>
      builder.createPatchProposal({
        writer: "SecurityAgent",
        goalState: goalState(),
        councilDecision: councilDecision(),
        nextStep: stageOne()
      }),
    /Single Writer policy rejected/
  );
});

function goalState(): GoalState {
  return {
    rawRequest: "Create a simple login-enabled bulletin board",
    inferredGoal: "Build a simple login-enabled bulletin board.",
    mvpScope: ["Executable project skeleton with one clear run command."],
    deferredScope: ["Password reset and OAuth."],
    assumptions: ["Authentication is security-sensitive."],
    riskLevel: "high",
    requiredAgents: [
      "IntentAgent",
      "ProductAgent",
      "ArchitectAgent",
      "SecurityAgent",
      "MaintainerAgent",
      "TesterAgent",
      "ReviewerAgent",
      "BuilderAgent"
    ],
    suggestedPhases: [],
    createdAt: "2026-06-27T00:00:00.000Z"
  };
}

function stageOne(): MvpStage {
  return {
    id: 1,
    name: "create executable skeleton",
    objective: "Create the smallest runnable structure.",
    exitCriteria: ["Project has an entry point"]
  };
}

function councilDecision(): CouncilDecision {
  return {
    goal: "Build a simple login-enabled bulletin board.",
    mvpScope: ["Executable project skeleton with one clear run command."],
    deferredScope: ["Password reset and OAuth."],
    findings: [],
    rejectedIdeas: ["Reject uncontrolled autonomous file modification."],
    acceptedPlan: ["Proceed with Stage 1."],
    selectedNextStep: stageOne(),
    decision: "approved",
    rationale: "Smallest safe next step."
  };
}
