import type { AssistantRequestContext, AssistantRunResult, TaskMode } from "@dure/core";
import { IntentRouter } from "@dure/intent-router";
import { DecisionLogRecorder, RunStore } from "@dure/memory";
import { TaskModeRunner } from "@dure/task-modes";

export class AssistantCore {
  private readonly router = new IntentRouter();
  private readonly modes = new TaskModeRunner();

  run(input: string, now = new Date(), options: AssistantRunOptions = {}): AssistantRunResult {
    const route = this.router.route(input, options.modeOverride);
    const context: AssistantRequestContext = {
      originalInput: input,
      inferredIntent: route.inferredIntent,
      selectedMode: route.selectedMode,
      confidenceScore: route.confidenceScore,
      assumptions: route.assumptions,
      requiredCapabilities: route.requiredCapabilities,
      safetyRequirements: route.safetyRequirements,
      requiresUserApproval: route.requiresUserApproval,
      requiresExternalTools: route.requiresExternalTools,
      rejectedModes: route.rejectedModes,
      createdAt: now.toISOString()
    };

    const log = new DecisionLogRecorder();
    log.append("original_user_input", "Assistant Core received a natural language request.", {
      originalInput: context.originalInput
    });
    log.append("task_mode_selected", "Intent Router selected a task mode.", {
      selectedMode: context.selectedMode,
      confidenceScore: context.confidenceScore,
      inferredIntent: context.inferredIntent
    });
    log.append("routing_decision", "Non-selected modes were rejected for this request.", {
      rejectedModes: context.rejectedModes,
      requiredCapabilities: context.requiredCapabilities,
      assumptions: context.assumptions
    });

    const modeResult = this.modes.execute(context, {
      workspaceRoot: options.workspaceRoot,
      now
    });

    log.append("selected_agent_team", "Mode-specific agent team was selected.", {
      selectedAgentTeam: modeResult.selectedAgentTeam
    });
    log.append("proposal_produced", "Mode-specific proposal was produced.", {
      proposalKind: modeResult.proposal.kind,
      proposalId: modeResult.proposal.id,
      summary: modeResult.proposal.summary,
      riskLevel: modeResult.proposal.riskLevel,
      requiresApproval: modeResult.proposal.requiresApproval
    });
    if (modeResult.proposal.kind === "bug_bounty_review") {
      log.append("agent_comments", "MoochackerAgent produced a structured bug bounty safety assessment.", {
        moochackerAssessment: modeResult.proposal.moochackerAssessment
      });
    }
    if (modeResult.developmentProjectState) {
      log.append("development_project_state", "Development Mode analyzed the local project state without executing commands.", {
        packageManager: modeResult.developmentProjectState.packageManager,
        languages: modeResult.developmentProjectState.languages,
        frameworks: modeResult.developmentProjectState.frameworks,
        scripts: modeResult.developmentProjectState.scripts,
        currentMvpStage: modeResult.developmentProjectState.currentMvpStage
      });
    }
    log.append("safety_decision", "Safety decision was recorded before any controlled action.", {
      safetyDecision: modeResult.safetyDecision,
      verificationResult: modeResult.verificationResult
    });
    log.append("next_recommended_step", "Assistant Core selected the next recommended step.", {
      nextRecommendedAction: modeResult.nextRecommendedAction
    });

    const result: AssistantRunResult = {
      context,
      selectedAgentTeam: modeResult.selectedAgentTeam,
      proposal: modeResult.proposal,
      safetyDecision: modeResult.safetyDecision,
      verificationResult: modeResult.verificationResult,
      developmentResult: modeResult.developmentResult,
      developmentProjectState: modeResult.developmentProjectState,
      decisionLog: log.toDecisionLog(),
      nextRecommendedAction: modeResult.nextRecommendedAction
    };

    if (options.persist === true) {
      const store = new RunStore(options.runStoreRoot);
      const runRecord = store.persistRun({
        context: result.context,
        selectedAgentTeam: result.selectedAgentTeam,
        proposal: result.proposal,
        safetyDecision: result.safetyDecision,
        verificationResult: result.verificationResult,
        developmentProjectState: result.developmentProjectState,
        decisionLog: result.decisionLog,
        nextRecommendedAction: result.nextRecommendedAction,
        now
      });

      return {
        ...result,
        runId: runRecord.id,
        runRecord,
        runArtifactPaths: runRecord.artifactPaths
      };
    }

    return result;
  }
}

export interface AssistantRunOptions {
  readonly modeOverride?: TaskMode;
  readonly persist?: boolean;
  readonly runStoreRoot?: string;
  readonly workspaceRoot?: string;
}
