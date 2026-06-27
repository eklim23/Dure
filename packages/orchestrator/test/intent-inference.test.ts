import assert from "node:assert/strict";
import test from "node:test";
import { AegisForgeOrchestrator, IntentInferenceEngine } from "../src/index";

test("infers a high-risk login-enabled bulletin board goal", () => {
  const engine = new IntentInferenceEngine();
  const goal = engine.infer("Create a simple login-enabled bulletin board.");

  assert.equal(goal.inferredGoal, "Build a simple login-enabled bulletin board.");
  assert.equal(goal.riskLevel, "high");
  assert.ok(goal.mvpScope.some((item) => item.includes("bulletin-board posts")));
  assert.ok(goal.mvpScope.some((item) => item.includes("Auth boundary stub")));
  assert.ok(goal.deferredScope.some((item) => item.includes("Password reset")));
});

test("orchestrator accepts a verified controlled patch proposal", () => {
  const orchestrator = new AegisForgeOrchestrator();
  const result = orchestrator.run("Create a simple login-enabled bulletin board");

  assert.equal(result.selectedNextStep.id, 1);
  assert.equal(result.patchProposal.status, "accepted");
  assert.equal(result.verificationResult.accepted, true);
  assert.deepEqual(
    result.decisionLog.entries.map((entry) => entry.type),
    [
      "inferred_goal",
      "mvp_scope_decision",
      "agent_comments",
      "rejected_ideas",
      "accepted_plan",
      "patch_proposal_summary",
      "verification_result",
      "next_recommended_step"
    ]
  );
});
