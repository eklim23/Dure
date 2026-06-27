#!/usr/bin/env node
import { AssistantCore } from "@dure/assistant-core";
import type {
  AssistantRunResult,
  PatchProposal,
  TaskMode,
  TaskModeProposal,
  VerificationCheck
} from "@dure/core";

const rawArgs = process.argv.slice(2);
const args = rawArgs[0] === "--" ? rawArgs.slice(1) : rawArgs;
const parsed = parseArgs(args);

if (!parsed.request) {
  printUsage();
  process.exit(args.length === 0 ? 0 : 1);
}

const assistant = new AssistantCore();
const result = assistant.run(parsed.request, new Date(), { modeOverride: parsed.modeOverride });
printResult(result);

interface ParsedArgs {
  readonly request?: string;
  readonly modeOverride?: TaskMode;
}

function parseArgs(tokens: readonly string[]): ParsedArgs {
  const remaining: string[] = [];
  let modeOverride: TaskMode | undefined;

  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
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
    return { modeOverride };
  }

  if (commandOrRequest === "run" || commandOrRequest === "ask") {
    const request = rest.join(" ").trim();
    return { request: request.length > 0 ? request : undefined, modeOverride };
  }

  const request = [commandOrRequest, ...rest].join(" ").trim();
  return { request: request.length > 0 ? request : undefined, modeOverride };
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
  console.log('  dure ask "Draft a README for this project"');
  console.log('  dure run "Create a simple login-enabled bulletin board"');
}

function printResult(result: AssistantRunResult): void {
  console.log("Dure v0.1");
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
    case "bug_bounty_review":
      return [
        ...base,
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
