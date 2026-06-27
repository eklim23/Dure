import { BuilderRuntime } from "@aegisforge/builder-runtime";
import type { OrchestrationResult } from "@aegisforge/core";
import { CouncilRunner } from "@aegisforge/council";
import { DecisionLogRecorder } from "@aegisforge/memory";
import { PatchVerifier } from "@aegisforge/verifier";
import { IntentInferenceEngine } from "./intent-inference";
import { MvpLadder } from "./mvp-ladder";

export class AegisForgeOrchestrator {
  private readonly inference = new IntentInferenceEngine();
  private readonly council = new CouncilRunner();
  private readonly ladder = new MvpLadder();
  private readonly builder = new BuilderRuntime();
  private readonly verifier = new PatchVerifier();

  run(userRequest: string): OrchestrationResult {
    const log = new DecisionLogRecorder();
    const goalState = this.inference.infer(userRequest);

    log.append("inferred_goal", "Natural language request was converted into a GoalState.", {
      inferredGoal: goalState.inferredGoal,
      riskLevel: goalState.riskLevel,
      assumptions: goalState.assumptions
    });

    log.append("mvp_scope_decision", "MVP scope was reduced to the smallest stable version.", {
      mvpScope: goalState.mvpScope,
      deferredScope: goalState.deferredScope
    });

    const selectedNextStep = this.ladder.selectSmallestSafeNextStep([0]);
    const councilDecision = this.council.decide(goalState, selectedNextStep);

    log.append("agent_comments", "Agent council produced structured review comments.", {
      findings: councilDecision.findings
    });

    log.append("rejected_ideas", "Ideas that expand risk before the MVP were rejected.", {
      rejectedIdeas: councilDecision.rejectedIdeas
    });

    log.append("accepted_plan", "Council accepted the minimal progressive plan.", {
      acceptedPlan: councilDecision.acceptedPlan,
      selectedNextStep: councilDecision.selectedNextStep
    });

    const patchProposal = this.builder.createPatchProposal({
      writer: "BuilderRuntime",
      goalState,
      councilDecision,
      nextStep: selectedNextStep
    });

    log.append("patch_proposal_summary", "BuilderRuntime produced a controlled PatchProposal.", {
      patchId: patchProposal.id,
      summary: patchProposal.summary,
      changes: patchProposal.changes.map((change) => ({
        path: change.path,
        operation: change.operation,
        rationale: change.rationale
      }))
    });

    const verificationResult = this.verifier.verifyPatch(patchProposal);
    patchProposal.status = verificationResult.accepted ? "accepted" : "rejected";

    log.append("verification_result", "Verification gate completed before accepting the patch proposal.", {
      accepted: verificationResult.accepted,
      checks: verificationResult.checks
    });

    const nextRecommendedAction = verificationResult.accepted
      ? "Apply the Stage 1 skeleton in a controlled workspace, then replace mocked checks with approved local commands."
      : "Revise the PatchProposal until every verification check passes.";

    log.append("next_recommended_step", "AegisForge selected the next safe action.", {
      nextRecommendedAction
    });

    return {
      goalState,
      councilDecision,
      selectedNextStep,
      patchProposal,
      verificationResult,
      decisionLog: log.toDecisionLog(),
      nextRecommendedAction
    };
  }
}
