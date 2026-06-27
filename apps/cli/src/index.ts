#!/usr/bin/env node
import { AssistantCore } from "@dure/assistant-core";
import type {
  AssistantRunResult,
  PatchProposal,
  RunPreview,
  TaskMode,
  TaskModeProposal,
  VerificationCheck,
  VerificationResult
} from "@dure/core";
import { RunStore } from "@dure/memory";

const rawArgs = process.argv.slice(2);
const args = rawArgs[0] === "--" ? rawArgs.slice(1) : rawArgs;

try {
  const parsed = parseArgs(args);

  if (parsed.command === "preview") {
    if (!parsed.previewRunId) {
      throw new Error("preview requires a run id.");
    }
    const preview = new RunStore().loadPreview(parsed.previewRunId);
    printRunPreview(preview);
    process.exit(0);
  }

  if (!parsed.request) {
    printUsage();
    process.exit(args.length === 0 ? 0 : 1);
  }

  const assistant = new AssistantCore();
  const result = assistant.run(parsed.request, new Date(), {
    modeOverride: parsed.modeOverride,
    persist: parsed.persist
  });
  printResult(result);
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}

interface ParsedArgs {
  readonly command?: "run" | "ask" | "preview";
  readonly request?: string;
  readonly previewRunId?: string;
  readonly modeOverride?: TaskMode;
  readonly persist: boolean;
}

function parseArgs(tokens: readonly string[]): ParsedArgs {
  const remaining: string[] = [];
  let modeOverride: TaskMode | undefined;
  let persist = true;

  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (token === "--no-persist") {
      persist = false;
      continue;
    }
    if (token === "--mode") {
      const value = tokens[index + 1];
      if (!value) {
        throw new Error("--mode requires a value.");
      }
      modeOverride = parseMode(value);
      index += 1;
      continue;
    }
    remaining.push(token);
  }

  const [commandOrRequest, ...rest] = remaining;
  if (commandOrRequest === undefined) {
    return { modeOverride, persist };
  }

  if (commandOrRequest === "preview") {
    if (modeOverride) {
      throw new Error("preview does not support --mode.");
    }
    if (!persist) {
      throw new Error("preview is read-only and does not support --no-persist.");
    }
    if (rest.length !== 1 || rest[0].trim().length === 0) {
      throw new Error("preview requires exactly one run id.");
    }
    return { command: "preview", previewRunId: rest[0], persist };
  }

  if (commandOrRequest === "run" || commandOrRequest === "ask") {
    const request = rest.join(" ").trim();
    return { command: commandOrRequest, request: request.length > 0 ? request : undefined, modeOverride, persist };
  }

  const request = [commandOrRequest, ...rest].join(" ").trim();
  return { request: request.length > 0 ? request : undefined, modeOverride, persist };
}

function parseMode(value: string): TaskMode {
  const normalized = value.toLowerCase().replace(/-/g, "_");
  if (normalized === "dev") {
    return "development";
  }
  if (normalized === "bb" || normalized === "bounty") {
    return "bug_bounty";
  }

  const allowed: readonly TaskMode[] = [
    "assistant",
    "development",
    "bug_bounty",
    "documentation",
    "security",
    "operations",
    "personal_productivity"
  ];
  if (allowed.includes(normalized as TaskMode)) {
    return normalized as TaskMode;
  }

  throw new Error(`Unknown mode: ${value}`);
}

function printUsage(): void {
  console.log("Usage:");
  console.log('  dure "Create a simple login-enabled bulletin board"');
  console.log('  dure --mode bug-bounty "Map scope for an authorized web target"');
  console.log('  dure --no-persist "Temporary dry conversation"');
  console.log('  dure ask "Draft a README for this project"');
  console.log('  dure run "Create a simple login-enabled bulletin board"');
  console.log("  dure preview <run-id>");
}

function printResult(result: AssistantRunResult): void {
  console.log("Dure v0.1");
  console.log("");
  section("Original Request", [result.context.originalInput]);
  if (result.runRecord) {
    section("Run Record", [
      `id: ${result.runRecord.id}`,
      `status: ${result.runRecord.status}`,
      `path: ${result.runRecord.artifactPaths.runDir}`
    ]);
  }
  section("Selected Mode", [
    result.context.selectedMode,
    `confidence: ${result.context.confidenceScore.toFixed(2)}`,
    `intent: ${result.context.inferredIntent}`
  ]);
  section("Assistant Core Summary", [
    `requires approval: ${result.context.requiresUserApproval ? "yes" : "no"}`,
    `external tools required: ${result.context.requiresExternalTools ? "yes (placeholder only)" : "no"}`,
    `capabilities: ${result.context.requiredCapabilities.join(", ")}`
  ]);
  section("Selected Agent Team", result.selectedAgentTeam);
  section("Proposal Summary", summarizeProposal(result.proposal));

  if (result.verificationResult) {
    section("Verification Result", summarizeChecks(result.verificationResult.checks, result.verificationResult.accepted));
  } else {
    section("Safety Result", [
      `allowed: ${result.safetyDecision.allowed ? "yes" : "no"}`,
      `requires approval: ${result.safetyDecision.requiresApproval ? "yes" : "no"}`,
      result.safetyDecision.summary,
      ...result.safetyDecision.details
    ]);
  }

  section("Next Recommended Action", [result.nextRecommendedAction]);
}

function printRunPreview(preview: RunPreview): void {
  if (preview.proposal.kind !== "patch") {
    throw new Error(`Run ${preview.metadata.id} is not a development patch proposal (${preview.proposal.kind}).`);
  }

  const proposal = preview.proposal;
  console.log("Dure Preview");
  console.log("");
  section("Run", [
    `id: ${preview.metadata.id}`,
    `mode: ${preview.metadata.selectedMode}`,
    `run status: ${preview.metadata.status}`,
    `proposal: ${preview.metadata.proposalId}`,
    `request: ${preview.request.originalInput}`
  ]);
  section("Patch", [
    `status: ${proposal.status}`,
    `risk: ${proposal.riskLevel}`,
    `approval required: ${proposal.requiresApproval ? "yes" : "no"}`,
    `author: ${proposal.author}`,
    `stage: ${proposal.stage.id} - ${proposal.stage.name}`,
    `goal: ${proposal.goal}`
  ]);
  section("Summary", [proposal.summary]);
  section(
    "Changes",
    proposal.changes.map((change) => `${change.operation}: ${change.path} - ${change.rationale}`)
  );
  section("Verification", summarizePreviewVerification(preview.verificationResult));
  section("Next", [preview.metadata.nextRecommendedAction]);
}

function section(title: string, lines: readonly string[]): void {
  console.log(`${title}:`);
  for (const line of lines) {
    console.log(`  - ${line}`);
  }
  console.log("");
}

function summarizeProposal(proposal: TaskModeProposal): readonly string[] {
  const base = [
    `${proposal.id} (${proposal.kind})`,
    proposal.summary,
    `risk: ${proposal.riskLevel}`,
    `requires approval: ${proposal.requiresApproval ? "yes" : "no"}`
  ];

  switch (proposal.kind) {
    case "patch":
      return [...base, ...summarizePatch(proposal)];
    case "bug_bounty_review":
      return [
        ...base,
        `moochacker: scope ${proposal.moochackerAssessment.scopeStatus}, safety ${proposal.moochackerAssessment.safetyLevel}`,
        `moochacker allowed: ${proposal.moochackerAssessment.allowedActions.join(" | ")}`,
        `moochacker blocked: ${proposal.moochackerAssessment.blockedActions.join(" | ")}`,
        `clarifying questions: ${proposal.moochackerAssessment.clarifyingQuestions.length > 0 ? proposal.moochackerAssessment.clarifyingQuestions.join(" | ") : "none"}`,
        `evidence guidance: ${proposal.moochackerAssessment.evidenceGuidance.join(" | ")}`,
        `scope gate: ${proposal.scopeGate.join(" | ")}`,
        `hypotheses: ${proposal.hypotheses.join(" | ")}`,
        `report sections: ${proposal.reportSections.join(", ")}`
      ];
    case "document":
      return [...base, `title: ${proposal.title}`, `outline: ${proposal.outline.join(" | ")}`];
    case "security_review":
      return [...base, `checklist: ${proposal.checklist.join(" | ")}`, `placeholders: ${proposal.scanPlaceholders.join(", ")}`];
    case "ops_plan":
      return [...base, `status areas: ${proposal.statusAreas.join(", ")}`, `placeholders: ${proposal.integrationPlaceholders.join(", ")}`];
    case "productivity_plan":
      return [...base, `tasks: ${proposal.tasks.join(" | ")}`, `placeholders: ${proposal.integrationPlaceholders.join(", ")}`];
    case "assistant_response":
      return [...base, proposal.response];
  }
}

function summarizePatch(proposal: PatchProposal): readonly string[] {
  return [
    `status: ${proposal.status}`,
    ...proposal.changes.map((change) => `${change.operation}: ${change.path} - ${change.rationale}`)
  ];
}

function summarizeChecks(checks: readonly VerificationCheck[], accepted: boolean): readonly string[] {
  return [
    `patch accepted: ${accepted ? "yes" : "no"}`,
    ...checks.map((check) => {
      const mode = check.mocked ? "mocked" : "local";
      return `${check.name}: ${check.passed ? "pass" : "fail"} (${mode}) - ${check.summary}`;
    })
  ];
}

function summarizePreviewVerification(result: VerificationResult | undefined): readonly string[] {
  if (!result) {
    return ["not recorded"];
  }

  const local = summarizeCheckGroup(result.checks.filter((check) => !check.mocked));
  const mocked = summarizeCheckGroup(result.checks.filter((check) => check.mocked));
  return [
    `accepted: ${result.accepted ? "yes" : "no"}`,
    `local: ${local}`,
    `mocked: ${mocked}`
  ];
}

function summarizeCheckGroup(checks: readonly VerificationCheck[]): string {
  if (checks.length === 0) {
    return "none";
  }

  return checks.map((check) => `${check.name} ${check.passed ? "pass" : "fail"}`).join(", ");
}
