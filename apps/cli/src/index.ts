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
  BugBountyTargetEndpointInput,
  BugBountyTargetMapFileFlow,
  BugBountyTargetMapInput,
  BugBountyTargetMapRecord,
  BugBountyTargetMapRoleAccess,
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

  if (parsed.command === "help") {
    printHelp(parsed.helpTopic);
    process.exit(0);
  }

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
    const approval = new RunStore().approveRun(parsed.runId, {
      reason: parsed.reason,
      confirmRisk: parsed.confirmRisk
    });
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

  if (parsed.command === "target-map") {
    if (!parsed.runId) {
      throw new Error("target-map requires a run id.");
    }
    const store = new RunStore();
    if (parsed.listTargetMap) {
      printTargetMapPreview(store.loadPreview(parsed.runId));
    } else if (parsed.bugBountyTargetMapInput) {
      const targetMap = store.attachBugBountyTargetMap(parsed.runId, { targetMap: parsed.bugBountyTargetMapInput });
      printTargetMap(targetMap);
    } else {
      throw new Error("target-map requires fields to record a map, or no options to show the recorded map.");
    }
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
    | "help"
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
    | "target-map"
    | "apply"
    | "verify"
    | "evidence"
    | "report";
  readonly request?: string;
  readonly previewRunId?: string;
  readonly runId?: string;
  readonly limit?: number;
  readonly reason?: string;
  readonly confirmRisk?: RiskLevel;
  readonly consoleDataOutput?: string;
  readonly workspaceRoot?: string;
  readonly verificationScripts?: readonly WorkspaceVerificationScriptName[];
  readonly timeoutMs?: number;
  readonly scopeIntake?: BugBountyScopeIntake;
  readonly bugBountyTargetMapInput?: BugBountyTargetMapInput;
  readonly listTargetMap?: boolean;
  readonly bugBountyEvidenceInput?: BugBountyEvidenceInput;
  readonly listEvidence?: boolean;
  readonly bugBountyReportDraftInput?: BugBountyReportDraftInput;
  readonly listReports?: boolean;
  readonly helpTopic?: string;
  readonly modeOverride?: TaskMode;
  readonly persist: boolean;
}

function parseArgs(tokens: readonly string[]): ParsedArgs {
  if (tokens[0] === "help") {
    return { command: "help", helpTopic: tokens[1], persist: true };
  }
  if (tokens[0] === "--help" || tokens[0] === "-h") {
    return { command: "help", helpTopic: tokens[1], persist: true };
  }
  const helpIndex = tokens.findIndex((token) => token === "--help" || token === "-h");
  if (helpIndex > 0) {
    return { command: "help", helpTopic: tokens[0], persist: true };
  }

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

  if (commandOrRequest === "target-map") {
    rejectRunCommandGlobalOptions("target-map", modeOverride, persist);
    return parseTargetMapCommand(rest, persist);
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

  const options = parseCommandOptions(rest, command === "approve" ? ["reason", "confirm-risk"] : ["reason"]);
  const confirmRisk = firstOption(options, "confirm-risk");
  return {
    command,
    runId,
    reason: firstOption(options, "reason"),
    confirmRisk: confirmRisk ? parseRiskLevel(confirmRisk) : undefined,
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

function parseTargetMapCommand(tokens: readonly string[], persist: boolean): ParsedArgs {
  const [runId, ...rest] = tokens;
  if (!runId || runId.trim().length === 0) {
    throw new Error("target-map requires exactly one run id.");
  }
  if (rest.length === 0) {
    return { command: "target-map", runId, listTargetMap: true, persist };
  }

  const options = parseCommandOptions(rest, [
    "host",
    "app",
    "api-base",
    "auth-state",
    "role-access",
    "endpoint",
    "file-flow",
    "redirect",
    "third-party",
    "artifact",
    "notes"
  ]);
  const targetMap: BugBountyTargetMapInput = {
    hosts: listOptions(options, "host"),
    applications: listOptions(options, "app"),
    apiBases: listOptions(options, "api-base"),
    authStates: listOptions(options, "auth-state"),
    roleAccess: (options.get("role-access") ?? []).map(parseTargetMapRoleAccess),
    endpoints: (options.get("endpoint") ?? []).map(parseTargetEndpoint),
    fileFlows: listOptions(options, "file-flow"),
    redirects: listOptions(options, "redirect"),
    thirdPartyIntegrations: listOptions(options, "third-party"),
    sourceArtifacts: listOptions(options, "artifact"),
    notes: firstOption(options, "notes")
  };

  return {
    command: "target-map",
    runId,
    bugBountyTargetMapInput: targetMap,
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

function parseTargetMapRoleAccess(value: string): BugBountyTargetMapRoleAccess {
  const [role = "", authState = "unknown", canAccess = "", cannotAccess = "", notes] = pipeParts(value);
  return {
    role,
    authState,
    canAccess: splitList(canAccess),
    cannotAccess: splitList(cannotAccess),
    notes: optionalSegment(notes)
  };
}

function parseTargetEndpoint(value: string): BugBountyTargetEndpointInput {
  const parts = pipeParts(value);
  if (parts.length === 1) {
    return {
      path: parts[0],
      parameters: [],
      roles: [],
      stateChanging: false,
      fileFlow: "none",
      redirects: [],
      thirdPartyIntegrations: []
    };
  }

  const [
    methodValue = "",
    host = "",
    endpointPath = "",
    authState = "",
    roles = "",
    stateChanging = "",
    fileFlow = "",
    parameters = "",
    redirects = "",
    thirdParty = "",
    notes
  ] = parts;
  return {
    method: methodValue ? parseHttpMethod(methodValue) : undefined,
    host: optionalSegment(host),
    path: endpointPath,
    parameters: splitList(parameters),
    authState: optionalSegment(authState),
    roles: splitList(roles),
    stateChanging: stateChanging ? parseBoolean(stateChanging, "endpoint state-changing") : false,
    fileFlow: parseTargetMapFileFlow(fileFlow),
    redirects: splitList(redirects),
    thirdPartyIntegrations: splitList(thirdParty),
    notes: optionalSegment(notes)
  };
}

function pipeParts(value: string): readonly string[] {
  return value.split("|").map((part) => part.trim());
}

function optionalSegment(value: string | undefined): string | undefined {
  return value && value.trim().length > 0 ? value.trim() : undefined;
}

function parseTargetMapFileFlow(value: string | undefined): BugBountyTargetMapFileFlow {
  const normalized = (value ?? "none").trim().toLowerCase().replace(/-/g, "_");
  if (normalized === "" || normalized === "none") {
    return "none";
  }
  if (normalized === "upload" || normalized === "download" || normalized === "upload_download") {
    return normalized;
  }
  if (normalized === "both") {
    return "upload_download";
  }
  throw new Error(`Unsupported target map file flow: ${value}.`);
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

function parseRiskLevel(value: string): RiskLevel {
  if (value === "low" || value === "medium" || value === "high") {
    return value;
  }

  throw new Error(`Unknown risk level: ${value}`);
}

function printHelp(topic?: string): void {
  const normalizedTopic = topic?.trim().toLowerCase();
  if (!normalizedTopic) {
    printUsage();
    return;
  }

  const help = commandHelp(normalizedTopic);
  if (!help) {
    throw new Error(`Unknown help topic: ${topic}. Use \`dure help\` to list commands.`);
  }

  console.log(`Dure Help: ${help.name}`);
  console.log("");
  section("Purpose", [help.purpose]);
  section("Usage", help.usage);
  if (help.options.length > 0) {
    section("Key Options", help.options);
  }
  section("Safety", help.safety);
  section("Next", help.next);
}

function printUsage(): void {
  console.log("Dure CLI Help");
  console.log("");
  section("Natural Language", [
    'dure "Create a simple login-enabled bulletin board"',
    'dure --mode development "Create a small CLI app"',
    'dure --mode bug-bounty "Prepare an authorized bug bounty scope and evidence plan"',
    'dure --no-persist "Temporary dry conversation"'
  ]);
  section("Run Inspection", [
    "dure runs --limit 10",
    "dure show <run-id>",
    "dure export <run-id>",
    "dure console-data <run-id> --output .dure/runs/<run-id>/console-data.json"
  ]);
  section("Development Workflow", [
    "dure preview <run-id>",
    'dure approve <run-id> --confirm-risk medium --reason "Reviewed the patch proposal"',
    'dure reject <run-id> --reason "Scope is unclear"',
    'dure apply <run-id> --workspace ".dure/workspaces/<run-id>"',
    "dure verify <run-id> --script test --timeout-ms 30000"
  ]);
  section("Bug Bounty Workflow", [
    'dure scope <run-id> --target "api.example.com" --in-scope "api.example.com" --forbidden "DoS,brute force"',
    'dure target-map <run-id> --host "api.example.com" --api-base "https://api.example.com/v1" --endpoint "GET|api.example.com|/v1/orders|authenticated|user|false|none"',
    'dure evidence <run-id> --asset "api.example.com" --hypothesis "IDOR on order detail" --impact "Potential cross-account read" --scope-note "In scope" --next-action "Confirm with owned test accounts"',
    "dure report <run-id> --lead <lead-id> --severity medium"
  ]);
  section("More Help", [
    "dure help run",
    "dure help preview",
    "dure help target-map",
    "dure help evidence",
    "dure help report"
  ]);
}

interface CommandHelp {
  readonly name: string;
  readonly purpose: string;
  readonly usage: readonly string[];
  readonly options: readonly string[];
  readonly safety: readonly string[];
  readonly next: readonly string[];
}

function commandHelp(topic: string): CommandHelp | undefined {
  const normalized = topic === "bug-bounty" ? "bug_bounty" : topic;
  const help: Record<string, CommandHelp> = {
    run: {
      name: "run",
      purpose: "Create a persisted Dure run from a natural language request.",
      usage: ['dure run "Create a simple login-enabled bulletin board"', 'dure "Create a simple login-enabled bulletin board"'],
      options: ["--mode development", "--mode bug-bounty", "--no-persist"],
      safety: ["Creates proposals and run records; it does not apply files, run commands, scan targets, or contact external services."],
      next: ["Use `dure show <run-id>` to inspect the run."]
    },
    ask: {
      name: "ask",
      purpose: "Use Dure as an assistant-first planning command while still preserving mode routing.",
      usage: ['dure ask "Draft a README for this project"'],
      options: ["--mode <mode>", "--no-persist"],
      safety: ["No slash commands are required; natural language is routed through Dure's intent model."],
      next: ["Use `dure runs --limit 10` to find persisted runs."]
    },
    development: {
      name: "--mode development",
      purpose: "Force Development Mode for MVP-first code planning and controlled patch proposals.",
      usage: ['dure --mode development "Create a small CLI app"'],
      options: ["--no-persist"],
      safety: ["Development Mode can propose patches, but approval/apply/verify are separate commands."],
      next: ["Use `dure preview <run-id>` before approval."]
    },
    bug_bounty: {
      name: "--mode bug-bounty",
      purpose: "Force Bug Bounty Mode for authorized, passive security review planning.",
      usage: ['dure --mode bug-bounty "Prepare an authorized bug bounty scope and evidence plan"'],
      options: ["--no-persist"],
      safety: ["Bug Bounty Mode in v0.1 records scope, target maps, evidence notes, and report drafts only from user-supplied data."],
      next: ["Use `dure scope <run-id>` before target maps, evidence, or reports."]
    },
    runs: {
      name: "runs",
      purpose: "List recent persisted run records.",
      usage: ["dure runs", "dure runs --limit 10"],
      options: ["--limit <positive integer>"],
      safety: ["Read-only; does not modify run artifacts."],
      next: ["Use `dure show <run-id>` for the next command suggestion."]
    },
    show: {
      name: "show",
      purpose: "Show mode-neutral run context, artifacts, decision log count, and suggested next commands.",
      usage: ["dure show <run-id>"],
      options: [],
      safety: ["Read-only; does not approve, apply, verify, scan, or contact targets."],
      next: ["Follow the `Suggested Commands` section."]
    },
    preview: {
      name: "preview",
      purpose: "Inspect a development patch proposal before approval.",
      usage: ["dure preview <run-id>"],
      options: [],
      safety: ["Read-only; prints proposal metadata and unified diff without applying files."],
      next: ["If acceptable, use `dure approve <run-id> --confirm-risk <level>`."]
    },
    approve: {
      name: "approve",
      purpose: "Record user approval for a verified patch proposal.",
      usage: ['dure approve <run-id> --confirm-risk medium --reason "Reviewed the patch proposal"'],
      options: ["--confirm-risk low|medium|high", "--reason <text>"],
      safety: ["Approval records policy metadata only; it does not apply files or run commands."],
      next: ["Use `dure apply <run-id>` after approval."]
    },
    reject: {
      name: "reject",
      purpose: "Record user rejection for a proposal.",
      usage: ['dure reject <run-id> --reason "Needs a narrower scope"'],
      options: ["--reason <text>"],
      safety: ["Records the decision and leaves artifacts untouched."],
      next: ["Create a new run with clarified requirements."]
    },
    apply: {
      name: "apply",
      purpose: "Apply an approved patch into a controlled workspace.",
      usage: ["dure apply <run-id>", 'dure apply <run-id> --workspace ".dure/workspaces/<run-id>"'],
      options: ["--workspace <path>"],
      safety: ["Allows create/modify only, blocks deletes and unsafe paths, and records rollback metadata."],
      next: ["Use `dure verify <run-id> --script test`."]
    },
    verify: {
      name: "verify",
      purpose: "Run allow-listed package scripts against the applied workspace.",
      usage: ["dure verify <run-id>", "dure verify <run-id> --script test --timeout-ms 30000"],
      options: ["--workspace <path>", "--script test|lint|typecheck", "--timeout-ms <positive integer>"],
      safety: ["Runs only allow-listed scripts, blocks lifecycle hooks, and redacts secret-like output."],
      next: ["If accepted, use `dure export <run-id>`."]
    },
    scope: {
      name: "scope",
      purpose: "Record authorized bug bounty scope and rules of engagement.",
      usage: ['dure scope <run-id> --target "api.example.com" --in-scope "api.example.com" --out-of-scope "admin.example.com"'],
      options: ["--scope-file <json>", "--target", "--in-scope", "--out-of-scope", "--allowed", "--forbidden", "--rate-limit", "--roles", "--data", "--authorization-note", "--program-rules-url"],
      safety: ["Record-only; Dure does not contact targets, discover assets, or run tests."],
      next: ["Use `dure target-map <run-id>` with user-supplied artifacts."]
    },
    "target-map": {
      name: "target-map",
      purpose: "Record or show a passive bug bounty target map.",
      usage: ["dure target-map <run-id>", 'dure target-map <run-id> --host "api.example.com" --endpoint "GET|api.example.com|/v1/orders|authenticated|user|false|none"'],
      options: ["--host", "--app", "--api-base", "--auth-state", "--role-access role|auth|can|cannot|notes", "--endpoint method|host|path|auth|roles|state-changing|file-flow|parameters|redirects|third-party|notes", "--file-flow", "--redirect", "--third-party", "--artifact", "--notes"],
      safety: ["Record-only from user-supplied artifacts; out-of-scope references block normal evidence and reports."],
      next: ["Use `dure evidence <run-id>` after scope and target-map safety pass."]
    },
    evidence: {
      name: "evidence",
      purpose: "Record or list bug bounty evidence ledger entries.",
      usage: ["dure evidence <run-id>", 'dure evidence <run-id> --asset "api.example.com" --hypothesis "Possible authorization issue" --impact "Potential cross-account read" --scope-note "In scope" --next-action "Confirm with owned test accounts"'],
      options: ["--status hypothesis|testing|confirmed|duplicate-risk|non-issue|blocked", "--asset", "--endpoint", "--method", "--auth-state", "--role", "--hypothesis", "--request", "--response", "--impact", "--confidence low|medium|high", "--scope-note", "--next-action"],
      safety: ["User-supplied ledger only; Dure redacts secrets and does not validate, reproduce, scan, or contact targets."],
      next: ["Use `dure report <run-id> --lead <lead-id>` for reportable leads."]
    },
    report: {
      name: "report",
      purpose: "Draft or list bug bounty report drafts from stored evidence.",
      usage: ["dure report <run-id>", "dure report <run-id> --lead <lead-id> --severity medium"],
      options: ["--lead", "--title", "--severity informational|low|medium|high|critical", "--roles", "--step", "--remediation", "--limitations", "--duplicate-risk true|false"],
      safety: ["Drafts from stored evidence only; does not validate findings, submit reports, or contact targets."],
      next: ["Use `dure export <run-id>` after reviewing the draft."]
    },
    export: {
      name: "export",
      purpose: "Write a redacted Markdown audit summary for a run.",
      usage: ["dure export <run-id>"],
      options: [],
      safety: ["Local export only; applies redaction to user-visible fields."],
      next: ["Share or archive the generated Markdown after review."]
    },
    "console-data": {
      name: "console-data",
      purpose: "Emit a redacted read-only JSON snapshot for the static Dure Console prototype.",
      usage: ["dure console-data <run-id>", "dure console-data <run-id> --output .dure/runs/<run-id>/console-data.json"],
      options: ["--output <path>"],
      safety: ["Read-only snapshot; the UI prototype does not execute tools or read run records directly."],
      next: ["Open `apps/ui/index.html` and import the JSON."]
    }
  };

  return help[normalized];
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
  section("Suggested Commands", suggestedCommandsForResult(result));
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
  section("Suggested Commands", runs.length > 0 ? ["dure show <run-id>"] : ['dure "Create a small app"']);
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
  section("Suggested Commands", suggestedCommandsForPreview(preview));
}

function printRunExport(record: RunExportRecord): void {
  console.log("Dure Export");
  console.log("");
  section("Run", [`id: ${record.runId}`, `format: ${record.format}`]);
  section("Artifact", [`path: ${record.outputPath}`]);
  section("Summary", [record.summary]);
  section("Next", [record.nextRecommendedAction]);
  section("Suggested Commands", [`dure show ${record.runId}`]);
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
  section("Suggested Commands", suggestedCommandsForPreview(preview));
}

function summarizeArtifacts(preview: RunPreview): readonly string[] {
  const lines = [
    `run dir: ${preview.artifactPaths.runDir}`,
    `decision log: ${preview.artifactPaths.decisionLog}`,
    `scope: ${preview.bugBountyScope ? "recorded" : "not recorded"}`,
    `target map: ${preview.bugBountyTargetMap ? "recorded" : "not recorded"}`,
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

function suggestedCommandsForResult(result: AssistantRunResult): readonly string[] {
  const runId = result.runRecord?.id;
  if (!runId) {
    return ['dure "Create a small app"'];
  }

  if (result.proposal.kind === "patch") {
    return [`dure preview ${runId}`, `dure show ${runId}`];
  }
  if (result.proposal.kind === "bug_bounty_review") {
    return [`dure scope ${runId} --target "<authorized-target>" --in-scope "<asset>" --authorization-note "<program authorization>"`, `dure show ${runId}`];
  }
  return [`dure show ${runId}`, `dure export ${runId}`];
}

function suggestedCommandsForPreview(preview: RunPreview): readonly string[] {
  const runId = preview.metadata.id;
  if (preview.proposal.kind === "patch") {
    switch (preview.metadata.status) {
      case "proposed":
        return [approvalCommandForPreview(preview), `dure reject ${runId} --reason "Needs changes"`];
      case "approved":
        return [`dure apply ${runId}`];
      case "applied":
        return [`dure verify ${runId} --script test`];
      case "verified":
        return [`dure export ${runId}`];
      case "failed":
        return [`dure show ${runId}`];
      case "rejected":
        return ['dure "Create a revised development request"'];
    }
  }

  if (preview.proposal.kind === "bug_bounty_review") {
    if (!preview.bugBountyScope) {
      return [`dure scope ${runId} --target "<authorized-target>" --in-scope "<asset>" --authorization-note "<program authorization>"`];
    }
    if (preview.bugBountyScope.intakeAssessment.status !== "sufficient") {
      return [`dure show ${runId}`, 'dure --mode bug-bounty "Prepare a clarified authorized scope plan"'];
    }
    if (!preview.bugBountyTargetMap) {
      return [`dure target-map ${runId} --host "${preview.bugBountyScope.target}" --artifact "user supplied notes"`];
    }
    if (preview.bugBountyTargetMap.assessment.safetyLevel === "blocked") {
      return [`dure evidence ${runId} --status blocked --asset "<out-of-scope-reference>" --hypothesis "Out-of-scope reference blocked" --impact "Not tested" --scope-note "Blocked by target-map safety gate" --next-action "Clarify scope"`];
    }
    const reportableLead = firstReportableLead(preview);
    if (!reportableLead) {
      return [`dure evidence ${runId} --asset "${preview.bugBountyScope.target}" --hypothesis "<scoped hypothesis>" --impact "<potential impact>" --scope-note "In scope" --next-action "Review with owned test accounts"`];
    }
    if ((preview.bugBountyReportDrafts?.length ?? 0) === 0) {
      return [`dure report ${runId} --lead ${reportableLead.id} --severity medium`];
    }
    return [`dure export ${runId}`];
  }

  return [`dure export ${runId}`];
}

function approvalCommandForPreview(preview: RunPreview): string {
  if (preview.proposal.kind !== "patch") {
    return `dure approve ${preview.metadata.id}`;
  }

  const risk = getPatchPreview(preview.proposal).riskAssessment.overallRisk;
  return risk === "low"
    ? `dure approve ${preview.metadata.id} --reason "Reviewed preview output"`
    : `dure approve ${preview.metadata.id} --confirm-risk ${risk} --reason "Reviewed preview output"`;
}

function suggestedCommandsForApproval(record: ApprovalRecord): readonly string[] {
  if (record.nextStatus === "approved") {
    return [`dure apply ${record.runId}`];
  }
  return ['dure "Create a revised request with narrower scope"'];
}

function suggestedCommandsForTargetMap(record: BugBountyTargetMapRecord): readonly string[] {
  if (record.assessment.safetyLevel === "blocked") {
    return [`dure evidence ${record.runId} --status blocked --asset "<out-of-scope-reference>" --hypothesis "Out-of-scope reference blocked" --impact "Not tested" --scope-note "Blocked by target-map safety gate" --next-action "Clarify scope"`];
  }
  return [`dure evidence ${record.runId} --asset "${record.scopeTarget}" --hypothesis "<scoped hypothesis>" --impact "<potential impact>" --scope-note "In scope" --next-action "Review with owned test accounts"`];
}

function suggestedCommandsForEvidenceRecord(record: BugBountyEvidenceRecord): readonly string[] {
  if (record.status === "blocked" || record.status === "non-issue") {
    return [`dure evidence ${record.runId}`];
  }
  return [`dure report ${record.runId} --lead ${record.id} --severity medium`];
}

function suggestedCommandsForEvidenceLedger(preview: RunPreview): readonly string[] {
  const reportableLead = firstReportableLead(preview);
  if (reportableLead) {
    return [`dure report ${preview.metadata.id} --lead ${reportableLead.id} --severity medium`];
  }
  return suggestedCommandsForPreview(preview);
}

function suggestedCommandsForReportDrafts(preview: RunPreview): readonly string[] {
  if ((preview.bugBountyReportDrafts?.length ?? 0) > 0) {
    return [`dure export ${preview.metadata.id}`];
  }
  return suggestedCommandsForEvidenceLedger(preview);
}

function firstReportableLead(preview: RunPreview): BugBountyEvidenceRecord | undefined {
  return preview.bugBountyEvidenceLedger?.entries.find((entry) =>
    entry.status !== "blocked" && entry.status !== "non-issue"
  );
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
    `created at: ${record.createdAt}`,
    `expires at: ${record.expiresAt ?? "not set"}`
  ]);
  if (record.policy) {
    section("Approval Policy", [
      `risk: ${record.policy.riskLevel}`,
      `preview risk: ${record.policy.previewRiskLevel ?? "not available"}`,
      `confirmation required: ${record.policy.confirmationRequired ? "yes" : "no"}`,
      `confirmed risk: ${record.policy.providedRiskConfirmation ?? "not provided"}`,
      `separate approval: ${record.policy.separateApprovalRequired ? "yes" : "no"}`
    ]);
    section("Policy Checks", record.policy.checklist.map((check) => `${check.status}: ${check.id} - ${check.summary}`));
    section(
      "Capability Review",
      record.policy.capabilityDecisions.map((decision) =>
        `${decision.capability}: ${decision.requiresApproval ? "approval required" : "passive"}`
      )
    );
  }
  section("Next", [record.nextRecommendedAction]);
  section("Suggested Commands", suggestedCommandsForApproval(record));
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
  section("Intake Assessment", [
    `status: ${record.intakeAssessment.status}`,
    `safety: ${record.intakeAssessment.safetyLevel}`,
    `passive only: ${record.intakeAssessment.passiveOnly ? "yes" : "no"}`,
    `authorization present: ${record.intakeAssessment.authorizationPresent ? "yes" : "no"}`,
    `program rules present: ${record.intakeAssessment.programRulesPresent ? "yes" : "no"}`,
    `missing fields: ${formatList(record.intakeAssessment.missingFields)}`,
    `conflicts: ${formatList(record.intakeAssessment.conflictWarnings)}`,
    `blocked reasons: ${formatList(record.intakeAssessment.blockedReasons)}`,
    `redacted fields: ${formatList(record.intakeAssessment.redactedFields)}`
  ]);
  section(
    "Scope Checks",
    record.intakeAssessment.checks.map((check) => `${check.status}: ${check.id} - ${check.summary}`)
  );
  section(
    "Boundaries",
    record.intakeAssessment.boundaries.map((boundary) =>
      `${boundary.source}: ${boundary.kind} ${boundary.value} -> ${boundary.normalizedValue}`
    )
  );
  section(
    "Moochacker",
    record.moochackerAssessment.clarifyingQuestions.length > 0
      ? record.moochackerAssessment.clarifyingQuestions
      : ["Scope intake is sufficient for passive planning."]
  );
  section("Next Allowed", record.intakeAssessment.nextAllowedActions);
  section("Suggested Commands", [`dure target-map ${record.runId} --host "${record.target}" --artifact "user supplied notes"`]);
}

function printTargetMap(record: BugBountyTargetMapRecord): void {
  console.log("Dure Target Map");
  console.log("");
  section("Run", [`id: ${record.runId}`, `target map: ${record.id}`, `scope target: ${record.scopeTarget}`]);
  section("Inventory", [
    `hosts: ${formatList(record.hosts)}`,
    `applications: ${formatList(record.applications)}`,
    `api bases: ${formatList(record.apiBases)}`,
    `auth states: ${formatList(record.authStates)}`,
    `source artifacts: ${formatList(record.sourceArtifacts)}`
  ]);
  section(
    "Role Access",
    record.roleAccess.length > 0
      ? record.roleAccess.map((role) =>
          `${role.role} (${role.authState}) can ${formatList(role.canAccess)}; cannot ${formatList(role.cannotAccess)}`
        )
      : ["not recorded"]
  );
  section(
    "Endpoints",
    record.endpoints.length > 0
      ? record.endpoints.map((endpoint) =>
          `${endpoint.id}: ${endpoint.method ?? "METHOD"} ${endpoint.host ? `${endpoint.host} ` : ""}${endpoint.path}`
          + ` auth=${endpoint.authState ?? "unknown"} roles=${formatList(endpoint.roles)}`
          + ` state-changing=${endpoint.stateChanging ? "yes" : "no"} file-flow=${endpoint.fileFlow}`
        )
      : ["not recorded"]
  );
  section("Assessment", [
    `scope status: ${record.assessment.scopeStatus}`,
    `safety: ${record.assessment.safetyLevel}`,
    `passive only: ${record.assessment.passiveOnly ? "yes" : "no"}`,
    `no requests made: ${record.assessment.noRequestsMade ? "yes" : "no"}`,
    `endpoints: ${record.assessment.endpointCount}`,
    `state-changing endpoints: ${record.assessment.stateChangingEndpoints}`,
    `file-flow endpoints: ${record.assessment.fileFlowEndpoints}`,
    `third-party integrations: ${record.assessment.thirdPartyIntegrationCount}`,
    `missing fields: ${formatList(record.assessment.missingFields)}`,
    `out-of-scope references: ${formatList(record.assessment.outOfScopeReferences)}`,
    `redacted fields: ${formatList(record.assessment.redactedFields)}`
  ]);
  section(
    "Target Map Checks",
    record.assessment.checks.map((check) => `${check.status}: ${check.id} - ${check.summary}`)
  );
  section("Next", record.assessment.nextRecommendedActions);
  section("Suggested Commands", suggestedCommandsForTargetMap(record));
}

function printTargetMapPreview(preview: RunPreview): void {
  if (preview.proposal.kind !== "bug_bounty_review") {
    throw new Error(`Run ${preview.metadata.id} is not a bug bounty proposal (${preview.proposal.kind}).`);
  }

  if (preview.bugBountyTargetMap) {
    printTargetMap(preview.bugBountyTargetMap);
    return;
  }

  console.log("Dure Target Map");
  console.log("");
  section("Run", [
    `id: ${preview.metadata.id}`,
    `target: ${preview.bugBountyScope?.target ?? "scope not recorded"}`,
    "target map: not recorded"
  ]);
  section("Next", [
    preview.bugBountyScope?.intakeAssessment.status === "sufficient"
      ? "Record a passive target map from user-supplied artifacts before expanding evidence work."
      : "Record sufficient bug bounty scope before creating a target map."
  ]);
  section("Suggested Commands", suggestedCommandsForPreview(preview));
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
  section("Suggested Commands", suggestedCommandsForEvidenceRecord(record));
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
  section("Suggested Commands", suggestedCommandsForEvidenceLedger(preview));
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
  section("Suggested Commands", [`dure export ${record.runId}`]);
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
  section("Suggested Commands", suggestedCommandsForReportDrafts(preview));
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
  section("Workspace", [`root: ${record.workspaceRoot}`, `backup root: ${record.backupRoot}`]);
  section("Preflight", [
    `checked at: ${record.preflight.checkedAt}`,
    `approval expires: ${record.preflight.approvalExpiresAt ?? "not recorded"}`,
    `checks passed: ${record.preflight.checks.filter((check) => check.status === "passed").length}/${record.preflight.checks.length}`,
    `creates: ${record.summary.creates}`,
    `modifies: ${record.summary.modifies}`,
    `backups planned: ${record.summary.backupsPlanned}`
  ]);
  section(
    "Preflight Checks",
    record.preflight.checks.map((check) => `${check.status}: ${check.id} - ${check.summary}`)
  );
  section(
    "Changes",
    record.files.map((file) => {
      const backup = file.backupPath ? `, backup: ${file.backupPath}` : "";
      return `${file.operation}: ${file.path} -> ${file.targetPath}${backup}`;
    })
  );
  section("Rollback", [
    "metadata: apply.json and rollback.json",
    `backups: ${record.backupRoot}`
  ]);
  section("Next", [record.nextRecommendedAction]);
  section("Suggested Commands", [`dure verify ${record.runId} --script test`]);
}

function printWorkspaceVerification(record: WorkspaceVerificationRecord): void {
  const summary = workspaceVerificationSummary(record);
  const gates = workspaceVerificationGates(record);
  const outputArtifacts = workspaceVerificationOutputArtifacts(record);
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
  section("Summary", [
    `requested scripts: ${formatList(summary.requestedScripts)}`,
    `configured scripts: ${formatList(summary.configuredScripts)}`,
    `passed commands: ${summary.passedCommands}`,
    `failed commands: ${summary.failedCommands}`,
    `blocked commands: ${summary.blockedCommands}`,
    `skipped commands: ${summary.skippedCommands}`,
    `timed out commands: ${summary.timedOutCommands}`,
    `output artifacts: ${summary.outputArtifacts}`,
    `redacted artifacts: ${summary.redactedArtifacts}`,
    `required gates passed: ${summary.requiredGatesPassed ? "yes" : "no"}`,
    `dependency audit: ${summary.dependencyAudit}`,
    `failure reasons: ${formatList(summary.failureReasons)}`
  ]);
  section(
    "Commands",
    record.commands.map((command) => {
      const exit = command.exitCode === undefined ? "exit n/a" : `exit ${command.exitCode}`;
      const redaction = command.stdoutRedacted || command.stderrRedacted ? ", redacted" : "";
      const truncation = command.stdoutTruncated || command.stderrTruncated ? ", truncated" : "";
      return `${command.name}: ${command.status} (${exit}, ${command.durationMs}ms${redaction}${truncation})`;
    })
  );
  section(
    "Verification Gates",
    gates.map((gate) => `${gate.status}: ${gate.id} (${gate.required ? "required" : "optional"}) - ${gate.summary}`)
  );
  section(
    "Output Artifacts",
    outputArtifacts.length > 0
      ? outputArtifacts.map((artifact) =>
          `${artifact.command} ${artifact.stream}: ${artifact.path}${artifact.redacted ? ", redacted" : ""}${artifact.truncated ? ", truncated" : ""}`
        )
      : ["none"]
  );
  section(
    "Local Checks",
    record.localChecks.map((check) => `${check.name}: ${check.passed ? "pass" : "fail"} (${check.mocked ? "mocked" : "local"}) - ${check.summary}`)
  );
  section("Next", [record.nextRecommendedAction]);
  section("Suggested Commands", record.accepted ? [`dure export ${record.runId}`] : [`dure show ${record.runId}`]);
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
  const summary = workspaceVerificationSummary(result);
  return [
    `accepted: ${result.accepted ? "yes" : "no"}`,
    `status: ${result.previousStatus} -> ${result.nextStatus}`,
    `commands: ${summary.passedCommands} passed, ${summary.failedCommands} failed, ${summary.blockedCommands} blocked, ${summary.skippedCommands} skipped`,
    `gates: ${summary.requiredGatesPassed ? "required gates passed" : "required gates failed"}`,
    `failure reasons: ${formatList(summary.failureReasons)}`,
    ...result.commands.map((command) => `${command.name}: ${command.status}`)
  ];
}

function workspaceVerificationSummary(result: WorkspaceVerificationRecord): WorkspaceVerificationRecord["summary"] {
  return result.summary ?? {
    requestedScripts: result.commands.map((command) => command.name),
    configuredScripts: result.commands.filter((command) => command.configured).map((command) => command.name),
    passedCommands: result.commands.filter((command) => command.status === "passed").length,
    failedCommands: result.commands.filter((command) => command.status === "failed").length,
    blockedCommands: result.commands.filter((command) => command.status === "blocked").length,
    skippedCommands: result.commands.filter((command) => command.status === "not_configured").length,
    timedOutCommands: result.commands.filter((command) => command.status === "timed_out").length,
    outputArtifacts: result.commands.filter((command) => command.stdoutPath).length
      + result.commands.filter((command) => command.stderrPath).length,
    redactedArtifacts: 0,
    requiredGatesPassed: result.accepted,
    dependencyAudit: "placeholder",
    failureReasons: result.accepted ? [] : ["Workspace verification did not pass."]
  };
}

function workspaceVerificationGates(result: WorkspaceVerificationRecord): WorkspaceVerificationRecord["gates"] {
  return result.gates ?? [
    ...result.commands.map((command) => ({
      id: command.name,
      category: "command" as const,
      status: command.status === "passed"
        ? "passed" as const
        : command.status === "not_configured"
          ? "skipped" as const
          : command.status === "blocked" || command.status === "timed_out"
            ? "blocked" as const
            : "failed" as const,
      required: command.configured,
      summary: `${command.name}: ${command.status}`
    })),
    ...result.localChecks.map((check) => ({
      id: check.name,
      category: check.mocked ? "placeholder" as const : "local_check" as const,
      status: check.mocked ? "skipped" as const : check.passed ? "passed" as const : "failed" as const,
      required: !check.mocked,
      summary: check.summary
    }))
  ];
}

function workspaceVerificationOutputArtifacts(
  result: WorkspaceVerificationRecord
): WorkspaceVerificationRecord["outputArtifacts"] {
  return result.outputArtifacts ?? result.commands.flatMap((command) => {
    const artifacts: WorkspaceVerificationRecord["outputArtifacts"][number][] = [];
    if (command.stdoutPath) {
      artifacts.push({
        command: command.name,
        stream: "stdout",
        path: command.stdoutPath,
        redacted: command.stdoutRedacted ?? false,
        truncated: command.stdoutTruncated ?? false
      });
    }
    if (command.stderrPath) {
      artifacts.push({
        command: command.name,
        stream: "stderr",
        path: command.stderrPath,
        redacted: command.stderrRedacted ?? false,
        truncated: command.stderrTruncated ?? false
      });
    }
    return artifacts;
  });
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
