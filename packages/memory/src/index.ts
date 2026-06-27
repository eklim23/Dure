import { createHash, randomBytes } from "node:crypto";
import { appendFileSync, copyFileSync, existsSync, lstatSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import type {
  AppliedPatchFile,
  ApplyRecord,
  ApprovalDecision,
  ApprovalRecord,
  AssistantAgentRole,
  AssistantRequestContext,
  BugBountyScopeIntake,
  BugBountyScopeRecord,
  DecisionLog,
  DecisionLogEntry,
  DecisionLogEntryType,
  MoochackerAssessment,
  PatchChange,
  RunArtifactPaths,
  RunMetadata,
  RunPreview,
  RunRecord,
  RunStatus,
  RollbackRecord,
  SafetyDecision,
  TaskModeProposal,
  VerificationResult,
  WorkspaceVerificationRecord,
  WorkspaceVerificationScriptName
} from "@dure/core";
import { WorkspaceVerifier } from "@dure/verifier";

export class DecisionLogRecorder {
  private readonly entries: DecisionLogEntry[] = [];

  append(type: DecisionLogEntryType, message: string, data: Record<string, unknown>): DecisionLogEntry {
    const entry: DecisionLogEntry = {
      type,
      message,
      data,
      timestamp: new Date().toISOString()
    };
    this.entries.push(entry);
    return entry;
  }

  toDecisionLog(): DecisionLog {
    return {
      entries: [...this.entries]
    };
  }
}

export interface PersistRunInput {
  readonly context: AssistantRequestContext;
  readonly selectedAgentTeam: readonly AssistantAgentRole[];
  readonly proposal: TaskModeProposal;
  readonly safetyDecision: SafetyDecision;
  readonly verificationResult?: VerificationResult;
  readonly decisionLog: DecisionLog;
  readonly nextRecommendedAction: string;
  readonly now?: Date;
}

export interface ApprovalDecisionInput {
  readonly reason?: string;
  readonly now?: Date;
}

export interface AttachBugBountyScopeInput {
  readonly scope: BugBountyScopeIntake;
  readonly now?: Date;
}

export interface ApplyRunInput {
  readonly workspaceRoot?: string;
  readonly now?: Date;
}

export interface VerifyRunInput {
  readonly workspaceRoot?: string;
  readonly scripts?: readonly WorkspaceVerificationScriptName[];
  readonly timeoutMs?: number;
  readonly now?: Date;
}

export class RunStore {
  readonly root: string;

  constructor(root = path.join(process.cwd(), ".dure", "runs")) {
    this.root = path.resolve(root);
  }

  persistRun(input: PersistRunInput): RunRecord {
    const now = input.now ?? new Date();
    const runId = this.createUniqueRunId(now);
    const runDir = path.join(this.root, runId);
    const artifactPaths = createArtifactPaths(runDir, input.verificationResult !== undefined);

    mkdirSync(runDir, { recursive: true });

    const record: RunRecord = {
      id: runId,
      status: "proposed",
      createdAt: input.context.createdAt,
      updatedAt: now.toISOString(),
      input: input.context.originalInput,
      selectedMode: input.context.selectedMode,
      confidenceScore: input.context.confidenceScore,
      proposalKind: input.proposal.kind,
      proposalId: input.proposal.id,
      requiresApproval: input.proposal.requiresApproval,
      artifactPaths
    };

    writeJson(artifactPaths.request, {
      originalInput: input.context.originalInput,
      receivedAt: input.context.createdAt
    });
    writeJson(artifactPaths.context, input.context);
    writeJson(artifactPaths.proposal, input.proposal);
    writeJson(artifactPaths.safety, input.safetyDecision);
    if (artifactPaths.verification && input.verificationResult) {
      writeJson(artifactPaths.verification, input.verificationResult);
    }
    writeJson(artifactPaths.metadata, {
      ...record,
      selectedAgentTeam: input.selectedAgentTeam,
      nextRecommendedAction: input.nextRecommendedAction
    });
    writeFileSync(artifactPaths.decisionLog, "", { encoding: "utf8", flag: "a" });
    this.appendDecisionEntries(artifactPaths.decisionLog, input.decisionLog.entries);

    return record;
  }

  appendDecisionEntry(run: RunRecord, entry: DecisionLogEntry): void {
    appendJsonLine(run.artifactPaths.decisionLog, entry);
  }

  approveRun(runId: string, input: ApprovalDecisionInput = {}): ApprovalRecord {
    return this.recordApprovalDecision(runId, "approved", input);
  }

  rejectRun(runId: string, input: ApprovalDecisionInput = {}): ApprovalRecord {
    return this.recordApprovalDecision(runId, "rejected", input);
  }

  attachBugBountyScope(runId: string, input: AttachBugBountyScopeInput): BugBountyScopeRecord {
    const now = input.now ?? new Date();
    const preview = this.loadPreview(runId);
    if (preview.proposal.kind !== "bug_bounty_review") {
      throw new Error(`Run ${runId} is not a bug bounty proposal (${preview.proposal.kind}).`);
    }
    if (preview.metadata.status !== "proposed") {
      throw new Error(`Run ${runId} cannot accept scope while status is ${preview.metadata.status}.`);
    }
    if (preview.artifactPaths.scope && existsSync(preview.artifactPaths.scope)) {
      throw new Error(`Run ${runId} already has a bug bounty scope intake.`);
    }

    const scope = normalizeScope(input.scope);
    const scopePath = path.join(preview.artifactPaths.runDir, "scope.json");
    const record: BugBountyScopeRecord = {
      ...scope,
      runId,
      recordedBy: "user",
      createdAt: now.toISOString(),
      moochackerAssessment: buildScopeMoochackerAssessment(scope)
    };

    writeJson(scopePath, record);
    appendJsonLine(preview.artifactPaths.decisionLog, {
      type: "bug_bounty_scope_intake",
      message: "Bug bounty scope intake was recorded without active testing.",
      data: {
        runId,
        target: record.target,
        scopeStatus: record.moochackerAssessment.scopeStatus,
        safetyLevel: record.moochackerAssessment.safetyLevel,
        inScopeAssets: record.inScopeAssets,
        outOfScopeAssets: record.outOfScopeAssets,
        allowedTechniques: record.allowedTechniques,
        forbiddenTechniques: record.forbiddenTechniques
      },
      timestamp: now.toISOString()
    } satisfies DecisionLogEntry);
    this.updateMetadata(preview, preview.metadata.status, now, { hasScope: true });

    return record;
  }

  applyRun(runId: string, input: ApplyRunInput = {}): ApplyRecord {
    const now = input.now ?? new Date();
    const preview = this.loadPreview(runId);
    if (preview.metadata.status !== "approved") {
      throw new Error(`Run ${runId} cannot be applied; current status is ${preview.metadata.status}.`);
    }
    if (!preview.approvalRecord || preview.approvalRecord.decision !== "approved") {
      throw new Error(`Run ${runId} cannot be applied without an approved approval record.`);
    }
    if (preview.proposal.kind !== "patch") {
      throw new Error(`Run ${runId} is not a patch proposal (${preview.proposal.kind}).`);
    }
    if (preview.proposal.status !== "accepted") {
      throw new Error(`Run ${runId} cannot be applied because the patch proposal is ${preview.proposal.status}.`);
    }
    if (preview.verificationResult?.accepted !== true) {
      throw new Error(`Run ${runId} cannot be applied because verification has not accepted the proposal.`);
    }
    if (preview.approvalRecord.proposalId !== preview.metadata.proposalId) {
      throw new Error(`Run ${runId} approval record does not match the current proposal.`);
    }
    if (preview.artifactPaths.apply && existsSync(preview.artifactPaths.apply)) {
      throw new Error(`Run ${runId} has already been applied.`);
    }

    const workspaceRoot = path.resolve(input.workspaceRoot ?? path.join(this.root, "..", "workspaces", runId));
    const backupRoot = path.join(preview.artifactPaths.runDir, "backups", createApplyTimestamp(now), "files");
    const changes = preview.proposal.changes.map((change) => preparePatchChange(change, workspaceRoot, backupRoot));

    mkdirSync(workspaceRoot, { recursive: true });
    mkdirSync(backupRoot, { recursive: true });

    const appliedFiles: AppliedPatchFile[] = [];
    for (const change of changes) {
      const previousHash = change.previousExists ? sha256(readFileSync(change.targetPath)) : undefined;
      if (change.previousExists && change.backupPath) {
        mkdirSync(path.dirname(change.backupPath), { recursive: true });
        copyFileSync(change.targetPath, change.backupPath);
      }
      mkdirSync(path.dirname(change.targetPath), { recursive: true });
      if (change.operation === "create") {
        writeFileSync(change.targetPath, change.content, { encoding: "utf8", flag: "wx" });
      } else {
        writeFileSync(change.targetPath, change.content, "utf8");
      }

      appliedFiles.push({
        path: change.relativePath,
        operation: change.operation,
        targetPath: change.targetPath,
        backupPath: change.backupPath,
        previousHash,
        newHash: sha256(readFileSync(change.targetPath))
      });
    }

    const applyRecord: ApplyRecord = {
      runId,
      proposalId: preview.metadata.proposalId,
      appliedBy: "user-approved-controlled-apply",
      createdAt: now.toISOString(),
      workspaceRoot,
      backupRoot,
      previousStatus: preview.metadata.status,
      nextStatus: "applied",
      files: appliedFiles,
      nextRecommendedAction: "Run `dure verify` to execute approved local checks before marking this run verified."
    };
    const rollbackRecord: RollbackRecord = {
      runId,
      proposalId: preview.metadata.proposalId,
      createdAt: now.toISOString(),
      workspaceRoot,
      backupRoot,
      createdFiles: appliedFiles.filter((file) => file.operation === "create").map((file) => file.path),
      modifiedFiles: appliedFiles.filter((file) => file.operation === "modify").map((file) => file.path),
      backupFileMap: Object.fromEntries(
        appliedFiles.flatMap((file) => file.backupPath ? [[file.path, file.backupPath]] : [])
      ),
      previousHashes: Object.fromEntries(
        appliedFiles.flatMap((file) => file.previousHash ? [[file.path, file.previousHash]] : [])
      ),
      newHashes: Object.fromEntries(appliedFiles.map((file) => [file.path, file.newHash])),
      rollbackImplemented: false,
      note: "Rollback execution is intentionally not implemented in Stage 7; this metadata enables a later rollback command."
    };

    writeJson(path.join(preview.artifactPaths.runDir, "apply.json"), applyRecord);
    writeJson(path.join(preview.artifactPaths.runDir, "rollback.json"), rollbackRecord);
    appendJsonLine(preview.artifactPaths.decisionLog, {
      type: "patch_applied",
      message: "Approved patch proposal was applied to a controlled workspace.",
      data: {
        runId,
        proposalId: applyRecord.proposalId,
        workspaceRoot,
        backupRoot,
        files: appliedFiles.map((file) => ({
          path: file.path,
          operation: file.operation,
          backupPath: file.backupPath,
          previousHash: file.previousHash,
          newHash: file.newHash
        }))
      },
      timestamp: now.toISOString()
    } satisfies DecisionLogEntry);
    this.updateMetadata(preview, "applied", now, { hasApply: true, hasRollback: true });

    return applyRecord;
  }

  verifyRun(runId: string, input: VerifyRunInput = {}): WorkspaceVerificationRecord {
    const now = input.now ?? new Date();
    const preview = this.loadPreview(runId);
    if (preview.metadata.status !== "applied") {
      throw new Error(`Run ${runId} cannot be verified; current status is ${preview.metadata.status}.`);
    }
    if (preview.proposal.kind !== "patch") {
      throw new Error(`Run ${runId} is not a patch proposal (${preview.proposal.kind}).`);
    }
    if (!preview.approvalRecord || preview.approvalRecord.decision !== "approved") {
      throw new Error(`Run ${runId} cannot be verified without an approved approval record.`);
    }
    if (!preview.applyRecord) {
      throw new Error(`Run ${runId} cannot be verified because apply.json is missing.`);
    }
    if (preview.artifactPaths.workspaceVerification && existsSync(preview.artifactPaths.workspaceVerification)) {
      throw new Error(`Run ${runId} already has a workspace verification result.`);
    }

    const appliedWorkspaceRoot = path.resolve(preview.applyRecord.workspaceRoot);
    const workspaceRoot = path.resolve(input.workspaceRoot ?? appliedWorkspaceRoot);
    if (!isSamePath(workspaceRoot, appliedWorkspaceRoot)) {
      throw new Error(`Verification workspace must match the applied workspace: ${appliedWorkspaceRoot}.`);
    }

    const verifier = new WorkspaceVerifier();
    const record = verifier.verifyWorkspace({
      runId,
      proposalId: preview.metadata.proposalId,
      workspaceRoot,
      outputRoot: path.join(preview.artifactPaths.runDir, "verification-output"),
      previousStatus: preview.metadata.status,
      scripts: input.scripts,
      timeoutMs: input.timeoutMs,
      now
    });

    writeJson(path.join(preview.artifactPaths.runDir, "workspace-verification.json"), record);
    appendJsonLine(preview.artifactPaths.decisionLog, {
      type: "workspace_verification_result",
      message: "Applied workspace verification completed with allow-listed package scripts.",
      data: {
        runId,
        proposalId: record.proposalId,
        workspaceRoot: record.workspaceRoot,
        accepted: record.accepted,
        previousStatus: record.previousStatus,
        nextStatus: record.nextStatus,
        commands: record.commands.map((command) => ({
          name: command.name,
          status: command.status,
          configured: command.configured,
          exitCode: command.exitCode,
          durationMs: command.durationMs
        })),
        localChecks: record.localChecks.map((check) => ({
          name: check.name,
          passed: check.passed,
          mocked: check.mocked,
          summary: check.summary
        }))
      },
      timestamp: record.completedAt
    } satisfies DecisionLogEntry);
    this.updateMetadata(preview, record.nextStatus, new Date(record.completedAt), {
      hasWorkspaceVerification: true
    });

    return record;
  }

  loadPreview(runId: string): RunPreview {
    if (!isSafeRunId(runId)) {
      throw new Error(`Invalid run id: ${runId}`);
    }

    const runDir = path.join(this.root, runId);
    const artifactPaths = createArtifactPaths(runDir, {
      hasVerification: existsSync(path.join(runDir, "verification.json")),
      hasWorkspaceVerification: existsSync(path.join(runDir, "workspace-verification.json")),
      hasApproval: existsSync(path.join(runDir, "approval.json")),
      hasScope: existsSync(path.join(runDir, "scope.json")),
      hasApply: existsSync(path.join(runDir, "apply.json")),
      hasRollback: existsSync(path.join(runDir, "rollback.json"))
    });
    if (!existsSync(artifactPaths.metadata)) {
      throw new Error(`Run not found: ${runId}`);
    }

    const metadata = readJson<RunMetadata>(artifactPaths.metadata);
    if (metadata.id !== runId) {
      throw new Error(`Malformed run artifact: metadata.json id does not match ${runId}.`);
    }

    const request = readJson<RunPreview["request"]>(artifactPaths.request);
    const context = readJson<AssistantRequestContext>(artifactPaths.context);
    const proposal = readJson<TaskModeProposal>(artifactPaths.proposal);
    const safetyDecision = readJson<SafetyDecision>(artifactPaths.safety);
    const verificationResult = artifactPaths.verification && existsSync(artifactPaths.verification)
      ? readJson<VerificationResult>(artifactPaths.verification)
      : undefined;
    const workspaceVerificationRecord = artifactPaths.workspaceVerification && existsSync(artifactPaths.workspaceVerification)
      ? readJson<WorkspaceVerificationRecord>(artifactPaths.workspaceVerification)
      : undefined;
    const approvalRecord = artifactPaths.approval && existsSync(artifactPaths.approval)
      ? readJson<ApprovalRecord>(artifactPaths.approval)
      : undefined;
    const bugBountyScope = artifactPaths.scope && existsSync(artifactPaths.scope)
      ? readJson<BugBountyScopeRecord>(artifactPaths.scope)
      : undefined;
    const applyRecord = artifactPaths.apply && existsSync(artifactPaths.apply)
      ? readJson<ApplyRecord>(artifactPaths.apply)
      : undefined;
    const rollbackRecord = artifactPaths.rollback && existsSync(artifactPaths.rollback)
      ? readJson<RollbackRecord>(artifactPaths.rollback)
      : undefined;
    const decisionLog = readDecisionLog(artifactPaths.decisionLog);

    return {
      metadata: {
        id: metadata.id,
        status: metadata.status,
        createdAt: metadata.createdAt,
        updatedAt: metadata.updatedAt,
        input: metadata.input,
        selectedMode: metadata.selectedMode,
        confidenceScore: metadata.confidenceScore,
        proposalKind: metadata.proposalKind,
        proposalId: metadata.proposalId,
        requiresApproval: metadata.requiresApproval,
        artifactPaths,
        selectedAgentTeam: metadata.selectedAgentTeam,
        nextRecommendedAction: metadata.nextRecommendedAction
      },
      request,
      context,
      proposal,
      safetyDecision,
      verificationResult,
      workspaceVerificationRecord,
      approvalRecord,
      bugBountyScope,
      applyRecord,
      rollbackRecord,
      decisionLog,
      artifactPaths
    };
  }

  loadRun(runId: string): RunPreview {
    return this.loadPreview(runId);
  }

  private createUniqueRunId(now: Date): string {
    for (let attempt = 0; attempt < 10; attempt += 1) {
      const candidate = createRunId(now);
      if (!existsSync(path.join(this.root, candidate))) {
        return candidate;
      }
    }
    throw new Error("Unable to create a unique run id.");
  }

  private appendDecisionEntries(filePath: string, entries: readonly DecisionLogEntry[]): void {
    for (const entry of entries) {
      appendJsonLine(filePath, entry);
    }
  }

  private recordApprovalDecision(
    runId: string,
    decision: ApprovalDecision,
    input: ApprovalDecisionInput
  ): ApprovalRecord {
    const now = input.now ?? new Date();
    const preview = this.loadPreview(runId);
    if (preview.metadata.status !== "proposed") {
      throw new Error(`Run ${runId} cannot be ${decision}; current status is ${preview.metadata.status}.`);
    }
    if (preview.artifactPaths.approval && existsSync(preview.artifactPaths.approval)) {
      throw new Error(`Run ${runId} already has an approval decision.`);
    }
    if (decision === "approved") {
      if (preview.proposal.kind !== "patch") {
        throw new Error(`Run ${runId} is not a patch proposal (${preview.proposal.kind}).`);
      }
      if (preview.proposal.status === "rejected") {
        throw new Error(`Run ${runId} cannot be approved because the patch proposal is rejected.`);
      }
      if (preview.verificationResult?.accepted !== true) {
        throw new Error(`Run ${runId} cannot be approved because verification has not accepted the proposal.`);
      }
    }

    const nextStatus: RunStatus = decision === "approved" ? "approved" : "rejected";
    const record: ApprovalRecord = {
      runId,
      proposalId: preview.metadata.proposalId,
      decision,
      decidedBy: "user",
      reason: cleanOptionalString(input.reason),
      createdAt: now.toISOString(),
      previousStatus: preview.metadata.status,
      nextStatus,
      nextRecommendedAction:
        decision === "approved"
          ? "Proceed to controlled apply in a later stage; no files were changed by approval."
          : "Record revised requirements before producing a new proposal."
    };

    writeJson(path.join(preview.artifactPaths.runDir, "approval.json"), record);
    appendJsonLine(preview.artifactPaths.decisionLog, {
      type: "approval_decision",
      message: `User recorded a ${decision} decision for the run.`,
      data: {
        runId,
        proposalId: record.proposalId,
        decision: record.decision,
        reason: record.reason,
        previousStatus: record.previousStatus,
        nextStatus: record.nextStatus
      },
      timestamp: now.toISOString()
    } satisfies DecisionLogEntry);
    this.updateMetadata(preview, nextStatus, now, { hasApproval: true });

    return record;
  }

  private updateMetadata(
    preview: RunPreview,
    status: RunStatus,
    now: Date,
    options: {
      readonly hasApproval?: boolean;
      readonly hasScope?: boolean;
      readonly hasApply?: boolean;
      readonly hasRollback?: boolean;
      readonly hasWorkspaceVerification?: boolean;
    }
  ): void {
    const artifactPaths = createArtifactPaths(preview.artifactPaths.runDir, {
      hasVerification: preview.artifactPaths.verification !== undefined,
      hasWorkspaceVerification:
        options.hasWorkspaceVerification ?? preview.artifactPaths.workspaceVerification !== undefined,
      hasApproval: options.hasApproval ?? preview.artifactPaths.approval !== undefined,
      hasScope: options.hasScope ?? preview.artifactPaths.scope !== undefined,
      hasApply: "hasApply" in options ? options.hasApply : preview.artifactPaths.apply !== undefined,
      hasRollback: "hasRollback" in options ? options.hasRollback : preview.artifactPaths.rollback !== undefined
    });
    const metadata: RunMetadata = {
      ...preview.metadata,
      status,
      updatedAt: now.toISOString(),
      artifactPaths
    };

    writeJson(artifactPaths.metadata, metadata);
  }
}

export function createRunId(now = new Date()): string {
  const timestamp = now
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}Z$/, "Z")
    .replace("T", "-");
  return `run-${timestamp}-${randomBytes(3).toString("hex")}`;
}

export function isSafeRunId(runId: string): boolean {
  return /^run-\d{8}-\d{6}Z-[0-9a-f]{6}$/.test(runId);
}

function createArtifactPaths(
  runDir: string,
  options: boolean | {
    readonly hasVerification?: boolean;
    readonly hasWorkspaceVerification?: boolean;
    readonly hasApproval?: boolean;
    readonly hasScope?: boolean;
    readonly hasApply?: boolean;
    readonly hasRollback?: boolean;
  }
): RunArtifactPaths {
  const normalized = typeof options === "boolean" ? { hasVerification: options } : options;
  return {
    runDir,
    request: path.join(runDir, "request.json"),
    context: path.join(runDir, "context.json"),
    proposal: path.join(runDir, "proposal.json"),
    safety: path.join(runDir, "safety.json"),
    decisionLog: path.join(runDir, "decision-log.jsonl"),
    metadata: path.join(runDir, "metadata.json"),
    verification: normalized.hasVerification ? path.join(runDir, "verification.json") : undefined,
    workspaceVerification: normalized.hasWorkspaceVerification
      ? path.join(runDir, "workspace-verification.json")
      : undefined,
    approval: normalized.hasApproval ? path.join(runDir, "approval.json") : undefined,
    scope: normalized.hasScope ? path.join(runDir, "scope.json") : undefined,
    apply: normalized.hasApply ? path.join(runDir, "apply.json") : undefined,
    rollback: normalized.hasRollback ? path.join(runDir, "rollback.json") : undefined
  };
}

function writeJson(filePath: string, value: unknown): void {
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function appendJsonLine(filePath: string, value: unknown): void {
  appendFileSync(filePath, `${JSON.stringify(value)}\n`, "utf8");
}

function readJson<T>(filePath: string): T {
  try {
    return JSON.parse(readFileSync(filePath, "utf8")) as T;
  } catch (error) {
    const fileName = path.basename(filePath);
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      throw new Error(`Missing run artifact: ${fileName}.`);
    }
    throw new Error(`Malformed run artifact: ${fileName}.`);
  }
}

function readDecisionLog(filePath: string): DecisionLog {
  let source: string;
  try {
    source = readFileSync(filePath, "utf8").trim();
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      throw new Error("Missing run artifact: decision-log.jsonl.");
    }
    throw error;
  }

  if (source.length === 0) {
    return { entries: [] };
  }

  try {
    return {
      entries: source.split("\n").map((line) => JSON.parse(line) as DecisionLogEntry)
    };
  } catch {
    throw new Error("Malformed run artifact: decision-log.jsonl.");
  }
}

interface PreparedPatchChange {
  readonly relativePath: string;
  readonly operation: "create" | "modify";
  readonly content: string;
  readonly targetPath: string;
  readonly backupPath?: string;
  readonly previousExists: boolean;
}

function preparePatchChange(change: PatchChange, workspaceRoot: string, backupRoot: string): PreparedPatchChange {
  if (change.operation === "delete") {
    throw new Error(`Delete operation is not allowed in controlled apply: ${change.path}`);
  }
  if (!isSafePatchPath(change.path)) {
    throw new Error(`Unsafe patch path rejected: ${change.path}`);
  }
  if (change.content === undefined) {
    throw new Error(`Patch change is missing content: ${change.path}`);
  }

  const relativePath = change.path.replace(/\\/g, "/");
  const targetPath = path.resolve(workspaceRoot, relativePath);
  if (!isPathInside(workspaceRoot, targetPath)) {
    throw new Error(`Patch path escapes the controlled workspace: ${change.path}`);
  }

  const previousExists = existsSync(targetPath);
  assertNoSymlinkAncestor(workspaceRoot, targetPath);
  if (change.operation === "create" && previousExists) {
    throw new Error(`Create operation would overwrite an existing file: ${change.path}`);
  }
  if (change.operation === "modify" && !previousExists) {
    throw new Error(`Modify operation requires an existing file: ${change.path}`);
  }
  if (change.operation === "modify" && !lstatSync(targetPath).isFile()) {
    throw new Error(`Modify operation requires a regular file: ${change.path}`);
  }

  return {
    relativePath,
    operation: change.operation,
    content: change.content,
    targetPath,
    backupPath: previousExists ? path.join(backupRoot, relativePath) : undefined,
    previousExists
  };
}

function isSafePatchPath(candidate: string): boolean {
  if (candidate.trim().length === 0) {
    return false;
  }
  if (path.isAbsolute(candidate) || /^[a-zA-Z]:[\\/]/.test(candidate) || candidate.includes("\0")) {
    return false;
  }

  const segments = candidate.replace(/\\/g, "/").split("/");
  return segments.every((segment) => !["", ".", "..", ".dure", ".git", "node_modules"].includes(segment));
}

function isPathInside(root: string, candidate: string): boolean {
  const relative = path.relative(path.resolve(root), path.resolve(candidate));
  return relative.length === 0 || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function isSamePath(left: string, right: string): boolean {
  const normalizedLeft = path.resolve(left);
  const normalizedRight = path.resolve(right);
  return process.platform === "win32"
    ? normalizedLeft.toLowerCase() === normalizedRight.toLowerCase()
    : normalizedLeft === normalizedRight;
}

function assertNoSymlinkAncestor(root: string, targetPath: string): void {
  const relative = path.relative(path.resolve(root), path.resolve(targetPath));
  const segments = relative.split(path.sep).filter((segment) => segment.length > 0);
  let current = path.resolve(root);

  for (const segment of segments) {
    current = path.join(current, segment);
    if (!existsSync(current)) {
      return;
    }
    if (lstatSync(current).isSymbolicLink()) {
      throw new Error(`Patch path uses a symbolic link and is not allowed: ${targetPath}`);
    }
  }
}

function createApplyTimestamp(now: Date): string {
  return now
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}Z$/, "Z")
    .replace("T", "-");
}

function sha256(value: Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}

function normalizeScope(input: BugBountyScopeIntake): BugBountyScopeIntake {
  return {
    target: cleanRequiredString(input.target, "Scope target is required."),
    inScopeAssets: cleanList(input.inScopeAssets),
    outOfScopeAssets: cleanList(input.outOfScopeAssets),
    allowedTechniques: cleanList(input.allowedTechniques),
    forbiddenTechniques: cleanList(input.forbiddenTechniques),
    rateLimits: cleanList(input.rateLimits),
    testAccountRoles: cleanList(input.testAccountRoles),
    dataHandlingRules: cleanList(input.dataHandlingRules),
    authorizationNote: cleanOptionalString(input.authorizationNote) ?? "",
    programRulesUrl: cleanOptionalString(input.programRulesUrl)
  };
}

function buildScopeMoochackerAssessment(scope: BugBountyScopeIntake): MoochackerAssessment {
  const dangerousAllowed = scope.allowedTechniques.some((technique) => hasDangerousSignal(technique));
  const missingClarifications = [
    scope.inScopeAssets.length === 0 ? "Which exact assets are in scope?" : undefined,
    scope.allowedTechniques.length === 0 ? "Which testing techniques are explicitly allowed?" : undefined,
    scope.forbiddenTechniques.length === 0 ? "Which testing techniques are forbidden?" : undefined,
    scope.rateLimits.length === 0 ? "What rate limits or automation limits apply?" : undefined,
    scope.testAccountRoles.length === 0 ? "Which test account roles are authorized?" : undefined,
    scope.dataHandlingRules.length === 0 ? "What data handling and redaction rules apply?" : undefined,
    scope.authorizationNote.length === 0 ? "What note confirms authorization or safe harbor?" : undefined
  ].filter((question): question is string => question !== undefined);
  const scopeStatus = dangerousAllowed
    ? "out_of_scope"
    : missingClarifications.length > 0
      ? "needs_clarification"
      : "sufficient";
  const safetyLevel = dangerousAllowed ? "blocked" : "caution";

  return {
    agent: "MoochackerAgent",
    mode: "bug_bounty",
    scopeStatus,
    safetyLevel,
    allowedActions:
      safetyLevel === "blocked"
        ? ["Passive scope clarification only.", "Record the unsafe allowed-technique conflict before proceeding."]
        : [
            "Use only the user-provided in-scope assets.",
            "Plan tests only from the explicitly allowed techniques.",
            "Keep all work passive until a later approved execution stage."
          ],
    blockedActions: [
      ...scope.forbiddenTechniques.map((technique) => `Forbidden by scope: ${technique}`),
      "No real HTTP requests, scanners, exploit execution, or active testing in this intake step.",
      "No scope expansion beyond user-provided assets.",
      "No credentials, secrets, or personal data should be stored in scope intake."
    ],
    clarifyingQuestions: missingClarifications,
    evidenceGuidance: [
      "Use owned test accounts and benign markers only.",
      "Record evidence placeholders with role, timestamp, impact, confidence, and scope notes.",
      "Stop when evidence is sufficient for a safe report."
    ],
    redactionRequirements: [
      "Redact tokens, cookies, passwords, personal data, account identifiers, and internal hostnames.",
      "Store roles and rules, not credentials.",
      "Use placeholders for sensitive values."
    ],
    reportingNotes: [
      "Tie severity to program policy and business impact.",
      "Separate confirmed findings from hypotheses and blind spots.",
      "Include remediation guidance without overstating confidence."
    ]
  };
}

function cleanRequiredString(value: string, errorMessage: string): string {
  const cleaned = value.trim();
  if (cleaned.length === 0) {
    throw new Error(errorMessage);
  }
  return cleaned;
}

function cleanOptionalString(value: string | undefined): string | undefined {
  const cleaned = value?.trim();
  return cleaned && cleaned.length > 0 ? cleaned : undefined;
}

function cleanList(values: readonly string[]): readonly string[] {
  return values.map((value) => value.trim()).filter((value) => value.length > 0);
}

function hasDangerousSignal(value: string): boolean {
  const normalized = value.toLowerCase();
  const signals = [
    "ddos",
    "dos",
    "brute force",
    "credential stuffing",
    "password spraying",
    "bypass rate limit",
    "dump database",
    "dump data",
    "destructive",
    "persistence",
    "evade detection"
  ];

  return signals.some((signal) => {
    if (/^[a-z0-9]+$/.test(signal) && signal.length <= 3) {
      return new RegExp(`\\b${signal}\\b`, "i").test(normalized);
    }
    return normalized.includes(signal);
  });
}
