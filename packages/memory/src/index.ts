import { createHash, randomBytes } from "node:crypto";
import {
  appendFileSync,
  copyFileSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync
} from "node:fs";
import path from "node:path";
import type {
  AppliedPatchFile,
  ApplyPreflight,
  ApplyPreflightCheck,
  ApplyPreflightFilePlan,
  ApplyPreflightSummary,
  ApprovalCapabilityDecision,
  ApplyRecord,
  ApprovalDecision,
  ApprovalPolicyCheck,
  ApprovalPolicySnapshot,
  ApprovalRecord,
  AssistantAgentRole,
  AssistantRequestContext,
  BugBountyEvidenceInput,
  BugBountyEvidenceLedger,
  BugBountyEvidenceRecord,
  BugBountyReportDraftInput,
  BugBountyReportDraftRecord,
  BugBountySeverity,
  BugBountyScopeIntake,
  BugBountyScopeRecord,
  ConsoleRunSnapshot,
  DecisionLog,
  DecisionLogEntry,
  DecisionLogEntryType,
  DevelopmentProjectState,
  MoochackerAssessment,
  PatchChange,
  PatchProposal,
  RiskLevel,
  RunArtifactPaths,
  RunExportRecord,
  RunListItem,
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

const DEFAULT_APPROVAL_TTL_MS = 7 * 24 * 60 * 60 * 1000;

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
  readonly developmentProjectState?: DevelopmentProjectState;
  readonly decisionLog: DecisionLog;
  readonly nextRecommendedAction: string;
  readonly now?: Date;
}

export interface ApprovalDecisionInput {
  readonly reason?: string;
  readonly confirmRisk?: RiskLevel;
  readonly expiresAt?: Date;
  readonly now?: Date;
}

export interface AttachBugBountyScopeInput {
  readonly scope: BugBountyScopeIntake;
  readonly now?: Date;
}

export interface RecordBugBountyEvidenceInput {
  readonly evidence: BugBountyEvidenceInput;
  readonly now?: Date;
}

export interface DraftBugBountyReportInput {
  readonly draft: BugBountyReportDraftInput;
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

export interface ListRunsInput {
  readonly limit?: number;
}

export interface ExportRunInput {
  readonly now?: Date;
}

export interface ConsoleSnapshotInput {
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
    const artifactPaths = createArtifactPaths(runDir, {
      hasVerification: input.verificationResult !== undefined,
      hasProjectState: input.developmentProjectState !== undefined
    });

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
    if (artifactPaths.projectState && input.developmentProjectState) {
      writeJson(artifactPaths.projectState, input.developmentProjectState);
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

  listRuns(input: ListRunsInput = {}): readonly RunListItem[] {
    if (!existsSync(this.root)) {
      return [];
    }

    const limit = input.limit ?? 20;
    if (!Number.isInteger(limit) || limit <= 0) {
      throw new Error("Run list limit must be a positive integer.");
    }

    return readdirSync(this.root, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && isSafeRunId(entry.name))
      .map((entry) => readJson<RunMetadata>(path.join(this.root, entry.name, "metadata.json")))
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
      .slice(0, limit)
      .map((metadata) => ({
        id: metadata.id,
        status: metadata.status,
        selectedMode: metadata.selectedMode,
        proposalKind: metadata.proposalKind,
        proposalId: metadata.proposalId,
        createdAt: metadata.createdAt,
        updatedAt: metadata.updatedAt,
        input: metadata.input,
        requiresApproval: metadata.requiresApproval
      }));
  }

  exportRun(runId: string, input: ExportRunInput = {}): RunExportRecord {
    const now = input.now ?? new Date();
    const preview = this.loadPreview(runId);
    const outputPath = path.join(preview.artifactPaths.runDir, "export.md");
    const record: RunExportRecord = {
      runId,
      format: "markdown",
      outputPath,
      createdAt: now.toISOString(),
      summary: `Markdown audit export for ${preview.metadata.selectedMode} run ${runId}.`,
      nextRecommendedAction: "Review the exported audit summary before sharing it outside the local workspace."
    };

    writeFileSync(outputPath, renderRunExportMarkdown(preview, record), "utf8");
    appendJsonLine(preview.artifactPaths.decisionLog, {
      type: "run_exported",
      message: "Run audit summary was exported as Markdown.",
      data: {
        runId,
        format: record.format,
        outputPath: record.outputPath
      },
      timestamp: now.toISOString()
    } satisfies DecisionLogEntry);
    this.updateMetadata(preview, preview.metadata.status, now, { hasExport: true });

    return record;
  }

  createConsoleSnapshot(runId: string, input: ConsoleSnapshotInput = {}): ConsoleRunSnapshot {
    const now = input.now ?? new Date();
    return buildConsoleSnapshot(this.loadPreview(runId), now);
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

  recordBugBountyEvidence(runId: string, input: RecordBugBountyEvidenceInput): BugBountyEvidenceRecord {
    const now = input.now ?? new Date();
    const preview = this.loadPreview(runId);
    if (preview.proposal.kind !== "bug_bounty_review") {
      throw new Error(`Run ${runId} is not a bug bounty proposal (${preview.proposal.kind}).`);
    }
    if (!preview.bugBountyScope) {
      throw new Error(`Run ${runId} cannot record evidence before bug bounty scope intake is recorded.`);
    }
    if (preview.bugBountyScope.moochackerAssessment.safetyLevel === "blocked") {
      throw new Error(`Run ${runId} cannot record evidence because MoochackerAgent marked scope safety as blocked.`);
    }
    if (preview.bugBountyScope.moochackerAssessment.scopeStatus !== "sufficient" && input.evidence.status !== "blocked") {
      throw new Error(`Run ${runId} can only record blocked evidence until scope intake is sufficient.`);
    }

    const normalized = normalizeEvidence(input.evidence);
    const redacted = redactEvidence(normalized);
    const record: BugBountyEvidenceRecord = {
      ...redacted.value,
      id: createEvidenceLeadId(now),
      runId,
      recordedBy: "user",
      createdAt: now.toISOString(),
      requestResponse: {
        requestSummary: redacted.value.requestSummary,
        responseSummary: redacted.value.responseSummary,
        redactionApplied: true
      },
      redactionApplied: true,
      redactedFields: redacted.redactedFields,
      safetyNotes: [
        "Passive evidence ledger record only; Dure did not contact the target.",
        "Program scope and rules override this record.",
        "Use placeholders for credentials, tokens, personal data, and real user data."
      ]
    };
    const evidencePath = path.join(preview.artifactPaths.runDir, "evidence-ledger.jsonl");

    appendJsonLine(evidencePath, record);
    appendJsonLine(preview.artifactPaths.decisionLog, {
      type: "bug_bounty_evidence_recorded",
      message: "Bug bounty evidence ledger entry was recorded with redaction policy applied.",
      data: {
        runId,
        leadId: record.id,
        status: record.status,
        asset: record.asset,
        endpoint: record.endpoint,
        method: record.method,
        confidence: record.confidence,
        redactedFields: record.redactedFields,
        nextAction: record.nextAction
      },
      timestamp: now.toISOString()
    } satisfies DecisionLogEntry);
    this.updateMetadata(preview, preview.metadata.status, now, { hasEvidenceLedger: true });

    return record;
  }

  draftBugBountyReport(runId: string, input: DraftBugBountyReportInput): BugBountyReportDraftRecord {
    const now = input.now ?? new Date();
    const preview = this.loadPreview(runId);
    if (preview.proposal.kind !== "bug_bounty_review") {
      throw new Error(`Run ${runId} is not a bug bounty proposal (${preview.proposal.kind}).`);
    }
    if (!preview.bugBountyScope) {
      throw new Error(`Run ${runId} cannot draft a report before bug bounty scope intake is recorded.`);
    }
    const lead = preview.bugBountyEvidenceLedger?.entries.find((entry) => entry.id === input.draft.leadId);
    if (!lead) {
      throw new Error(`Evidence lead not found: ${input.draft.leadId}`);
    }
    if (lead.status === "blocked" || lead.status === "non-issue") {
      throw new Error(`Run ${runId} cannot draft a finding report from a ${lead.status} lead.`);
    }

    const severity = input.draft.severity ?? calibrateSeverity(lead);
    if (lead.status !== "confirmed" && (severity === "high" || severity === "critical")) {
      throw new Error("High or critical severity requires a confirmed evidence lead.");
    }

    const reportId = createReportDraftId(now);
    const reportsDir = path.join(preview.artifactPaths.runDir, "reports");
    const markdownPath = path.join(reportsDir, `${reportId}.md`);
    const recordPath = path.join(reportsDir, `${reportId}.json`);
    mkdirSync(reportsDir, { recursive: true });

    const affectedUsersOrRoles = normalizeReportList(input.draft.affectedUsersOrRoles, [
      lead.userRole,
      ...preview.bugBountyScope.testAccountRoles
    ]);
    const title = cleanOptionalString(input.draft.title)
      ?? defaultReportTitle(lead, severity);
    const record: BugBountyReportDraftRecord = {
      id: reportId,
      runId,
      leadId: lead.id,
      createdAt: now.toISOString(),
      title,
      severity,
      severityRationale: severityRationale(lead, severity),
      confidence: lead.confidence,
      affectedAsset: lead.asset,
      affectedEndpoint: lead.endpoint,
      affectedUsersOrRoles,
      summary: buildReportSummary(lead),
      impact: lead.impact,
      reproductionSteps: normalizeReportList(input.draft.reproductionSteps, defaultReproductionSteps(lead)),
      evidence: defaultEvidenceLines(lead),
      whyThisMatters: buildWhyThisMatters(lead),
      remediation: cleanOptionalString(input.draft.remediation) ?? defaultRemediation(lead),
      limitations: cleanOptionalString(input.draft.limitations) ?? defaultLimitations(lead),
      scopeNotes: cleanList([
        lead.scopeNote,
        lead.programRuleNotes,
        `In scope assets: ${preview.bugBountyScope.inScopeAssets.join(", ") || "not recorded"}.`,
        `Out of scope assets: ${preview.bugBountyScope.outOfScopeAssets.join(", ") || "not recorded"}.`,
        `Forbidden techniques: ${preview.bugBountyScope.forbiddenTechniques.join(", ") || "not recorded"}.`
      ]),
      suggestedRetest: "Retest with authorized accounts after remediation by repeating the minimal-impact steps and confirming the expected authorization or validation control is enforced.",
      duplicateRisk: input.draft.duplicateRisk ?? lead.status === "duplicate-risk",
      markdownPath,
      redactionApplied: true,
      safetyNotes: [
        "Report draft is generated from existing ledger evidence only.",
        "Dure did not send requests, scan targets, exploit issues, or validate the finding.",
        "Review program rules and remove sensitive data before submission."
      ],
      nextRecommendedAction: "Review the draft, confirm evidence and severity, then export or revise before submission."
    };

    writeJson(recordPath, record);
    writeFileSync(markdownPath, renderReportMarkdown(record), "utf8");
    appendJsonLine(preview.artifactPaths.decisionLog, {
      type: "bug_bounty_report_drafted",
      message: "Bug bounty report draft was generated from an evidence ledger entry.",
      data: {
        runId,
        reportId: record.id,
        leadId: record.leadId,
        title: record.title,
        severity: record.severity,
        confidence: record.confidence,
        duplicateRisk: record.duplicateRisk,
        markdownPath: record.markdownPath
      },
      timestamp: now.toISOString()
    } satisfies DecisionLogEntry);
    this.updateMetadata(preview, preview.metadata.status, now, { hasEvidenceLedger: true, hasReports: true });

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
    if (isExpiredApproval(preview.approvalRecord.expiresAt, now)) {
      throw new Error(`Run ${runId} approval expired at ${preview.approvalRecord.expiresAt}; create a fresh approval before apply.`);
    }
    if (preview.artifactPaths.apply && existsSync(preview.artifactPaths.apply)) {
      throw new Error(`Run ${runId} has already been applied.`);
    }

    const workspaceRoot = path.resolve(input.workspaceRoot ?? path.join(this.root, "..", "workspaces", runId));
    assertSafeWorkspaceRoot(workspaceRoot, this.root, preview.artifactPaths.runDir);
    const backupRoot = path.join(preview.artifactPaths.runDir, "backups", createApplyTimestamp(now), "files");
    const changes = preview.proposal.changes.map((change) => preparePatchChange(change, workspaceRoot, backupRoot));
    const preflight = buildApplyPreflight(preview, workspaceRoot, backupRoot, changes, now);
    const blockedCheck = preflight.checks.find((check) => check.status === "blocked");
    if (blockedCheck) {
      throw new Error(`Run ${runId} cannot be applied; ${blockedCheck.summary}`);
    }

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
      preflight,
      summary: preflight.summary,
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
        preflight: {
          summary: preflight.summary,
          checks: preflight.checks.map((check) => ({
            id: check.id,
            status: check.status,
            summary: check.summary
          }))
        },
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
      hasProjectState: existsSync(path.join(runDir, "project-state.json")),
      hasWorkspaceVerification: existsSync(path.join(runDir, "workspace-verification.json")),
      hasApproval: existsSync(path.join(runDir, "approval.json")),
      hasScope: existsSync(path.join(runDir, "scope.json")),
      hasEvidenceLedger: existsSync(path.join(runDir, "evidence-ledger.jsonl")),
      hasReports: existsSync(path.join(runDir, "reports")),
      hasExport: existsSync(path.join(runDir, "export.md")),
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
    const developmentProjectState = artifactPaths.projectState && existsSync(artifactPaths.projectState)
      ? readJson<DevelopmentProjectState>(artifactPaths.projectState)
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
    const bugBountyEvidenceLedger = artifactPaths.evidenceLedger && existsSync(artifactPaths.evidenceLedger)
      ? readEvidenceLedger(artifactPaths.evidenceLedger)
      : undefined;
    const bugBountyReportDrafts = artifactPaths.reports && existsSync(artifactPaths.reports)
      ? readReportDrafts(artifactPaths.reports)
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
      developmentProjectState,
      workspaceVerificationRecord,
      approvalRecord,
      bugBountyScope,
      bugBountyEvidenceLedger,
      bugBountyReportDrafts,
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
    const policy = decision === "approved"
      ? buildApprovalPolicySnapshot(preview, input.confirmRisk)
      : buildRejectionPolicySnapshot(preview);
    const failedCheck = policy.checklist.find((check) => check.status === "failed");
    if (decision === "approved" && failedCheck) {
      throw new Error(`Run ${runId} cannot be approved; ${failedCheck.summary}`);
    }
    const expiresAt = decision === "approved"
      ? (input.expiresAt ?? new Date(now.getTime() + DEFAULT_APPROVAL_TTL_MS)).toISOString()
      : undefined;
    if (decision === "approved" && expiresAt && Date.parse(expiresAt) <= now.getTime()) {
      throw new Error(`Run ${runId} approval expiration must be in the future.`);
    }
    const record: ApprovalRecord = {
      runId,
      proposalId: preview.metadata.proposalId,
      decision,
      decidedBy: "user",
      reason: cleanOptionalString(input.reason),
      createdAt: now.toISOString(),
      expiresAt,
      previousStatus: preview.metadata.status,
      nextStatus,
      policy,
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
        expiresAt: record.expiresAt,
        previousStatus: record.previousStatus,
        nextStatus: record.nextStatus,
        approvalPolicy: record.policy
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
      readonly hasEvidenceLedger?: boolean;
      readonly hasReports?: boolean;
      readonly hasExport?: boolean;
      readonly hasApply?: boolean;
      readonly hasRollback?: boolean;
      readonly hasWorkspaceVerification?: boolean;
      readonly hasProjectState?: boolean;
    }
  ): void {
    const artifactPaths = createArtifactPaths(preview.artifactPaths.runDir, {
      hasVerification: preview.artifactPaths.verification !== undefined,
      hasProjectState: options.hasProjectState ?? preview.artifactPaths.projectState !== undefined,
      hasWorkspaceVerification:
        options.hasWorkspaceVerification ?? preview.artifactPaths.workspaceVerification !== undefined,
      hasApproval: options.hasApproval ?? preview.artifactPaths.approval !== undefined,
      hasScope: options.hasScope ?? preview.artifactPaths.scope !== undefined,
      hasEvidenceLedger: options.hasEvidenceLedger ?? preview.artifactPaths.evidenceLedger !== undefined,
      hasReports: options.hasReports ?? preview.artifactPaths.reports !== undefined,
      hasExport: options.hasExport ?? preview.artifactPaths.export !== undefined,
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

function buildApprovalPolicySnapshot(preview: RunPreview, confirmedRisk?: RiskLevel): ApprovalPolicySnapshot {
  const proposal = preview.proposal;
  const patch = proposal.kind === "patch" ? proposal : undefined;
  const previewRiskLevel = patch?.preview?.riskAssessment.overallRisk;
  const riskLevel = previewRiskLevel ?? proposal.riskLevel;
  const separateApprovalRequired = patch?.preview?.riskAssessment.separateApprovalRequired ?? hasDeleteChange(patch);
  const confirmationRequired = riskLevel !== "low" || separateApprovalRequired;
  const requiredRiskConfirmation = confirmationRequired ? riskLevel : undefined;
  const hasMatchingConfirmation = !confirmationRequired || confirmedRisk === riskLevel;
  const checklist: ApprovalPolicyCheck[] = [
    {
      id: "patch-proposal",
      status: patch ? "passed" : "failed",
      summary: patch ? "Run contains a patch proposal." : `Run is not a patch proposal (${proposal.kind}).`
    },
    {
      id: "single-writer",
      status: patch?.policy.singleWriter === true && isAllowedPatchWriter(patch) ? "passed" : "failed",
      summary:
        patch?.policy.singleWriter === true && isAllowedPatchWriter(patch)
          ? `Patch was proposed by ${patch.author} under Single Writer policy.`
          : "Patch proposal does not satisfy Single Writer policy."
    },
    {
      id: "verification-accepted",
      status: preview.verificationResult?.accepted === true ? "passed" : "failed",
      summary:
        preview.verificationResult?.accepted === true
          ? "Proposal-time verification accepted the patch."
          : "Proposal-time verification has not accepted the patch."
    },
    {
      id: "risk-confirmation",
      status: hasMatchingConfirmation ? "passed" : "failed",
      summary: confirmationRequired
        ? confirmedRisk === riskLevel
          ? `User confirmed ${riskLevel} patch risk.`
          : `Patch risk is ${riskLevel}; rerun approve with --confirm-risk ${riskLevel}.`
        : "Low-risk patch does not require explicit risk confirmation."
    },
    {
      id: "separate-approval",
      status: !separateApprovalRequired || hasMatchingConfirmation ? "passed" : "failed",
      summary: separateApprovalRequired
        ? "Patch contains a separate-approval condition and requires matching risk confirmation."
        : "Patch does not contain separate-approval conditions."
    }
  ];

  return {
    riskLevel,
    previewRiskLevel,
    separateApprovalRequired,
    confirmationRequired,
    requiredRiskConfirmation,
    providedRiskConfirmation: confirmedRisk,
    checklist,
    capabilityDecisions: buildCapabilityDecisions(preview)
  };
}

function buildRejectionPolicySnapshot(preview: RunPreview): ApprovalPolicySnapshot {
  return {
    riskLevel: preview.proposal.riskLevel,
    previewRiskLevel: preview.proposal.kind === "patch" ? preview.proposal.preview?.riskAssessment.overallRisk : undefined,
    separateApprovalRequired: preview.proposal.kind === "patch"
      ? preview.proposal.preview?.riskAssessment.separateApprovalRequired ?? hasDeleteChange(preview.proposal)
      : false,
    confirmationRequired: false,
    checklist: [
      {
        id: "manual-rejection",
        status: "passed",
        summary: "User rejected the proposal before apply."
      }
    ],
    capabilityDecisions: buildCapabilityDecisions(preview)
  };
}

function buildCapabilityDecisions(preview: RunPreview): readonly ApprovalCapabilityDecision[] {
  return preview.context.requiredCapabilities.map((capability) => {
    const requiresApproval = capabilityRequiresApproval(capability) || preview.safetyDecision.requiresApproval;
    return {
      capability,
      requiresApproval,
      rationale: requiresApproval
        ? "Capability is gated by explicit user approval before execution or file changes."
        : "Capability is passive in v0.1 and does not require an execution approval."
    };
  });
}

function capabilityRequiresApproval(capability: string): boolean {
  return [
    "propose_file_changes",
    "apply_file_changes",
    "run_tests_placeholder",
    "run_local_commands_placeholder",
    "dependency_audit_placeholder",
    "external_scan_placeholder"
  ].includes(capability);
}

function isAllowedPatchWriter(proposal: PatchProposal): boolean {
  return proposal.author === "BuilderAgent" || proposal.author === "BuilderRuntime";
}

function hasDeleteChange(proposal: PatchProposal | undefined): boolean {
  return proposal?.changes.some((change) => change.operation === "delete") ?? false;
}

function isExpiredApproval(expiresAt: string | undefined, now: Date): boolean {
  if (!expiresAt) {
    return false;
  }
  const expires = Date.parse(expiresAt);
  if (!Number.isFinite(expires)) {
    return true;
  }
  return expires <= now.getTime();
}

export function createRunId(now = new Date()): string {
  const timestamp = now
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}Z$/, "Z")
    .replace("T", "-");
  return `run-${timestamp}-${randomBytes(3).toString("hex")}`;
}

export function createEvidenceLeadId(now = new Date()): string {
  const timestamp = now
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}Z$/, "Z")
    .replace("T", "-");
  return `lead-${timestamp}-${randomBytes(3).toString("hex")}`;
}

export function createReportDraftId(now = new Date()): string {
  const timestamp = now
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}Z$/, "Z")
    .replace("T", "-");
  return `report-${timestamp}-${randomBytes(3).toString("hex")}`;
}

export function isSafeRunId(runId: string): boolean {
  return /^run-\d{8}-\d{6}Z-[0-9a-f]{6}$/.test(runId);
}

function createArtifactPaths(
  runDir: string,
  options: boolean | {
    readonly hasVerification?: boolean;
    readonly hasProjectState?: boolean;
    readonly hasWorkspaceVerification?: boolean;
    readonly hasApproval?: boolean;
    readonly hasScope?: boolean;
    readonly hasEvidenceLedger?: boolean;
    readonly hasReports?: boolean;
    readonly hasExport?: boolean;
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
    projectState: normalized.hasProjectState ? path.join(runDir, "project-state.json") : undefined,
    workspaceVerification: normalized.hasWorkspaceVerification
      ? path.join(runDir, "workspace-verification.json")
      : undefined,
    approval: normalized.hasApproval ? path.join(runDir, "approval.json") : undefined,
    scope: normalized.hasScope ? path.join(runDir, "scope.json") : undefined,
    evidenceLedger: normalized.hasEvidenceLedger ? path.join(runDir, "evidence-ledger.jsonl") : undefined,
    reports: normalized.hasReports ? path.join(runDir, "reports") : undefined,
    export: normalized.hasExport ? path.join(runDir, "export.md") : undefined,
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

function readEvidenceLedger(filePath: string): BugBountyEvidenceLedger {
  let source: string;
  try {
    source = readFileSync(filePath, "utf8").trim();
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return { entries: [] };
    }
    throw error;
  }

  if (source.length === 0) {
    return { entries: [] };
  }

  try {
    return {
      entries: source.split("\n").map((line) => JSON.parse(line) as BugBountyEvidenceRecord)
    };
  } catch {
    throw new Error("Malformed run artifact: evidence-ledger.jsonl.");
  }
}

function readReportDrafts(reportsDir: string): readonly BugBountyReportDraftRecord[] {
  try {
    return readdirSync(reportsDir)
      .filter((fileName) => fileName.endsWith(".json"))
      .map((fileName) => readJson<BugBountyReportDraftRecord>(path.join(reportsDir, fileName)))
      .sort((left, right) => left.createdAt.localeCompare(right.createdAt));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return [];
    }
    throw error;
  }
}

function buildApplyPreflight(
  preview: RunPreview,
  workspaceRoot: string,
  backupRoot: string,
  changes: readonly PreparedPatchChange[],
  now: Date
): ApplyPreflight {
  const files = changes.map((change) => buildApplyPreflightFilePlan(change));
  const summary = buildApplyPreflightSummary(files);
  const checks: ApplyPreflightCheck[] = [
    {
      id: "approval-record",
      status: preview.approvalRecord?.decision === "approved" ? "passed" : "blocked",
      summary: preview.approvalRecord?.decision === "approved"
        ? "Run has an approved approval record."
        : "Run does not have an approved approval record."
    },
    {
      id: "approval-expiration",
      status: isExpiredApproval(preview.approvalRecord?.expiresAt, now) ? "blocked" : "passed",
      summary: preview.approvalRecord?.expiresAt
        ? `Approval is valid until ${preview.approvalRecord.expiresAt}.`
        : "Approval has no expiration timestamp; legacy approvals remain accepted in v0.1."
    },
    {
      id: "proposal-verification",
      status: preview.verificationResult?.accepted === true ? "passed" : "blocked",
      summary: preview.verificationResult?.accepted === true
        ? "Proposal-time verification accepted this patch."
        : "Proposal-time verification has not accepted this patch."
    },
    {
      id: "workspace-root",
      status: "passed",
      summary: `Workspace root is controlled and outside the run store: ${workspaceRoot}.`
    },
    {
      id: "allowed-operations",
      status: changes.every((change) => change.operation === "create" || change.operation === "modify")
        ? "passed"
        : "blocked",
      summary: "Controlled apply allows create and modify operations only."
    },
    {
      id: "file-plan",
      status: files.length > 0 ? "passed" : "blocked",
      summary: `Prepared ${summary.totalFiles} file change${summary.totalFiles === 1 ? "" : "s"} with ${summary.backupsPlanned} backup${summary.backupsPlanned === 1 ? "" : "s"} planned.`
    }
  ];

  return {
    checkedAt: now.toISOString(),
    workspaceRoot,
    backupRoot,
    approvalExpiresAt: preview.approvalRecord?.expiresAt,
    checks,
    files,
    summary
  };
}

function buildApplyPreflightFilePlan(change: PreparedPatchChange): ApplyPreflightFilePlan {
  return {
    path: change.relativePath,
    operation: change.operation,
    targetPath: change.targetPath,
    previousExists: change.previousExists,
    backupPlanned: change.backupPath !== undefined,
    proposedHash: sha256(Buffer.from(change.content, "utf8"))
  };
}

function buildApplyPreflightSummary(files: readonly ApplyPreflightFilePlan[]): ApplyPreflightSummary {
  return {
    totalFiles: files.length,
    creates: files.filter((file) => file.operation === "create").length,
    modifies: files.filter((file) => file.operation === "modify").length,
    backupsPlanned: files.filter((file) => file.backupPlanned).length
  };
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

function assertSafeWorkspaceRoot(workspaceRoot: string, runStoreRoot: string, runDir: string): void {
  const resolvedWorkspaceRoot = path.resolve(workspaceRoot);
  const resolvedRunStoreRoot = path.resolve(runStoreRoot);
  const resolvedRunDir = path.resolve(runDir);

  if (isPathInside(resolvedRunStoreRoot, resolvedWorkspaceRoot) || isPathInside(resolvedRunDir, resolvedWorkspaceRoot)) {
    throw new Error(`Workspace root must be outside the run store: ${workspaceRoot}`);
  }
  if (path.basename(resolvedWorkspaceRoot) === ".git" || resolvedWorkspaceRoot.split(path.sep).includes(".git")) {
    throw new Error(`Workspace root must not be inside a git metadata directory: ${workspaceRoot}`);
  }
  if (existsSync(resolvedWorkspaceRoot)) {
    const rootStat = lstatSync(resolvedWorkspaceRoot);
    if (rootStat.isSymbolicLink()) {
      throw new Error(`Workspace root must not be a symbolic link: ${workspaceRoot}`);
    }
    if (!rootStat.isDirectory()) {
      throw new Error(`Workspace root must be a directory: ${workspaceRoot}`);
    }
  }

  assertNoSymlinkInExistingPath(resolvedWorkspaceRoot);
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

function assertNoSymlinkInExistingPath(targetPath: string): void {
  const resolved = path.resolve(targetPath);
  const parsed = path.parse(resolved);
  const segments = path.relative(parsed.root, resolved).split(path.sep).filter((segment) => segment.length > 0);
  let current = parsed.root;

  for (const segment of segments) {
    current = path.join(current, segment);
    if (!existsSync(current)) {
      return;
    }
    if (lstatSync(current).isSymbolicLink()) {
      throw new Error(`Workspace path uses a symbolic link and is not allowed: ${targetPath}`);
    }
  }
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

interface RedactedEvidence {
  readonly value: BugBountyEvidenceInput;
  readonly redactedFields: readonly string[];
}

interface RedactedText {
  readonly value: string;
  readonly redacted: boolean;
}

const EVIDENCE_REDACTION_PATTERNS: readonly {
  readonly pattern: RegExp;
  readonly replacement: string;
}[] = [
  { pattern: /\b(authorization|cookie|set-cookie)\s*:\s*[^\r\n]+/gi, replacement: "[redacted-secret]" },
  {
    pattern: /\b(api[_-]?key|secret|token|password|session|csrf)\s*[:=]\s*["']?[^"'\s,;]{6,}["']?/gi,
    replacement: "[redacted-secret]"
  },
  { pattern: /\bbearer\s+[A-Za-z0-9._~+/=-]{8,}/gi, replacement: "[redacted-secret]" },
  { pattern: /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, replacement: "[redacted-email]" }
];

function normalizeEvidence(input: BugBountyEvidenceInput): BugBountyEvidenceInput {
  return {
    status: input.status,
    asset: cleanRequiredString(input.asset, "Evidence asset is required."),
    endpoint: cleanOptionalString(input.endpoint),
    method: input.method,
    authState: cleanOptionalString(input.authState),
    userRole: cleanOptionalString(input.userRole),
    objectOwnership: cleanOptionalString(input.objectOwnership),
    hypothesis: cleanRequiredString(input.hypothesis, "Evidence hypothesis is required."),
    testPerformed: cleanOptionalString(input.testPerformed),
    requestSummary: cleanOptionalString(input.requestSummary),
    responseSummary: cleanOptionalString(input.responseSummary),
    evidence: cleanOptionalString(input.evidence),
    impact: cleanRequiredString(input.impact, "Evidence impact is required."),
    confidence: input.confidence,
    scopeNote: cleanRequiredString(input.scopeNote, "Evidence scope note is required."),
    programRuleNotes: cleanOptionalString(input.programRuleNotes),
    nextAction: cleanRequiredString(input.nextAction, "Evidence next action is required.")
  };
}

function redactEvidence(input: BugBountyEvidenceInput): RedactedEvidence {
  const redactedFields: string[] = [];
  const redact = (field: keyof BugBountyEvidenceInput, value: string | undefined): string | undefined => {
    if (value === undefined) {
      return undefined;
    }
    const redacted = redactEvidenceText(value);
    if (redacted.redacted) {
      redactedFields.push(field);
    }
    return redacted.value;
  };

  return {
    value: {
      status: input.status,
      asset: redact("asset", input.asset) ?? input.asset,
      endpoint: redact("endpoint", input.endpoint),
      method: input.method,
      authState: redact("authState", input.authState),
      userRole: redact("userRole", input.userRole),
      objectOwnership: redact("objectOwnership", input.objectOwnership),
      hypothesis: redact("hypothesis", input.hypothesis) ?? input.hypothesis,
      testPerformed: redact("testPerformed", input.testPerformed),
      requestSummary: redact("requestSummary", input.requestSummary),
      responseSummary: redact("responseSummary", input.responseSummary),
      evidence: redact("evidence", input.evidence),
      impact: redact("impact", input.impact) ?? input.impact,
      confidence: input.confidence,
      scopeNote: redact("scopeNote", input.scopeNote) ?? input.scopeNote,
      programRuleNotes: redact("programRuleNotes", input.programRuleNotes),
      nextAction: redact("nextAction", input.nextAction) ?? input.nextAction
    },
    redactedFields: [...new Set(redactedFields)]
  };
}

function redactEvidenceText(value: string): RedactedText {
  const redacted = EVIDENCE_REDACTION_PATTERNS.reduce((current, item) => {
    item.pattern.lastIndex = 0;
    return current.replace(item.pattern, item.replacement);
  }, value);
  return {
    value: redacted,
    redacted: redacted !== value
  };
}

function calibrateSeverity(lead: BugBountyEvidenceRecord): BugBountySeverity {
  if (lead.status === "duplicate-risk") {
    return "low";
  }
  if (lead.status !== "confirmed") {
    return lead.confidence === "high" ? "medium" : "informational";
  }

  const impact = lead.impact.toLowerCase();
  if (impact.includes("admin") || impact.includes("write") || impact.includes("account takeover")) {
    return "high";
  }
  if (impact.includes("cross-account") || impact.includes("cross tenant") || impact.includes("authorization")) {
    return "medium";
  }
  if (impact.includes("exposure") || impact.includes("read")) {
    return "medium";
  }
  return "low";
}

function severityRationale(lead: BugBountyEvidenceRecord, severity: BugBountySeverity): string {
  if (lead.status !== "confirmed") {
    return `Severity is conservative because the lead status is ${lead.status} and confidence is ${lead.confidence}.`;
  }
  return `Severity is based on recorded impact, confidence ${lead.confidence}, affected role ${lead.userRole ?? "not recorded"}, and program-specific rules still needing maintainer review.`;
}

function defaultReportTitle(lead: BugBountyEvidenceRecord, severity: BugBountySeverity): string {
  const prefix = lead.status === "confirmed" ? "Confirmed" : "Potential";
  const endpoint = lead.endpoint ? ` at ${lead.endpoint}` : "";
  return `${prefix} ${severity} issue on ${lead.asset}${endpoint}`;
}

function buildReportSummary(lead: BugBountyEvidenceRecord): string {
  return [
    `This draft is generated from Dure evidence lead ${lead.id}.`,
    `The recorded hypothesis is: ${lead.hypothesis}`,
    `Current status is ${lead.status} with ${lead.confidence} confidence; Dure has not performed active testing or independent validation.`
  ].join(" ");
}

function defaultReproductionSteps(lead: BugBountyEvidenceRecord): readonly string[] {
  return [
    `Start from an authorized test account with role: ${lead.userRole ?? "role not recorded"}.`,
    `Use the in-scope asset ${lead.asset}${lead.endpoint ? ` and endpoint ${lead.endpoint}` : ""}.`,
    lead.testPerformed ?? "Repeat the minimal-impact test described in the evidence ledger.",
    "Compare the observed result with the expected authorization or validation behavior.",
    "Stop once the issue is proven enough to report safely; do not access real user data."
  ];
}

function defaultEvidenceLines(lead: BugBountyEvidenceRecord): readonly string[] {
  return cleanList([
    `Lead status: ${lead.status}.`,
    `Confidence: ${lead.confidence}.`,
    lead.requestSummary ? `Request: ${lead.requestSummary}` : undefined,
    lead.responseSummary ? `Response: ${lead.responseSummary}` : undefined,
    lead.evidence ? `Evidence note: ${lead.evidence}` : undefined,
    `Recorded at: ${lead.createdAt}.`
  ]);
}

function buildWhyThisMatters(lead: BugBountyEvidenceRecord): string {
  return `If confirmed, this matters because the recorded impact is: ${lead.impact}`;
}

function defaultRemediation(lead: BugBountyEvidenceRecord): string {
  const endpoint = lead.endpoint ? ` for ${lead.endpoint}` : "";
  return `Review the authorization, validation, and object ownership checks${endpoint}. Enforce server-side access control for the affected role and add regression tests for the recorded scenario.`;
}

function defaultLimitations(lead: BugBountyEvidenceRecord): string {
  const statusNote = lead.status === "confirmed"
    ? "The lead is marked confirmed in the ledger, but severity and program-specific impact still require human review."
    : `The lead is not confirmed; current status is ${lead.status}.`;
  return `${statusNote} Dure generated this draft from stored evidence only and did not send requests, run scanners, exploit issues, or independently validate the finding.`;
}

function normalizeReportList(
  input: readonly string[] | undefined,
  fallback: readonly (string | undefined)[]
): readonly string[] {
  const source = input && input.length > 0 ? input : fallback;
  const cleaned = source
    .filter((value): value is string => value !== undefined)
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
  return [...new Set(cleaned)];
}

function renderReportMarkdown(record: BugBountyReportDraftRecord): string {
  return [
    `# ${markdownLine(record.title)}`,
    "",
    `- Report ID: ${record.id}`,
    `- Lead ID: ${record.leadId}`,
    `- Severity: ${record.severity}`,
    `- Confidence: ${record.confidence}`,
    `- Duplicate risk: ${record.duplicateRisk ? "yes" : "no"}`,
    `- Affected asset: ${markdownLine(record.affectedAsset)}`,
    `- Affected endpoint/function: ${markdownLine(record.affectedEndpoint ?? "not recorded")}`,
    `- Affected users/roles: ${record.affectedUsersOrRoles.map(markdownLine).join(", ") || "not recorded"}`,
    "",
    "## Summary",
    "",
    markdownParagraph(record.summary),
    "",
    "## Impact",
    "",
    markdownParagraph(record.impact),
    "",
    "## Reproduction Steps",
    "",
    ...record.reproductionSteps.map((step, index) => `${index + 1}. ${markdownLine(step)}`),
    "",
    "## Evidence",
    "",
    ...record.evidence.map((item) => `- ${markdownLine(item)}`),
    "",
    "## Why This Is A Security Issue",
    "",
    markdownParagraph(record.whyThisMatters),
    "",
    "## Recommended Remediation",
    "",
    markdownParagraph(record.remediation),
    "",
    "## Limitations And Scope Notes",
    "",
    markdownParagraph(record.limitations),
    "",
    ...record.scopeNotes.map((note) => `- ${markdownLine(note)}`),
    "",
    "## Suggested Retest",
    "",
    markdownParagraph(record.suggestedRetest),
    "",
    "## Safety Notes",
    "",
    ...record.safetyNotes.map((note) => `- ${markdownLine(note)}`),
    ""
  ].join("\n");
}

function markdownLine(value: string): string {
  return value.replace(/\r?\n/g, " ").trim();
}

function markdownParagraph(value: string): string {
  return markdownLine(value);
}

function buildConsoleSnapshot(preview: RunPreview, now: Date): ConsoleRunSnapshot {
  const proposal = preview.proposal;
  const bugBountyAssessment = preview.bugBountyScope?.moochackerAssessment
    ?? (proposal.kind === "bug_bounty_review" ? proposal.moochackerAssessment : undefined);

  return {
    version: "0.1.0",
    generatedAt: now.toISOString(),
    source: {
      kind: "dure-console-data",
      readOnly: true,
      redacted: true
    },
    run: {
      id: preview.metadata.id,
      status: preview.metadata.status,
      selectedMode: preview.metadata.selectedMode,
      proposalKind: preview.metadata.proposalKind,
      proposalId: preview.metadata.proposalId,
      createdAt: preview.metadata.createdAt,
      updatedAt: preview.metadata.updatedAt,
      input: redactedExportText(preview.request.originalInput),
      requiresApproval: preview.metadata.requiresApproval,
      nextRecommendedAction: redactedExportText(preview.metadata.nextRecommendedAction)
    },
    routing: {
      inferredIntent: redactedExportText(preview.context.inferredIntent),
      confidenceScore: preview.context.confidenceScore,
      assumptions: redactedConsoleList(preview.context.assumptions),
      requiredCapabilities: preview.context.requiredCapabilities,
      safetyRequirements: redactedConsoleList(preview.context.safetyRequirements),
      requiresUserApproval: preview.context.requiresUserApproval,
      requiresExternalTools: preview.context.requiresExternalTools,
      rejectedModes: preview.context.rejectedModes
    },
    agents: preview.metadata.selectedAgentTeam.map((agent) => ({
      name: agent,
      status: consoleAgentStatus(agent),
      summary: consoleAgentSummary(agent)
    })),
    proposal: {
      id: proposal.id,
      kind: proposal.kind,
      summary: redactedExportText(proposal.summary),
      riskLevel: proposal.riskLevel,
      requiresApproval: proposal.requiresApproval,
      assumptions: redactedConsoleList(proposal.assumptions),
      nextActions: redactedConsoleList(proposal.nextActions)
    },
    safety: {
      allowed: preview.safetyDecision.allowed,
      requiresApproval: preview.safetyDecision.requiresApproval,
      externalToolsRequired: preview.safetyDecision.externalToolsRequired,
      summary: redactedExportText(preview.safetyDecision.summary),
      blockedCapabilities: preview.safetyDecision.blockedCapabilities,
      details: redactedConsoleList(preview.safetyDecision.details)
    },
    verification: {
      proposalAccepted: preview.verificationResult?.accepted,
      workspaceAccepted: preview.workspaceVerificationRecord?.accepted,
      checks: consoleVerificationChecks(preview)
    },
    projectState: preview.developmentProjectState
      ? {
          packageManager: preview.developmentProjectState.packageManager,
          languages: preview.developmentProjectState.languages,
          frameworks: preview.developmentProjectState.frameworks,
          configuredScripts: preview.developmentProjectState.scripts
            .filter((script) => script.configured)
            .map((script) => script.name),
          missingScripts: preview.developmentProjectState.scripts
            .filter((script) => !script.configured)
            .map((script) => script.name),
          currentMvpStage: {
            id: preview.developmentProjectState.currentMvpStage.stage.id,
            name: preview.developmentProjectState.currentMvpStage.stage.name,
            confidence: preview.developmentProjectState.currentMvpStage.confidence,
            rationale: redactedExportText(preview.developmentProjectState.currentMvpStage.rationale)
          },
          fileCount: preview.developmentProjectState.fileIndex.totalFiles,
          sampledFiles: preview.developmentProjectState.fileIndex.sampledFiles.slice(0, 24).map(markdownLine),
          notes: redactedConsoleList(preview.developmentProjectState.notes)
        }
      : undefined,
    development: proposal.kind === "patch"
      ? {
          stage: `${proposal.stage.id}: ${redactedExportText(proposal.stage.name)}`,
          patchChanges: proposal.changes.map((change) => ({
            path: markdownLine(change.path),
            operation: change.operation,
            rationale: redactedExportText(change.rationale)
          })),
          patchPreview: proposal.preview
            ? {
                summary: redactedExportText(proposal.preview.summary),
                riskAssessment: proposal.preview.riskAssessment,
                changePlan: proposal.preview.changePlan.map((change) => ({
                  ...change,
                  purpose: redactedExportText(change.purpose),
                  expectedImpact: redactedExportText(change.expectedImpact),
                  reviewFocus: redactedConsoleList(change.reviewFocus)
                })),
                unifiedDiff: proposal.preview.unifiedDiff
              }
            : undefined,
          approval: preview.approvalRecord?.decision,
          appliedFiles: preview.applyRecord?.files.length ?? 0
        }
      : undefined,
    bugBounty: preview.metadata.selectedMode === "bug_bounty" || proposal.kind === "bug_bounty_review"
      ? {
          target: preview.bugBountyScope?.target ? redactedExportText(preview.bugBountyScope.target) : undefined,
          scopeStatus: bugBountyAssessment?.scopeStatus,
          safetyLevel: bugBountyAssessment?.safetyLevel,
          evidenceLeads: preview.bugBountyEvidenceLedger?.entries.length ?? 0,
          reportDrafts: preview.bugBountyReportDrafts?.length ?? 0,
          stopConditions: proposal.kind === "bug_bounty_review" ? redactedConsoleList(proposal.stopConditions) : []
        }
      : undefined,
    artifacts: {
      hasApproval: preview.approvalRecord !== undefined,
      hasApply: preview.applyRecord !== undefined,
      hasWorkspaceVerification: preview.workspaceVerificationRecord !== undefined,
      hasScope: preview.bugBountyScope !== undefined,
      hasEvidenceLedger: preview.bugBountyEvidenceLedger !== undefined,
      hasReports: (preview.bugBountyReportDrafts?.length ?? 0) > 0,
      hasMarkdownExport: preview.artifactPaths.export !== undefined,
      hasProjectState: preview.developmentProjectState !== undefined
    },
    decisions: preview.decisionLog.entries.map((entry) => ({
      type: entry.type,
      message: redactedExportText(entry.message),
      timestamp: entry.timestamp
    }))
  };
}

function consoleVerificationChecks(preview: RunPreview): ConsoleRunSnapshot["verification"]["checks"] {
  return [
    ...(preview.verificationResult?.checks.map((check) => ({
      name: check.name,
      status: check.passed ? "passed" : "failed",
      mocked: check.mocked,
      summary: redactedExportText(check.summary)
    })) ?? []),
    ...(preview.workspaceVerificationRecord?.commands.map((command) => ({
      name: command.name,
      status: command.status,
      mocked: false,
      summary: command.configured ? `Configured package script: ${command.name}` : `Package script not configured: ${command.name}`
    })) ?? [])
  ];
}

function redactedConsoleList(values: readonly string[]): readonly string[] {
  return values.map(redactedExportText);
}

function consoleAgentStatus(agent: AssistantAgentRole): "active" | "reviewing" | "guarding" {
  if (agent === "MoochackerAgent" || agent === "ScopeGuardAgent" || agent === "SecurityAgent" || agent === "SecurityReviewAgent") {
    return "guarding";
  }
  if (agent === "ReviewerAgent" || agent === "TesterAgent" || agent === "MaintainerAgent") {
    return "reviewing";
  }
  return "active";
}

function consoleAgentSummary(agent: AssistantAgentRole): string {
  switch (agent) {
    case "MoochackerAgent":
      return "Reviews authorization, scope boundaries, redaction, and bug bounty stop conditions.";
    case "ScopeGuardAgent":
      return "Keeps bug bounty work inside user-provided scope and program rules.";
    case "EvidenceAgent":
      return "Structures passive evidence ledger records without contacting targets.";
    case "BuilderAgent":
      return "Owns controlled patch proposals under Single Writer, Multi Reviewer policy.";
    case "ReviewerAgent":
      return "Reviews proposal quality, safety, and maintainability before acceptance.";
    case "MaintainerAgent":
      return "Checks long-term maintainability, rollback expectations, and audit clarity.";
    case "TesterAgent":
      return "Checks test expectations and verification readiness.";
    case "SecurityAgent":
    case "SecurityReviewAgent":
      return "Checks security assumptions, blocked capabilities, and safe next actions.";
    case "ArchitectAgent":
      return "Reviews boundaries, sequencing, and implementation shape.";
    case "ProductAgent":
      return "Reduces scope to the smallest valuable next step.";
    case "IntentAgent":
    case "RouterAgent":
      return "Interprets the user request and selected mode.";
    case "DocumentationAgent":
      return "Turns decisions into readable project documentation.";
    case "OperationsAgent":
      return "Plans operational checks without running external systems.";
    case "ProductivityAgent":
      return "Structures personal productivity tasks without external integrations.";
    case "BugBountyAgent":
      return "Coordinates authorized bug bounty planning with passive safety gates.";
    case "AssistantAgent":
      return "Handles general assistant planning and responses.";
  }
}

function renderRunExportMarkdown(preview: RunPreview, record: RunExportRecord): string {
  const evidenceEntries = preview.bugBountyEvidenceLedger?.entries ?? [];
  const reports = preview.bugBountyReportDrafts ?? [];
  const policyViolations = preview.safetyDecision.policyEvaluation?.violations ?? [];

  return [
    `# Dure Run Export: ${preview.metadata.id}`,
    "",
    "## Export",
    "",
    `- Format: ${record.format}`,
    `- Created at: ${record.createdAt}`,
    `- Output path: ${markdownLine(record.outputPath)}`,
    "",
    "## Run",
    "",
    `- Status: ${preview.metadata.status}`,
    `- Mode: ${preview.metadata.selectedMode}`,
    `- Proposal: ${preview.metadata.proposalId} (${preview.metadata.proposalKind})`,
    `- Created at: ${preview.metadata.createdAt}`,
    `- Updated at: ${preview.metadata.updatedAt}`,
    `- Requires approval: ${preview.metadata.requiresApproval ? "yes" : "no"}`,
    "",
    "## Request",
    "",
    markdownParagraph(redactedExportText(preview.request.originalInput)),
    "",
    "## Proposal",
    "",
    ...proposalExportLines(preview.proposal),
    "",
    "## Safety",
    "",
    `- Allowed: ${preview.safetyDecision.allowed ? "yes" : "no"}`,
    `- Requires approval: ${preview.safetyDecision.requiresApproval ? "yes" : "no"}`,
    `- Summary: ${markdownLine(preview.safetyDecision.summary)}`,
    `- Blocked capabilities: ${exportList(preview.safetyDecision.blockedCapabilities)}`,
    `- Policy violations: ${policyViolations.length}`,
    ...policyViolations.map((violation) => `- ${violation.severity}: ${markdownLine(violation.message)}`),
    "",
    "## Verification",
    "",
    ...verificationExportLines(preview),
    "",
    "## Bug Bounty Artifacts",
    "",
    `- Scope: ${preview.bugBountyScope ? redactedExportText(preview.bugBountyScope.target) : "not recorded"}`,
    `- Evidence leads: ${evidenceEntries.length}`,
    ...evidenceEntries.map((entry) => `- ${entry.id}: ${entry.status}, ${entry.confidence}, ${redactedExportText(entry.asset)}${entry.endpoint ? ` ${redactedExportText(entry.endpoint)}` : ""}`),
    `- Report drafts: ${reports.length}`,
    ...reports.map((report) => `- ${report.id}: ${report.severity}, ${report.confidence}, ${redactedExportText(report.title)}`),
    "",
    "## Decision Log",
    "",
    ...preview.decisionLog.entries.map((entry) => `- ${entry.timestamp} ${entry.type}: ${markdownLine(entry.message)}`),
    "",
    "## Next",
    "",
    markdownParagraph(record.nextRecommendedAction),
    ""
  ].join("\n");
}

function proposalExportLines(proposal: TaskModeProposal): readonly string[] {
  const base = [
    `- Kind: ${proposal.kind}`,
    `- Risk: ${proposal.riskLevel}`,
    `- Requires approval: ${proposal.requiresApproval ? "yes" : "no"}`,
    `- Summary: ${redactedExportText(proposal.summary)}`
  ];

  switch (proposal.kind) {
    case "patch":
      return [
        ...base,
        `- Stage: ${proposal.stage.id} - ${markdownLine(proposal.stage.name)}`,
        `- Changes: ${proposal.changes.length}`,
        ...proposal.changes.map((change) => `- ${change.operation}: ${markdownLine(change.path)} - ${redactedExportText(change.rationale)}`)
      ];
    case "bug_bounty_review":
      return [
        ...base,
        `- Moochacker scope: ${proposal.moochackerAssessment.scopeStatus}`,
        `- Moochacker safety: ${proposal.moochackerAssessment.safetyLevel}`,
        `- Stop conditions: ${proposal.stopConditions.length}`
      ];
    case "document":
      return [...base, `- Title: ${redactedExportText(proposal.title)}`];
    case "security_review":
      return [...base, `- Checklist items: ${proposal.checklist.length}`, `- Scan placeholders: ${exportList(proposal.scanPlaceholders)}`];
    case "ops_plan":
      return [...base, `- Status areas: ${exportList(proposal.statusAreas)}`];
    case "productivity_plan":
      return [...base, `- Tasks: ${proposal.tasks.length}`];
    case "assistant_response":
      return [...base, `- Response: ${redactedExportText(proposal.response)}`];
  }
}

function verificationExportLines(preview: RunPreview): readonly string[] {
  if (preview.workspaceVerificationRecord) {
    return [
      `- Workspace verification: ${preview.workspaceVerificationRecord.accepted ? "accepted" : "failed"}`,
      `- Workspace status: ${preview.workspaceVerificationRecord.previousStatus} -> ${preview.workspaceVerificationRecord.nextStatus}`,
      ...preview.workspaceVerificationRecord.commands.map((command) => `- ${command.name}: ${command.status}`)
    ];
  }

  if (preview.verificationResult) {
    return [
      `- Proposal verification: ${preview.verificationResult.accepted ? "accepted" : "failed"}`,
      ...preview.verificationResult.checks.map((check) => `- ${check.name}: ${check.passed ? "pass" : "fail"} (${check.mocked ? "mocked" : "local"})`)
    ];
  }

  return ["- not recorded"];
}

function redactedExportText(value: string): string {
  return markdownLine(redactEvidenceText(value).value);
}

function exportList(values: readonly string[]): string {
  return values.length > 0 ? values.map(redactedExportText).join(", ") : "none";
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

function cleanList(values: readonly (string | undefined)[]): readonly string[] {
  return values
    .filter((value): value is string => value !== undefined)
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
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
