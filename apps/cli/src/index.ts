#!/usr/bin/env node
import { AssistantCore } from "@aegisforge/assistant-core";
import type {
  AssistantRunResult,
  PatchProposal,
  TaskModeProposal,
  VerificationCheck
} from "@aegisforge/core";

const rawArgs = process.argv.slice(2);
const args = rawArgs[0] === "--" ? rawArgs.slice(1) : rawArgs;
const [commandOrRequest, ...rest] = args;

const request = parseRequest(commandOrRequest, rest);
if (!request) {
  printUsage();
  process.exit(commandOrRequest === undefined ? 0 : 1);
}

const assistant = new AssistantCore();
const result = assistant.run(request);
printResult(result);

function parseRequest(commandOrRequest: string | undefined, rest: readonly string[]): string | undefined {
  if (commandOrRequest === undefined) {
    return undefined;
  }

  if (commandOrRequest === "run" || commandOrRequest === "ask") {
    const request = rest.join(" ").trim();
    return request.length > 0 ? request : undefined;
  }

  return [commandOrRequest, ...rest].join(" ").trim();
}

function printUsage(): void {
  console.log("Usage:");
  console.log('  aegisforge "Create a simple login-enabled bulletin board"');
  console.log('  aegisforge ask "Draft a README for this project"');
  console.log('  aegisforge run "Create a simple login-enabled bulletin board"');
}

function printResult(result: AssistantRunResult): void {
  console.log("AegisForge v0.1");
  console.log("");
  section("Original Request", [result.context.originalInput]);
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
