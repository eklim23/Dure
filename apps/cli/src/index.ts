#!/usr/bin/env node
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
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
  ConsoleRunSnapshot,
  DevelopmentProjectState,
  PatchChangePlan,
  PatchProposal,
  PatchPreview,
  PatchRiskAssessment,
  RiskLevel,
  RunExportRecord,
  RunListItem,
  RunPreview,
  SafetyDecision,
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

  if (parsed.command === "runs") {
    const runs = new RunStore().listRuns({ limit: parsed.limit });
    printRuns(runs);
    process.exit(0);
  }

  if (parsed.command === "show") {
    if (!parsed.runId) {
      throw new Error("show requires a run id.");
    }
    const preview = new RunStore().loadPreview(parsed.runId);
    printRunShow(preview);
    process.exit(0);
  }

  if (parsed.command === "export") {
    if (!parsed.runId) {
      throw new Error("export requires a run id.");
    }
    const record = new RunStore().exportRun(parsed.runId);
    printRunExport(record);
    process.exit(0);
  }

  if (parsed.command === "console-data") {
    if (!parsed.runId) {
      throw new Error("console-data requires a run id.");
    }
    const snapshot = new RunStore().createConsoleSnapshot(parsed.runId);
    printConsoleData(snapshot, parsed.consoleDataOutput);
    process.exit(0);
  }

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
  readonly command?:
    | "run"
    | "ask"
    | "runs"
    | "show"
    | "export"
    | "console-data"
    | "preview"
    | "approve"
    | "reject"
    | "scope"
    | "apply"
    | "verify"
    | "evidence"
    | "report";
  readonly request?: string;
  readonly previewRunId?: string;
  readonly runId?: string;
  readonly limit?: number;
  readonly reason?: string;
  readonly consoleDataOutput?: string;
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

  if (commandOrRequest === "runs") {
    rejectRunCommandGlobalOptions("runs", modeOverride, persist);
    return parseRunsCommand(rest, persist);
  }

  if (commandOrRequest === "show" || commandOrRequest === "export") {
    rejectRunCommandGlobalOptions(commandOrRequest, modeOverride, persist);
    if (rest.length !== 1 || rest[0].trim().length === 0) {
      throw new Error(`${commandOrRequest} requires exactly one run id.`);
    }
    return { command: commandOrRequest, runId: rest[0], persist };
  }

  if (commandOrRequest === "console-data") {
    rejectRunCommandGlobalOptions("console-data", modeOverride, persist);
    return parseConsoleDataCommand(rest, persist);
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

function parseRunsCommand(tokens: readonly string[], persist: boolean): ParsedArgs {
  const options = parseCommandOptions(tokens, ["limit"]);
  const limitValue = firstOption(options, "limit");
  let limit: number | undefined;
  if (limitValue !== undefined) {
    const parsedLimit = Number.parseInt(limitValue, 10);
    if (!Number.isInteger(parsedLimit) || parsedLimit <= 0) {
      throw new Error("--limit requires a positive integer value.");
    }
    limit = parsedLimit;
  }
  return { command: "runs", limit, persist };
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

function parseConsoleDataCommand(tokens: readonly string[], persist: boolean): ParsedArgs {
  const [runId, ...rest] = tokens;
  if (!runId || runId.trim().length === 0) {
    throw new Error("console-data requires exactly one run id.");
  }

  const options = parseCommandOptions(rest, ["output"]);
  return {
    command: "console-data",
    runId,
    consoleDataOutput: firstOption(options, "output"),
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
  console.log("  dure runs --limit 10");
  console.log("  dure show <run-id>");
  console.log("  dure export <run-id>");
  console.log("  dure console-data <run-id> --output .dure/runs/<run-id>/console-data.json");
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
  }
  if (result.developmentProjectState) {
    section("Development Project State", summarizeDevelopmentProjectState(result.developmentProjectState));
  }
  section("Safety Result", summarizeSafetyDecision(result.safetyDecision));

  section("Next Recommended Action", [result.nextRecommendedAction]);
}

function summarizeSafetyDecision(decision: SafetyDecision): readonly string[] {
  const policy = decision.policyEvaluation;
  return [
    `allowed: ${decision.allowed ? "yes" : "no"}`,
    `requires approval: ${decision.requiresApproval ? "yes" : "no"}`,
    decision.summary,
    ...(policy
      ? [
          `policy violations: ${policy.violations.length}`,
          `blocked capabilities: ${formatList(decision.blockedCapabilities)}`
        ]
      : []),
    ...decision.details
  ];
}

function printRuns(runs: readonly RunListItem[]): void {
  console.log("Dure Runs");
  console.log("");
  section("Summary", [`runs: ${runs.length}`]);
  section(
    "Runs",
    runs.length > 0
      ? runs.map((run) => `${run.id}: ${run.status}, ${run.selectedMode}, ${run.proposalKind}, ${shortText(run.input, 72)}`)
      : ["not recorded"]
  );
  section("Next", [runs.length > 0 ? "Use `dure show <run-id>` for full run context." : "Run a natural language request to create the first record."]);
}

function printRunShow(preview: RunPreview): void {
  console.log("Dure Run");
  console.log("");
  section("Run", [
    `id: ${preview.metadata.id}`,
    `status: ${preview.metadata.status}`,
    `mode: ${preview.metadata.selectedMode}`,
    `proposal: ${preview.metadata.proposalId} (${preview.metadata.proposalKind})`,
    `created: ${preview.metadata.createdAt}`,
    `updated: ${preview.metadata.updatedAt}`
  ]);
  section("Request", [preview.request.originalInput]);
  section("Proposal", summarizeProposal(preview.proposal));
  if (preview.developmentProjectState) {
    section("Development Project State", summarizeDevelopmentProjectState(preview.developmentProjectState));
  }
  section("Safety", summarizeSafetyDecision(preview.safetyDecision));
  section("Artifacts", summarizeArtifacts(preview));
  section("Decision Log", [
    `entries: ${preview.decisionLog.entries.length}`,
    ...(preview.decisionLog.entries.at(-1) ? [`latest: ${preview.decisionLog.entries.at(-1)?.type}`] : [])
  ]);
  section("Next", [preview.metadata.nextRecommendedAction]);
}

function printRunExport(record: RunExportRecord): void {
  console.log("Dure Export");
  console.log("");
  section("Run", [`id: ${record.runId}`, `format: ${record.format}`]);
  section("Artifact", [`path: ${record.outputPath}`]);
  section("Summary", [record.summary]);
  section("Next", [record.nextRecommendedAction]);
}

function printConsoleData(snapshot: ConsoleRunSnapshot, outputPath?: string): void {
  const content = `${JSON.stringify(snapshot, null, 2)}\n`;
  if (!outputPath) {
    process.stdout.write(content);
    return;
  }

  const resolvedOutputPath = path.resolve(outputPath);
  mkdirSync(path.dirname(resolvedOutputPath), { recursive: true });
  writeFileSync(resolvedOutputPath, content, "utf8");

  console.log("Dure Console Data");
  console.log("");
  section("Snapshot", [
    `run: ${snapshot.run.id}`,
    `mode: ${snapshot.run.selectedMode}`,
    `output: ${resolvedOutputPath}`,
    `read-only: ${snapshot.source.readOnly ? "yes" : "no"}`,
    `redacted: ${snapshot.source.redacted ? "yes" : "no"}`
  ]);
  section("Next", ["Open apps/ui/index.html and import this JSON file from the Run Snapshot panel."]);
}

function printRunPreview(preview: RunPreview): void {
  if (preview.proposal.kind !== "patch") {
    throw new Error(`Run ${preview.metadata.id} is not a development patch proposal (${preview.proposal.kind}).`);
  }

  const proposal = preview.proposal;
  const patchPreview = getPatchPreview(proposal);
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
  section("Summary", [
    patchPreview.summary,
    ...(preview.developmentProjectState
      ? [`project context: ${preview.developmentProjectState.packageManager}, estimated stage ${preview.developmentProjectState.currentMvpStage.stage.id} - ${preview.developmentProjectState.currentMvpStage.stage.name}`]
      : [])
  ]);
  section("Patch Risk", summarizePatchRisk(patchPreview.riskAssessment));
  section("File-Level Change Plan", summarizeChangePlan(patchPreview.changePlan));
  section(
    "Changes",
    proposal.changes.map((change) => `${change.operation}: ${change.path} - ${change.rationale}`)
  );
  blockSection("Unified Diff", patchPreview.unifiedDiff);
  section("Verification", summarizePreviewVerification(preview.verificationResult));
  if (preview.workspaceVerificationRecord) {
    section("Workspace Verification", summarizeWorkspaceVerification(preview.workspaceVerificationRecord));
  }
  section("Next", [preview.metadata.nextRecommendedAction]);
}

function summarizeArtifacts(preview: RunPreview): readonly string[] {
  const lines = [
    `run dir: ${preview.artifactPaths.runDir}`,
    `decision log: ${preview.artifactPaths.decisionLog}`,
    `scope: ${preview.bugBountyScope ? "recorded" : "not recorded"}`,
    `evidence leads: ${preview.bugBountyEvidenceLedger?.entries.length ?? 0}`,
    `report drafts: ${preview.bugBountyReportDrafts?.length ?? 0}`,
    `approval: ${preview.approvalRecord ? preview.approvalRecord.decision : "not recorded"}`,
    `apply: ${preview.applyRecord ? "recorded" : "not recorded"}`,
    `workspace verification: ${preview.workspaceVerificationRecord ? preview.workspaceVerificationRecord.nextStatus : "not recorded"}`
  ];
  lines.push(`project state: ${preview.developmentProjectState ? "recorded" : "not recorded"}`);
  if (preview.artifactPaths.export) {
    lines.push(`export: ${preview.artifactPaths.export}`);
  }
  return lines;
}

function summarizeDevelopmentProjectState(state: DevelopmentProjectState): readonly string[] {
  const configuredScripts = state.scripts
    .filter((script) => script.configured)
    .map((script) => script.name);
  const missingScripts = state.scripts
    .filter((script) => !script.configured)
    .map((script) => script.name);

  return [
    `package manager: ${state.packageManager}`,
    `languages: ${state.languages.map((item) => `${item.language}(${item.files})`).join(", ") || "unknown"}`,
    `frameworks: ${state.frameworks.join(", ")}`,
    `configured scripts: ${configuredScripts.join(", ") || "none"}`,
    `missing scripts: ${missingScripts.join(", ") || "none"}`,
    `estimated MVP stage: ${state.currentMvpStage.stage.id} - ${state.currentMvpStage.stage.name}`,
    `stage confidence: ${state.currentMvpStage.confidence.toFixed(2)}`,
    `files indexed: ${state.fileIndex.totalFiles}`
  ];
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

function blockSection(title: string, content: string): void {
  console.log(`${title}:`);
  for (const line of content.split("\n")) {
    console.log(`  ${line}`);
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
  const patchPreview = getPatchPreview(proposal);
  return [
    `status: ${proposal.status}`,
    `preview risk: ${patchPreview.riskAssessment.overallRisk}`,
    `separate approval: ${patchPreview.riskAssessment.separateApprovalRequired ? "yes" : "no"}`,
    ...proposal.changes.map((change) => `${change.operation}: ${change.path} - ${change.rationale}`)
  ];
}

function summarizePatchRisk(risk: PatchRiskAssessment): readonly string[] {
  return [
    `overall risk: ${risk.overallRisk}`,
    `approval required: ${risk.approvalRequired ? "yes" : "no"}`,
    `separate approval required: ${risk.separateApprovalRequired ? "yes" : "no"}`,
    ...risk.reasons.map((reason) => `reason: ${reason}`)
  ];
}

function summarizeChangePlan(changePlan: readonly PatchChangePlan[]): readonly string[] {
  return changePlan.map((change) =>
    `${change.operation}: ${change.path} [${change.riskLevel}] - ${change.purpose}; impact: ${change.expectedImpact}; review: ${change.reviewFocus.join(" | ")}`
  );
}

function getPatchPreview(proposal: PatchProposal): PatchPreview {
  return proposal.preview ?? buildFallbackPatchPreview(proposal);
}

function buildFallbackPatchPreview(proposal: PatchProposal): PatchPreview {
  const changePlan = proposal.changes.map((change): PatchChangePlan => {
    const riskLevel = riskForPatchChange(change.path, change.operation);
    const requiresSeparateApproval = change.operation === "delete" || isSensitivePatchPath(change.path);
    return {
      path: change.path,
      operation: change.operation,
      purpose: change.rationale,
      expectedImpact: expectedPatchImpact(change.path, change.operation),
      riskLevel,
      requiresApproval: true,
      requiresSeparateApproval,
      reviewFocus: [
        "Confirm the path is inside the controlled workspace.",
        "Confirm the change matches the selected MVP stage.",
        change.content === undefined ? "Confirm no generated content is required for this operation." : "Review generated content before apply.",
        requiresSeparateApproval ? "Separate approval is required before apply." : "Normal patch approval is sufficient."
      ]
    };
  });
  const riskAssessment = assessFallbackPatchRisk(proposal.riskLevel, changePlan);

  return {
    summary: `${proposal.summary} Review ${proposal.changes.length} planned file change${proposal.changes.length === 1 ? "" : "s"} before approval.`,
    changePlan,
    riskAssessment,
    unifiedDiff: proposal.changes.map(diffForPatchChange).join("\n"),
    generatedAt: proposal.createdAt
  };
}

function assessFallbackPatchRisk(
  proposalRisk: RiskLevel,
  changePlan: readonly PatchChangePlan[]
): PatchRiskAssessment {
  const highestFileRisk = maxRisk([proposalRisk, ...changePlan.map((change) => change.riskLevel)]);
  const separateApprovalRequired = changePlan.some((change) => change.requiresSeparateApproval);
  return {
    overallRisk: highestFileRisk,
    approvalRequired: true,
    separateApprovalRequired,
    reasons: [
      `proposal risk: ${proposalRisk}`,
      `highest file risk: ${highestFileRisk}`,
      separateApprovalRequired
        ? "one or more changes touch deletion or sensitive paths"
        : "all changes can use the normal patch approval gate"
    ]
  };
}

function riskForPatchChange(filePath: string, operation: PatchChangePlan["operation"]): RiskLevel {
  if (operation === "delete" || isSensitivePatchPath(filePath)) {
    return "high";
  }
  if (operation === "modify" || isPatchManifestPath(filePath)) {
    return "medium";
  }
  return "low";
}

function expectedPatchImpact(filePath: string, operation: PatchChangePlan["operation"]): string {
  switch (operation) {
    case "create":
      return `Creates ${filePath} as new project surface.`;
    case "modify":
      return `Updates existing behavior or configuration in ${filePath}.`;
    case "delete":
      return `Removes ${filePath}; this requires separate approval in v0.1.`;
  }
}

function diffForPatchChange(change: PatchProposal["changes"][number]): string {
  const target = change.path.replace(/\\/g, "/");
  const contentLines = splitDiffLines(change.content ?? "");
  if (change.operation === "create") {
    return [
      `diff --git a/${target} b/${target}`,
      "new file mode 100644",
      "--- /dev/null",
      `+++ b/${target}`,
      `@@ -0,0 +1,${Math.max(contentLines.length, 1)} @@`,
      ...contentLines.map((line) => `+${line}`)
    ].join("\n");
  }
  if (change.operation === "delete") {
    return [
      `diff --git a/${target} b/${target}`,
      "deleted file mode 100644",
      `--- a/${target}`,
      "+++ /dev/null",
      "@@ -1 +0,0 @@",
      "-[existing file content not captured in proposal preview]"
    ].join("\n");
  }
  return [
    `diff --git a/${target} b/${target}`,
    `--- a/${target}`,
    `+++ b/${target}`,
    `@@ -1 +1,${Math.max(contentLines.length, 1)} @@`,
    "-[existing file content not captured in proposal preview]",
    ...contentLines.map((line) => `+${line}`)
  ].join("\n");
}

function splitDiffLines(content: string): readonly string[] {
  const normalized = content.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const withoutTrailingNewline = normalized.endsWith("\n") ? normalized.slice(0, -1) : normalized;
  return withoutTrailingNewline.length > 0 ? withoutTrailingNewline.split("\n") : [""];
}

function isSensitivePatchPath(filePath: string): boolean {
  const normalized = filePath.toLowerCase();
  return [".env", "auth", "authentication", "authorization", "credential", "secret", "security", "token"]
    .some((signal) => normalized.includes(signal));
}

function isPatchManifestPath(filePath: string): boolean {
  const normalized = filePath.toLowerCase();
  return normalized.endsWith("package.json")
    || normalized.endsWith("pnpm-lock.yaml")
    || normalized.endsWith("package-lock.json")
    || normalized.endsWith("yarn.lock")
    || normalized.endsWith("bun.lock")
    || normalized.endsWith("bun.lockb")
    || normalized.endsWith("tsconfig.json");
}

function maxRisk(values: readonly RiskLevel[]): RiskLevel {
  if (values.includes("high")) {
    return "high";
  }
  if (values.includes("medium")) {
    return "medium";
  }
  return "low";
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

function shortText(value: string, maxLength: number): string {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) {
    return normalized;
  }
  return `${normalized.slice(0, Math.max(0, maxLength - 3))}...`;
}
