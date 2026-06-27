#!/usr/bin/env node
import { readFileSync } from "node:fs";
import path from "node:path";
import { AssistantCore } from "@dure/assistant-core";
import type {
  ApplyRecord,
  ApprovalRecord,
  AssistantRunResult,
  BugBountyEvidenceConfidence,
  BugBountyEvidenceInput,
  BugBountyEvidenceRecord,
  BugBountyEvidenceStatus,
  BugBountyHttpMethod,
  BugBountyReportDraftInput,
  BugBountyReportDraftRecord,
  BugBountySeverity,
  BugBountyScopeIntake,
  BugBountyScopeRecord,
  PatchProposal,
  RunPreview,
  TaskMode,
  TaskModeProposal,
  VerificationCheck,
  VerificationResult,
  WorkspaceVerificationRecord,
  WorkspaceVerificationScriptName
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

  if (parsed.command === "approve") {
    if (!parsed.runId) {
      throw new Error("approve requires a run id.");
    }
    const approval = new RunStore().approveRun(parsed.runId, { reason: parsed.reason });
    printApproval(approval);
    process.exit(0);
  }

  if (parsed.command === "reject") {
    if (!parsed.runId) {
      throw new Error("reject requires a run id.");
    }
    const approval = new RunStore().rejectRun(parsed.runId, { reason: parsed.reason });
    printApproval(approval);
    process.exit(0);
  }

  if (parsed.command === "scope") {
    if (!parsed.runId || !parsed.scopeIntake) {
      throw new Error("scope requires a run id and scope fields.");
    }
    const scope = new RunStore().attachBugBountyScope(parsed.runId, { scope: parsed.scopeIntake });
    printScope(scope);
    process.exit(0);
  }

  if (parsed.command === "apply") {
    if (!parsed.runId) {
      throw new Error("apply requires a run id.");
    }
    const apply = new RunStore().applyRun(parsed.runId, { workspaceRoot: parsed.workspaceRoot });
    printApply(apply);
    process.exit(0);
  }

  if (parsed.command === "verify") {
    if (!parsed.runId) {
      throw new Error("verify requires a run id.");
    }
    const verification = new RunStore().verifyRun(parsed.runId, {
      workspaceRoot: parsed.workspaceRoot,
      scripts: parsed.verificationScripts,
      timeoutMs: parsed.timeoutMs
    });
    printWorkspaceVerification(verification);
    process.exit(verification.accepted ? 0 : 1);
  }

  if (parsed.command === "evidence") {
    if (!parsed.runId) {
      throw new Error("evidence requires a run id.");
    }
    const store = new RunStore();
    if (parsed.listEvidence) {
      printEvidenceLedger(store.loadPreview(parsed.runId));
    } else if (parsed.bugBountyEvidenceInput) {
      const record = store.recordBugBountyEvidence(parsed.runId, { evidence: parsed.bugBountyEvidenceInput });
      printEvidenceRecord(record);
    } else {
      throw new Error("evidence requires fields to record a lead, or no options to list the ledger.");
    }
    process.exit(0);
  }

  if (parsed.command === "report") {
    if (!parsed.runId) {
      throw new Error("report requires a run id.");
    }
    const store = new RunStore();
    if (parsed.listReports) {
      printReportDrafts(store.loadPreview(parsed.runId));
    } else if (parsed.bugBountyReportDraftInput) {
      const record = store.draftBugBountyReport(parsed.runId, { draft: parsed.bugBountyReportDraftInput });
      printReportDraft(record);
    } else {
      throw new Error("report requires --lead to draft a report, or no options to list report drafts.");
    }
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
  readonly command?: "run" | "ask" | "preview" | "approve" | "reject" | "scope" | "apply" | "verify" | "evidence" | "report";
  readonly request?: string;
  readonly previewRunId?: string;
  readonly runId?: string;
  readonly reason?: string;
  readonly workspaceRoot?: string;
  readonly verificationScripts?: readonly WorkspaceVerificationScriptName[];
  readonly timeoutMs?: number;
  readonly scopeIntake?: BugBountyScopeIntake;
  readonly bugBountyEvidenceInput?: BugBountyEvidenceInput;
  readonly listEvidence?: boolean;
  readonly bugBountyReportDraftInput?: BugBountyReportDraftInput;
  readonly listReports?: boolean;
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
    rejectRunCommandGlobalOptions("preview", modeOverride, persist);
    if (rest.length !== 1 || rest[0].trim().length === 0) {
      throw new Error("preview requires exactly one run id.");
    }
    return { command: "preview", previewRunId: rest[0], persist };
  }

  if (commandOrRequest === "approve" || commandOrRequest === "reject") {
    rejectRunCommandGlobalOptions(commandOrRequest, modeOverride, persist);
    return parseApprovalCommand(commandOrRequest, rest, persist);
  }

  if (commandOrRequest === "scope") {
    rejectRunCommandGlobalOptions("scope", modeOverride, persist);
    return parseScopeCommand(rest, persist);
  }

  if (commandOrRequest === "apply") {
    rejectRunCommandGlobalOptions("apply", modeOverride, persist);
    return parseApplyCommand(rest, persist);
  }

  if (commandOrRequest === "verify") {
    rejectRunCommandGlobalOptions("verify", modeOverride, persist);
    return parseVerifyCommand(rest, persist);
  }

  if (commandOrRequest === "evidence") {
    rejectRunCommandGlobalOptions("evidence", modeOverride, persist);
    return parseEvidenceCommand(rest, persist);
  }

  if (commandOrRequest === "report") {
    rejectRunCommandGlobalOptions("report", modeOverride, persist);
    return parseReportCommand(rest, persist);
  }

  if (commandOrRequest === "run" || commandOrRequest === "ask") {
    const request = rest.join(" ").trim();
    return { command: commandOrRequest, request: request.length > 0 ? request : undefined, modeOverride, persist };
  }

  const request = [commandOrRequest, ...rest].join(" ").trim();
  return { request: request.length > 0 ? request : undefined, modeOverride, persist };
}

function rejectRunCommandGlobalOptions(command: string, modeOverride: TaskMode | undefined, persist: boolean): void {
  if (modeOverride) {
    throw new Error(`${command} does not support --mode.`);
  }
  if (!persist) {
    throw new Error(`${command} is read-only or record-only and does not support --no-persist.`);
  }
}

function parseApprovalCommand(command: "approve" | "reject", tokens: readonly string[], persist: boolean): ParsedArgs {
  const [runId, ...rest] = tokens;
  if (!runId || runId.trim().length === 0) {
    throw new Error(`${command} requires exactly one run id.`);
  }

  const options = parseCommandOptions(rest, ["reason"]);
  return {
    command,
    runId,
    reason: firstOption(options, "reason"),
    persist
  };
}

function parseScopeCommand(tokens: readonly string[], persist: boolean): ParsedArgs {
  const [runId, ...rest] = tokens;
  if (!runId || runId.trim().length === 0) {
    throw new Error("scope requires exactly one run id.");
  }

  const options = parseCommandOptions(rest, [
    "scope-file",
    "target",
    "in-scope",
    "out-of-scope",
    "allowed",
    "forbidden",
    "rate-limit",
    "roles",
    "data",
    "authorization-note",
    "program-rules-url"
  ]);
  const fileScope = firstOption(options, "scope-file")
    ? readScopeFile(firstOption(options, "scope-file") as string)
    : emptyScope();
  const scopeIntake: BugBountyScopeIntake = {
    target: firstOption(options, "target") ?? fileScope.target,
    inScopeAssets: mergeLists(fileScope.inScopeAssets, listOptions(options, "in-scope")),
    outOfScopeAssets: mergeLists(fileScope.outOfScopeAssets, listOptions(options, "out-of-scope")),
    allowedTechniques: mergeLists(fileScope.allowedTechniques, listOptions(options, "allowed")),
    forbiddenTechniques: mergeLists(fileScope.forbiddenTechniques, listOptions(options, "forbidden")),
    rateLimits: mergeLists(fileScope.rateLimits, listOptions(options, "rate-limit")),
    testAccountRoles: mergeLists(fileScope.testAccountRoles, listOptions(options, "roles")),
    dataHandlingRules: mergeLists(fileScope.dataHandlingRules, listOptions(options, "data")),
    authorizationNote: firstOption(options, "authorization-note") ?? fileScope.authorizationNote,
    programRulesUrl: firstOption(options, "program-rules-url") ?? fileScope.programRulesUrl
  };

  return {
    command: "scope",
    runId,
    scopeIntake,
    persist
  };
}

function parseApplyCommand(tokens: readonly string[], persist: boolean): ParsedArgs {
  const [runId, ...rest] = tokens;
  if (!runId || runId.trim().length === 0) {
    throw new Error("apply requires exactly one run id.");
  }

  const options = parseCommandOptions(rest, ["workspace"]);
  return {
    command: "apply",
    runId,
    workspaceRoot: firstOption(options, "workspace"),
    persist
  };
}

function parseVerifyCommand(tokens: readonly string[], persist: boolean): ParsedArgs {
  const [runId, ...rest] = tokens;
  if (!runId || runId.trim().length === 0) {
    throw new Error("verify requires exactly one run id.");
  }

  const options = parseCommandOptions(rest, ["workspace", "script", "timeout-ms"]);
  const timeoutMsValue = firstOption(options, "timeout-ms");
  let timeoutMs: number | undefined;
  if (timeoutMsValue !== undefined) {
    const parsedTimeoutMs = Number.parseInt(timeoutMsValue, 10);
    if (!Number.isInteger(parsedTimeoutMs) || parsedTimeoutMs <= 0) {
      throw new Error("--timeout-ms requires a positive integer value.");
    }
    timeoutMs = parsedTimeoutMs;
  }
  return {
    command: "verify",
    runId,
    workspaceRoot: firstOption(options, "workspace"),
    verificationScripts: parseVerificationScripts(listOptions(options, "script")),
    timeoutMs,
    persist
  };
}

function parseEvidenceCommand(tokens: readonly string[], persist: boolean): ParsedArgs {
  const [runId, ...rest] = tokens;
  if (!runId || runId.trim().length === 0) {
    throw new Error("evidence requires exactly one run id.");
  }
  if (rest.length === 0) {
    return { command: "evidence", runId, listEvidence: true, persist };
  }

  const options = parseCommandOptions(rest, [
    "status",
    "asset",
    "endpoint",
    "method",
    "auth-state",
    "role",
    "object-ownership",
    "hypothesis",
    "test",
    "request",
    "response",
    "evidence",
    "impact",
    "confidence",
    "scope-note",
    "program-rule",
    "next-action"
  ]);
  const evidence: BugBountyEvidenceInput = {
    status: parseEvidenceStatus(firstOption(options, "status") ?? "hypothesis"),
    asset: firstOption(options, "asset") ?? "",
    endpoint: firstOption(options, "endpoint"),
    method: firstOption(options, "method") ? parseHttpMethod(firstOption(options, "method") as string) : undefined,
    authState: firstOption(options, "auth-state"),
    userRole: firstOption(options, "role"),
    objectOwnership: firstOption(options, "object-ownership"),
    hypothesis: firstOption(options, "hypothesis") ?? "",
    testPerformed: firstOption(options, "test"),
    requestSummary: firstOption(options, "request"),
    responseSummary: firstOption(options, "response"),
    evidence: firstOption(options, "evidence"),
    impact: firstOption(options, "impact") ?? "",
    confidence: parseEvidenceConfidence(firstOption(options, "confidence") ?? "low"),
    scopeNote: firstOption(options, "scope-note") ?? "",
    programRuleNotes: firstOption(options, "program-rule"),
    nextAction: firstOption(options, "next-action") ?? ""
  };

  return {
    command: "evidence",
    runId,
    bugBountyEvidenceInput: evidence,
    persist
  };
}

function parseReportCommand(tokens: readonly string[], persist: boolean): ParsedArgs {
  const [runId, ...rest] = tokens;
  if (!runId || runId.trim().length === 0) {
    throw new Error("report requires exactly one run id.");
  }
  if (rest.length === 0) {
    return { command: "report", runId, listReports: true, persist };
  }

  const options = parseCommandOptions(rest, [
    "lead",
    "title",
    "severity",
    "roles",
    "step",
    "remediation",
    "limitations",
    "duplicate-risk"
  ]);
  const leadId = firstOption(options, "lead");
  if (!leadId) {
    throw new Error("report requires --lead when drafting a report.");
  }
  const severity = firstOption(options, "severity");
  const duplicateRisk = firstOption(options, "duplicate-risk");
  const draft: BugBountyReportDraftInput = {
    leadId,
    title: firstOption(options, "title"),
    severity: severity ? parseSeverity(severity) : undefined,
    affectedUsersOrRoles: listOptions(options, "roles"),
    reproductionSteps: listOptions(options, "step"),
    remediation: firstOption(options, "remediation"),
    limitations: firstOption(options, "limitations"),
    duplicateRisk: duplicateRisk === undefined ? undefined : parseBoolean(duplicateRisk, "--duplicate-risk")
  };

  return {
    command: "report",
    runId,
    bugBountyReportDraftInput: draft,
    persist
  };
}

function parseCommandOptions(tokens: readonly string[], allowed: readonly string[]): Map<string, string[]> {
  const options = new Map<string, string[]>();
  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (!token.startsWith("--")) {
      throw new Error(`Unexpected argument: ${token}`);
    }
    const name = token.slice(2);
    if (!allowed.includes(name)) {
      throw new Error(`Unknown option: ${token}`);
    }
    const value = tokens[index + 1];
    if (!value || value.startsWith("--")) {
      throw new Error(`${token} requires a value.`);
    }
    const existing = options.get(name) ?? [];
    options.set(name, [...existing, value]);
    index += 1;
  }
  return options;
}

function firstOption(options: Map<string, string[]>, name: string): string | undefined {
  return options.get(name)?.[0];
}

function listOptions(options: Map<string, string[]>, name: string): readonly string[] {
  return (options.get(name) ?? []).flatMap(splitList);
}

function splitList(value: string): readonly string[] {
  return value.split(",").map((item) => item.trim()).filter((item) => item.length > 0);
}

function mergeLists(left: readonly string[], right: readonly string[]): readonly string[] {
  return [...left, ...right].map((item) => item.trim()).filter((item) => item.length > 0);
}

function parseVerificationScripts(values: readonly string[]): readonly WorkspaceVerificationScriptName[] | undefined {
  if (values.length === 0) {
    return undefined;
  }
  return [...new Set(values.map(parseVerificationScript))];
}

function parseVerificationScript(value: string): WorkspaceVerificationScriptName {
  const normalized = value.trim().toLowerCase();
  if (normalized === "test" || normalized === "lint" || normalized === "typecheck") {
    return normalized;
  }
  throw new Error(`Unsupported verification script: ${value}. Allowed scripts: test, lint, typecheck.`);
}

function parseEvidenceStatus(value: string): BugBountyEvidenceStatus {
  const normalized = value.trim().toLowerCase();
  const allowed: readonly BugBountyEvidenceStatus[] = [
    "hypothesis",
    "testing",
    "confirmed",
    "duplicate-risk",
    "non-issue",
    "blocked"
  ];
  if (allowed.includes(normalized as BugBountyEvidenceStatus)) {
    return normalized as BugBountyEvidenceStatus;
  }
  throw new Error(`Unsupported evidence status: ${value}.`);
}

function parseEvidenceConfidence(value: string): BugBountyEvidenceConfidence {
  const normalized = value.trim().toLowerCase();
  if (normalized === "low" || normalized === "medium" || normalized === "high") {
    return normalized;
  }
  throw new Error(`Unsupported evidence confidence: ${value}.`);
}

function parseHttpMethod(value: string): BugBountyHttpMethod {
  const normalized = value.trim().toUpperCase();
  const allowed: readonly BugBountyHttpMethod[] = ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS", "OTHER"];
  if (allowed.includes(normalized as BugBountyHttpMethod)) {
    return normalized as BugBountyHttpMethod;
  }
  throw new Error(`Unsupported HTTP method: ${value}.`);
}

function parseSeverity(value: string): BugBountySeverity {
  const normalized = value.trim().toLowerCase();
  const allowed: readonly BugBountySeverity[] = ["informational", "low", "medium", "high", "critical"];
  if (allowed.includes(normalized as BugBountySeverity)) {
    return normalized as BugBountySeverity;
  }
  throw new Error(`Unsupported severity: ${value}.`);
}

function parseBoolean(value: string, optionName: string): boolean {
  const normalized = value.trim().toLowerCase();
  if (normalized === "true" || normalized === "yes" || normalized === "1") {
    return true;
  }
  if (normalized === "false" || normalized === "no" || normalized === "0") {
    return false;
  }
  throw new Error(`${optionName} requires true or false.`);
}

function readScopeFile(filePath: string): BugBountyScopeIntake {
  const absolutePath = path.resolve(filePath);
  try {
    return coerceScope(JSON.parse(readFileSync(absolutePath, "utf8")) as Record<string, unknown>);
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error(`Malformed scope file: ${absolutePath}`);
    }
    throw error;
  }
}

function coerceScope(value: Record<string, unknown>): BugBountyScopeIntake {
  return {
    target: stringField(value, "target"),
    inScopeAssets: arrayField(value, "inScopeAssets"),
    outOfScopeAssets: arrayField(value, "outOfScopeAssets"),
    allowedTechniques: arrayField(value, "allowedTechniques"),
    forbiddenTechniques: arrayField(value, "forbiddenTechniques"),
    rateLimits: arrayField(value, "rateLimits"),
    testAccountRoles: arrayField(value, "testAccountRoles"),
    dataHandlingRules: arrayField(value, "dataHandlingRules"),
    authorizationNote: stringField(value, "authorizationNote"),
    programRulesUrl: optionalStringField(value, "programRulesUrl")
  };
}

function emptyScope(): BugBountyScopeIntake {
  return {
    target: "",
    inScopeAssets: [],
    outOfScopeAssets: [],
    allowedTechniques: [],
    forbiddenTechniques: [],
    rateLimits: [],
    testAccountRoles: [],
    dataHandlingRules: [],
    authorizationNote: ""
  };
}

function stringField(value: Record<string, unknown>, field: string): string {
  const item = value[field];
  return typeof item === "string" ? item : "";
}

function optionalStringField(value: Record<string, unknown>, field: string): string | undefined {
  const item = stringField(value, field).trim();
  return item.length > 0 ? item : undefined;
}

function arrayField(value: Record<string, unknown>, field: string): readonly string[] {
  const item = value[field];
  if (Array.isArray(item)) {
    return item.filter((entry): entry is string => typeof entry === "string");
  }
  if (typeof item === "string") {
    return splitList(item);
  }
  return [];
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
  console.log('  dure approve <run-id> --reason "Reviewed the patch proposal"');
  console.log('  dure reject <run-id> --reason "Scope is unclear"');
  console.log('  dure apply <run-id> --workspace ".dure/workspaces/<run-id>"');
  console.log("  dure verify <run-id> --script test --timeout-ms 30000");
  console.log('  dure scope <run-id> --target "api.example.com" --in-scope "api.example.com" --forbidden "DoS,brute force"');
  console.log('  dure evidence <run-id> --asset "api.example.com" --hypothesis "IDOR on order detail" --impact "Potential cross-account read" --scope-note "In scope" --next-action "Confirm with test accounts"');
  console.log("  dure report <run-id> --lead <lead-id> --severity medium");
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
  if (preview.workspaceVerificationRecord) {
    section("Workspace Verification", summarizeWorkspaceVerification(preview.workspaceVerificationRecord));
  }
  section("Next", [preview.metadata.nextRecommendedAction]);
}

function printApproval(record: ApprovalRecord): void {
  console.log("Dure Approval");
  console.log("");
  section("Run", [
    `id: ${record.runId}`,
    `previous status: ${record.previousStatus}`,
    `new status: ${record.nextStatus}`,
    `proposal: ${record.proposalId}`
  ]);
  section("Decision", [
    `decision: ${record.decision}`,
    `decided by: ${record.decidedBy}`,
    `reason: ${record.reason ?? "not provided"}`,
    `created at: ${record.createdAt}`
  ]);
  section("Next", [record.nextRecommendedAction]);
}

function printScope(record: BugBountyScopeRecord): void {
  console.log("Dure Bug Bounty Scope");
  console.log("");
  section("Run", [`id: ${record.runId}`, `target: ${record.target}`]);
  section("Scope", [
    `status: ${record.moochackerAssessment.scopeStatus}`,
    `safety: ${record.moochackerAssessment.safetyLevel}`,
    `in scope: ${formatList(record.inScopeAssets)}`,
    `out of scope: ${formatList(record.outOfScopeAssets)}`,
    `allowed: ${formatList(record.allowedTechniques)}`,
    `forbidden: ${formatList(record.forbiddenTechniques)}`
  ]);
  section("Rules", [
    `rate limits: ${formatList(record.rateLimits)}`,
    `roles: ${formatList(record.testAccountRoles)}`,
    `data handling: ${formatList(record.dataHandlingRules)}`,
    `authorization: ${record.authorizationNote || "not provided"}`,
    `program rules: ${record.programRulesUrl ?? "not provided"}`
  ]);
  section(
    "Moochacker",
    record.moochackerAssessment.clarifyingQuestions.length > 0
      ? record.moochackerAssessment.clarifyingQuestions
      : ["Scope intake is sufficient for passive planning."]
  );
}

function printEvidenceRecord(record: BugBountyEvidenceRecord): void {
  console.log("Dure Evidence");
  console.log("");
  section("Run", [`id: ${record.runId}`, `lead: ${record.id}`]);
  section("Lead", [
    `status: ${record.status}`,
    `confidence: ${record.confidence}`,
    `asset: ${record.asset}`,
    `endpoint: ${record.endpoint ?? "not recorded"}`,
    `method: ${record.method ?? "not recorded"}`,
    `role: ${record.userRole ?? "not recorded"}`
  ]);
  section("Hypothesis", [record.hypothesis]);
  section("Impact", [record.impact]);
  section("Scope", [record.scopeNote]);
  section("Redaction", [
    "applied: yes",
    `redacted fields: ${formatList(record.redactedFields)}`
  ]);
  section("Next", [record.nextAction]);
}

function printEvidenceLedger(preview: RunPreview): void {
  if (preview.proposal.kind !== "bug_bounty_review") {
    throw new Error(`Run ${preview.metadata.id} is not a bug bounty proposal (${preview.proposal.kind}).`);
  }

  const entries = preview.bugBountyEvidenceLedger?.entries ?? [];
  console.log("Dure Evidence Ledger");
  console.log("");
  section("Run", [
    `id: ${preview.metadata.id}`,
    `target: ${preview.bugBountyScope?.target ?? "scope not recorded"}`,
    `entries: ${entries.length}`
  ]);
  section(
    "Leads",
    entries.length > 0
      ? entries.map((entry) => `${entry.id}: ${entry.status}, ${entry.confidence}, ${entry.asset}${entry.endpoint ? ` ${entry.endpoint}` : ""}`)
      : ["not recorded"]
  );
  section("Next", [
    entries.length > 0
      ? "Use evidence status and confidence to decide whether to draft a report or mark the lead as blocked/non-issue."
      : "Record a scoped hypothesis before drafting a finding."
  ]);
}

function printReportDraft(record: BugBountyReportDraftRecord): void {
  console.log("Dure Report Draft");
  console.log("");
  section("Run", [`id: ${record.runId}`, `report: ${record.id}`, `lead: ${record.leadId}`]);
  section("Finding", [
    `title: ${record.title}`,
    `severity: ${record.severity}`,
    `confidence: ${record.confidence}`,
    `duplicate risk: ${record.duplicateRisk ? "yes" : "no"}`,
    `asset: ${record.affectedAsset}`,
    `endpoint: ${record.affectedEndpoint ?? "not recorded"}`
  ]);
  section("Severity", [record.severityRationale]);
  section("Export", [`markdown: ${record.markdownPath}`]);
  section("Next", [record.nextRecommendedAction]);
}

function printReportDrafts(preview: RunPreview): void {
  if (preview.proposal.kind !== "bug_bounty_review") {
    throw new Error(`Run ${preview.metadata.id} is not a bug bounty proposal (${preview.proposal.kind}).`);
  }

  const reports = preview.bugBountyReportDrafts ?? [];
  console.log("Dure Report Drafts");
  console.log("");
  section("Run", [
    `id: ${preview.metadata.id}`,
    `target: ${preview.bugBountyScope?.target ?? "scope not recorded"}`,
    `reports: ${reports.length}`
  ]);
  section(
    "Drafts",
    reports.length > 0
      ? reports.map((report) => `${report.id}: ${report.severity}, ${report.confidence}, ${report.title}`)
      : ["not recorded"]
  );
  section("Next", [
    reports.length > 0
      ? "Review markdown drafts before submission and confirm severity against the program policy."
      : "Draft a report from a scoped evidence lead."
  ]);
}

function printApply(record: ApplyRecord): void {
  console.log("Dure Apply");
  console.log("");
  section("Run", [
    `id: ${record.runId}`,
    `previous status: ${record.previousStatus}`,
    `new status: ${record.nextStatus}`,
    `proposal: ${record.proposalId}`
  ]);
  section("Workspace", [`root: ${record.workspaceRoot}`]);
  section(
    "Changes",
    record.files.map((file) => `${file.operation}: ${file.path}`)
  );
  section("Rollback", [
    "metadata: apply.json and rollback.json",
    `backups: ${record.backupRoot}`
  ]);
  section("Next", [record.nextRecommendedAction]);
}

function printWorkspaceVerification(record: WorkspaceVerificationRecord): void {
  console.log("Dure Verification");
  console.log("");
  section("Run", [
    `id: ${record.runId}`,
    `previous status: ${record.previousStatus}`,
    `new status: ${record.nextStatus}`,
    `proposal: ${record.proposalId}`,
    `accepted: ${record.accepted ? "yes" : "no"}`
  ]);
  section("Workspace", [`root: ${record.workspaceRoot}`, `package manager: ${record.packageManager}`]);
  section(
    "Commands",
    record.commands.map((command) => {
      const exit = command.exitCode === undefined ? "exit n/a" : `exit ${command.exitCode}`;
      return `${command.name}: ${command.status} (${exit}, ${command.durationMs}ms)`;
    })
  );
  section(
    "Local Checks",
    record.localChecks.map((check) => `${check.name}: ${check.passed ? "pass" : "fail"} (${check.mocked ? "mocked" : "local"}) - ${check.summary}`)
  );
  section("Next", [record.nextRecommendedAction]);
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

function summarizeWorkspaceVerification(result: WorkspaceVerificationRecord): readonly string[] {
  return [
    `accepted: ${result.accepted ? "yes" : "no"}`,
    `status: ${result.previousStatus} -> ${result.nextStatus}`,
    ...result.commands.map((command) => `${command.name}: ${command.status}`)
  ];
}

function summarizeCheckGroup(checks: readonly VerificationCheck[]): string {
  if (checks.length === 0) {
    return "none";
  }

  return checks.map((check) => `${check.name} ${check.passed ? "pass" : "fail"}`).join(", ");
}

function formatList(values: readonly string[]): string {
  return values.length > 0 ? values.join(", ") : "none";
}
