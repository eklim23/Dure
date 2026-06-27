import assert from "node:assert/strict";
import test from "node:test";
import type { GoalState, MvpStage } from "@aegisforge/core";
import { CouncilRunner } from "../src/index";

test("council emits one structured finding per reviewer role", () => {
  const council = new CouncilRunner();
  const decision = council.decide(goalState(), stageOne());

  assert.equal(decision.decision, "approved");
  assert.equal(decision.findings.length, 7);
  assert.ok(decision.findings.every((finding) => finding.vote === "approve"));
  assert.ok(decision.rejectedIdeas.includes("Reject uncontrolled autonomous file modification."));
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
