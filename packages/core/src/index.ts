export type RiskLevel = "low" | "medium" | "high";

export type TaskMode =
  | "assistant"
  | "development"
  | "bug_bounty"
  | "documentation"
  | "security"
  | "operations"
  | "personal_productivity";

export type ProposalKind =
  | "patch"
  | "bug_bounty_review"
  | "document"
  | "security_review"
  | "ops_plan"
  | "productivity_plan"
  | "assistant_response";

export type Capability =
  | "answer_general_request"
  | "read_project_files"
  | "propose_file_changes"
  | "run_tests_placeholder"
  | "confirm_bug_bounty_scope"
  | "map_targets_placeholder"
  | "review_program_rules"
  | "collect_evidence_placeholder"
  | "draft_finding_report"
  | "generate_document"
  | "inspect_dependencies_placeholder"
  | "secret_scan_placeholder"
  | "read_logs_placeholder"
  | "inspect_server_status_placeholder"
  | "read_calendar_placeholder"
  | "read_email_placeholder"
  | "create_task_placeholder";

export type CapabilityExecutionKind = "local" | "external" | "proposal_only";

export interface CapabilityDefinition {
  readonly capability: Capability;
  readonly summary: string;
  readonly executionKind: CapabilityExecutionKind;
  readonly placeholder: boolean;
  readonly requiresApproval: boolean;
  readonly activeTesting: boolean;
}

export type ExternalToolPolicy = "block_by_default" | "allow_with_approval";

export interface SafetyPolicyRedactionRule {
  readonly id: string;
  readonly summary: string;
  readonly replacement: string;
}

export interface ModeSafetyPolicy {
  readonly mode: TaskMode;
  readonly allowedCapabilities: readonly Capability[];
  readonly externalToolPolicy: ExternalToolPolicy;
  readonly requiresApproval: boolean;
  readonly stopConditions: readonly string[];
  readonly redactionRules: readonly SafetyPolicyRedactionRule[];
}

export type SafetyPolicyViolationCode =
  | "capability_not_allowed"
  | "external_tool_blocked"
  | "active_testing_stop_condition"
  | "bug_bounty_scope_required"
  | "secret_redaction_required"
  | "verification_failed";

export type SafetyPolicyViolationSeverity = "warning" | "blocker";

export interface SafetyPolicyViolation {
  readonly code: SafetyPolicyViolationCode;
  readonly severity: SafetyPolicyViolationSeverity;
  readonly message: string;
  readonly capability?: Capability;
  readonly recommendation: string;
}

export interface SafetyPolicyEvaluation {
  readonly mode: TaskMode;
  readonly allowed: boolean;
  readonly requiresApproval: boolean;
  readonly externalToolsBlocked: boolean;
  readonly allowedCapabilities: readonly Capability[];
  readonly blockedCapabilities: readonly Capability[];
  readonly stopConditions: readonly string[];
  readonly redactionRules: readonly SafetyPolicyRedactionRule[];
  readonly violations: readonly SafetyPolicyViolation[];
  readonly summary: string;
}

export type AgentRole =
  | "IntentAgent"
  | "ProductAgent"
  | "ArchitectAgent"
  | "SecurityAgent"
  | "MaintainerAgent"
  | "TesterAgent"
  | "ReviewerAgent"
  | "BuilderAgent";

export type AssistantAgentRole =
  | AgentRole
  | "AssistantAgent"
  | "RouterAgent"
  | "DocumentationAgent"
  | "BugBountyAgent"
  | "MoochackerAgent"
  | "ScopeGuardAgent"
  | "EvidenceAgent"
  | "SecurityReviewAgent"
  | "OperationsAgent"
  | "ProductivityAgent";

export type ReviewerRole = Exclude<AgentRole, "BuilderAgent">;

export type AgentVote = "approve" | "request_changes" | "reject";

export interface DevelopmentPhase {
  readonly stage: MvpStageId;
  readonly title: string;
  readonly objective: string;
  readonly exitCriteria: readonly string[];
}

export type MvpStageId = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;

export interface MvpStage {
  readonly id: MvpStageId;
  readonly name: string;
  readonly objective: string;
  readonly exitCriteria: readonly string[];
}

export type ProjectPackageManager = "pnpm" | "npm" | "yarn" | "bun" | "unknown";

export type ProjectLanguage =
  | "typescript"
  | "javascript"
  | "python"
  | "rust"
  | "go"
  | "java"
  | "csharp"
  | "markdown"
  | "json"
  | "unknown";

export type ProjectFramework =
  | "pnpm_workspace"
  | "node"
  | "react"
  | "nextjs"
  | "vite"
  | "express"
  | "fastify"
  | "vue"
  | "svelte"
  | "unknown";

export interface ProjectFileIndex {
  readonly root: string;
  readonly totalFiles: number;
  readonly sampledFiles: readonly string[];
  readonly ignoredDirectories: readonly string[];
}

export interface ProjectLanguageSummary {
  readonly language: ProjectLanguage;
  readonly files: number;
}

export interface ProjectScriptSummary {
  readonly name: "test" | "lint" | "typecheck" | "build";
  readonly configured: boolean;
  readonly command?: string;
}

export interface ProjectMvpStageEstimate {
  readonly stage: MvpStage;
  readonly confidence: number;
  readonly rationale: string;
  readonly evidence: readonly string[];
}

export interface DevelopmentProjectState {
  readonly analyzedAt: string;
  readonly workspaceRoot: string;
  readonly fileIndex: ProjectFileIndex;
  readonly packageManager: ProjectPackageManager;
  readonly packageManagerEvidence: readonly string[];
  readonly languages: readonly ProjectLanguageSummary[];
  readonly frameworks: readonly ProjectFramework[];
  readonly scripts: readonly ProjectScriptSummary[];
  readonly currentMvpStage: ProjectMvpStageEstimate;
  readonly notes: readonly string[];
}

export interface GoalState {
  readonly rawRequest: string;
  readonly inferredGoal: string;
  readonly mvpScope: readonly string[];
  readonly deferredScope: readonly string[];
  readonly assumptions: readonly string[];
  readonly riskLevel: RiskLevel;
  readonly requiredAgents: readonly AgentRole[];
  readonly suggestedPhases: readonly DevelopmentPhase[];
  readonly createdAt: string;
}

export interface AgentFinding {
  readonly role: ReviewerRole;
  readonly summary: string;
  readonly observations: readonly string[];
  readonly recommendations: readonly string[];
  readonly risks: readonly string[];
  readonly vote: AgentVote;
  readonly requiredActions: readonly string[];
}

export interface CouncilDecision {
  readonly goal: string;
  readonly mvpScope: readonly string[];
  readonly deferredScope: readonly string[];
  readonly findings: readonly AgentFinding[];
  readonly rejectedIdeas: readonly string[];
  readonly acceptedPlan: readonly string[];
  readonly selectedNextStep: MvpStage;
  readonly decision: "approved" | "needs_changes" | "rejected";
  readonly rationale: string;
}

export type PatchOperation = "create" | "modify" | "delete";

export interface BaseProposal {
  readonly id: string;
  readonly kind: ProposalKind;
  readonly summary: string;
  readonly riskLevel: RiskLevel;
  readonly requiresApproval: boolean;
  readonly assumptions: readonly string[];
  readonly nextActions: readonly string[];
}

export interface PatchChange {
  readonly path: string;
  readonly operation: PatchOperation;
  readonly rationale: string;
  readonly content?: string;
}

export interface PatchChangePlan {
  readonly path: string;
  readonly operation: PatchOperation;
  readonly purpose: string;
  readonly expectedImpact: string;
  readonly riskLevel: RiskLevel;
  readonly requiresApproval: boolean;
  readonly requiresSeparateApproval: boolean;
  readonly reviewFocus: readonly string[];
}

export interface PatchRiskAssessment {
  readonly overallRisk: RiskLevel;
  readonly approvalRequired: boolean;
  readonly separateApprovalRequired: boolean;
  readonly reasons: readonly string[];
}

export interface PatchPreview {
  readonly summary: string;
  readonly changePlan: readonly PatchChangePlan[];
  readonly riskAssessment: PatchRiskAssessment;
  readonly unifiedDiff: string;
  readonly generatedAt: string;
}

export interface PatchPolicy {
  readonly singleWriter: true;
  readonly writer: "BuilderAgent" | "BuilderRuntime";
  readonly reviewers: readonly ReviewerRole[];
}

export interface PatchProposal extends BaseProposal {
  readonly id: string;
  readonly kind: "patch";
  readonly author: "BuilderAgent" | "BuilderRuntime";
  readonly goal: string;
  readonly stage: MvpStage;
  readonly summary: string;
  readonly changes: readonly PatchChange[];
  readonly preview?: PatchPreview;
  readonly policy: PatchPolicy;
  readonly createdAt: string;
  status: "proposed" | "accepted" | "rejected";
}

export interface DocumentProposal extends BaseProposal {
  readonly kind: "document";
  readonly title: string;
  readonly targetFormat: "markdown" | "plain_text";
  readonly outline: readonly string[];
  readonly contentSummary: string;
}

export interface SecurityReviewProposal extends BaseProposal {
  readonly kind: "security_review";
  readonly checklist: readonly string[];
  readonly findings: readonly string[];
  readonly scanPlaceholders: readonly string[];
}

export type BugBountyScopeStatus = "sufficient" | "needs_clarification" | "out_of_scope";

export type MoochackerSafetyLevel = "safe" | "caution" | "blocked";

export interface MoochackerAssessment {
  readonly agent: "MoochackerAgent";
  readonly mode: "bug_bounty";
  readonly scopeStatus: BugBountyScopeStatus;
  readonly safetyLevel: MoochackerSafetyLevel;
  readonly allowedActions: readonly string[];
  readonly blockedActions: readonly string[];
  readonly clarifyingQuestions: readonly string[];
  readonly evidenceGuidance: readonly string[];
  readonly redactionRequirements: readonly string[];
  readonly reportingNotes: readonly string[];
}

export interface BugBountyReviewProposal extends BaseProposal {
  readonly kind: "bug_bounty_review";
  readonly moochackerAssessment: MoochackerAssessment;
  readonly scopeGate: readonly string[];
  readonly targetMapPlaceholders: readonly string[];
  readonly hypotheses: readonly string[];
  readonly evidenceLedgerFields: readonly string[];
  readonly reportSections: readonly string[];
  readonly stopConditions: readonly string[];
}

export interface OpsPlanProposal extends BaseProposal {
  readonly kind: "ops_plan";
  readonly statusAreas: readonly string[];
  readonly planSteps: readonly string[];
  readonly integrationPlaceholders: readonly string[];
}

export interface ProductivityPlanProposal extends BaseProposal {
  readonly kind: "productivity_plan";
  readonly tasks: readonly string[];
  readonly scheduleBlocks: readonly string[];
  readonly integrationPlaceholders: readonly string[];
}

export interface AssistantResponseProposal extends BaseProposal {
  readonly kind: "assistant_response";
  readonly response: string;
  readonly suggestedQuestions: readonly string[];
}

export type TaskModeProposal =
  | PatchProposal
  | BugBountyReviewProposal
  | DocumentProposal
  | SecurityReviewProposal
  | OpsPlanProposal
  | ProductivityPlanProposal
  | AssistantResponseProposal;

export type VerificationCheckName =
  | "test"
  | "lint"
  | "typecheck"
  | "security_scan"
  | "secret_scan"
  | "dependency_audit";

export interface VerificationCheck {
  readonly name: VerificationCheckName;
  readonly passed: boolean;
  readonly mocked: boolean;
  readonly summary: string;
  readonly details: readonly string[];
}

export interface VerificationResult {
  readonly patchId: string;
  readonly accepted: boolean;
  readonly checks: readonly VerificationCheck[];
  readonly completedAt: string;
}

export type WorkspaceVerificationScriptName = "test" | "lint" | "typecheck";

export type WorkspaceVerificationCommandStatus =
  | "passed"
  | "failed"
  | "not_configured"
  | "timed_out"
  | "blocked";

export type WorkspaceVerificationGateStatus = "passed" | "failed" | "blocked" | "skipped";

export type WorkspaceVerificationGateCategory = "command" | "local_check" | "placeholder";

export interface WorkspaceVerificationGateResult {
  readonly id: string;
  readonly category: WorkspaceVerificationGateCategory;
  readonly status: WorkspaceVerificationGateStatus;
  readonly required: boolean;
  readonly summary: string;
}

export interface WorkspaceVerificationOutputArtifact {
  readonly command: WorkspaceVerificationScriptName;
  readonly stream: "stdout" | "stderr";
  readonly path: string;
  readonly redacted: boolean;
  readonly truncated: boolean;
}

export interface WorkspaceVerificationSummary {
  readonly requestedScripts: readonly WorkspaceVerificationScriptName[];
  readonly configuredScripts: readonly WorkspaceVerificationScriptName[];
  readonly passedCommands: number;
  readonly failedCommands: number;
  readonly blockedCommands: number;
  readonly skippedCommands: number;
  readonly timedOutCommands: number;
  readonly outputArtifacts: number;
  readonly redactedArtifacts: number;
  readonly requiredGatesPassed: boolean;
  readonly dependencyAudit: "placeholder";
  readonly failureReasons: readonly string[];
}

export interface WorkspaceVerificationCommandResult {
  readonly name: WorkspaceVerificationScriptName;
  readonly status: WorkspaceVerificationCommandStatus;
  readonly configured: boolean;
  readonly command: readonly string[];
  readonly script?: string;
  readonly exitCode?: number;
  readonly signal?: string;
  readonly durationMs: number;
  readonly stdoutPath?: string;
  readonly stderrPath?: string;
  readonly stdoutPreview: string;
  readonly stderrPreview: string;
  readonly stdoutRedacted: boolean;
  readonly stderrRedacted: boolean;
  readonly stdoutTruncated: boolean;
  readonly stderrTruncated: boolean;
  readonly notes: readonly string[];
}

export interface WorkspaceVerificationRecord {
  readonly runId: string;
  readonly proposalId: string;
  readonly workspaceRoot: string;
  readonly packageManager: "pnpm";
  readonly startedAt: string;
  readonly completedAt: string;
  readonly accepted: boolean;
  readonly previousStatus: RunStatus;
  readonly nextStatus: "verified" | "failed";
  readonly commands: readonly WorkspaceVerificationCommandResult[];
  readonly localChecks: readonly VerificationCheck[];
  readonly gates: readonly WorkspaceVerificationGateResult[];
  readonly summary: WorkspaceVerificationSummary;
  readonly outputArtifacts: readonly WorkspaceVerificationOutputArtifact[];
  readonly nextRecommendedAction: string;
}

export type DecisionLogEntryType =
  | "original_user_input"
  | "task_mode_selected"
  | "routing_decision"
  | "selected_agent_team"
  | "proposal_produced"
  | "safety_decision"
  | "approval_decision"
  | "bug_bounty_scope_intake"
  | "bug_bounty_target_map_recorded"
  | "bug_bounty_evidence_recorded"
  | "bug_bounty_report_drafted"
  | "run_exported"
  | "patch_applied"
  | "workspace_verification_result"
  | "development_project_state"
  | "inferred_goal"
  | "mvp_scope_decision"
  | "agent_comments"
  | "rejected_ideas"
  | "accepted_plan"
  | "patch_proposal_summary"
  | "verification_result"
  | "next_recommended_step";

export interface DecisionLogEntry {
  readonly type: DecisionLogEntryType;
  readonly message: string;
  readonly data: Record<string, unknown>;
  readonly timestamp: string;
}

export interface DecisionLog {
  readonly entries: readonly DecisionLogEntry[];
}

export type RunStatus = "proposed" | "approved" | "rejected" | "applied" | "verified" | "failed";

export interface RunArtifactPaths {
  readonly runDir: string;
  readonly request: string;
  readonly context: string;
  readonly proposal: string;
  readonly safety: string;
  readonly decisionLog: string;
  readonly metadata: string;
  readonly verification?: string;
  readonly projectState?: string;
  readonly workspaceVerification?: string;
  readonly approval?: string;
  readonly scope?: string;
  readonly targetMap?: string;
  readonly evidenceLedger?: string;
  readonly reports?: string;
  readonly export?: string;
  readonly apply?: string;
  readonly rollback?: string;
}

export type ApprovalDecision = "approved" | "rejected";

export type ApprovalPolicyCheckStatus = "passed" | "failed";

export interface ApprovalPolicyCheck {
  readonly id: string;
  readonly status: ApprovalPolicyCheckStatus;
  readonly summary: string;
}

export interface ApprovalCapabilityDecision {
  readonly capability: string;
  readonly requiresApproval: boolean;
  readonly rationale: string;
}

export interface ApprovalPolicySnapshot {
  readonly riskLevel: RiskLevel;
  readonly previewRiskLevel?: RiskLevel;
  readonly separateApprovalRequired: boolean;
  readonly confirmationRequired: boolean;
  readonly requiredRiskConfirmation?: RiskLevel;
  readonly providedRiskConfirmation?: RiskLevel;
  readonly checklist: readonly ApprovalPolicyCheck[];
  readonly capabilityDecisions: readonly ApprovalCapabilityDecision[];
}

export interface ApprovalRecord {
  readonly runId: string;
  readonly proposalId: string;
  readonly decision: ApprovalDecision;
  readonly decidedBy: "user";
  readonly reason?: string;
  readonly createdAt: string;
  readonly expiresAt?: string;
  readonly previousStatus: RunStatus;
  readonly nextStatus: RunStatus;
  readonly policy?: ApprovalPolicySnapshot;
  readonly nextRecommendedAction: string;
}

export interface BugBountyScopeIntake {
  readonly target: string;
  readonly inScopeAssets: readonly string[];
  readonly outOfScopeAssets: readonly string[];
  readonly allowedTechniques: readonly string[];
  readonly forbiddenTechniques: readonly string[];
  readonly rateLimits: readonly string[];
  readonly testAccountRoles: readonly string[];
  readonly dataHandlingRules: readonly string[];
  readonly authorizationNote: string;
  readonly programRulesUrl?: string;
}

export type BugBountyScopeCheckStatus = "passed" | "missing" | "warning" | "blocked";

export interface BugBountyScopeCheck {
  readonly id: string;
  readonly status: BugBountyScopeCheckStatus;
  readonly summary: string;
}

export type BugBountyScopeBoundaryKind = "host" | "path" | "url" | "wildcard" | "other";

export type BugBountyScopeBoundarySource = "target" | "in_scope" | "out_of_scope";

export interface BugBountyScopeBoundary {
  readonly source: BugBountyScopeBoundarySource;
  readonly kind: BugBountyScopeBoundaryKind;
  readonly value: string;
  readonly normalizedValue: string;
}

export interface BugBountyScopeIntakeAssessment {
  readonly status: BugBountyScopeStatus;
  readonly safetyLevel: MoochackerSafetyLevel;
  readonly passiveOnly: true;
  readonly authorizationPresent: boolean;
  readonly programRulesPresent: boolean;
  readonly missingFields: readonly string[];
  readonly conflictWarnings: readonly string[];
  readonly blockedReasons: readonly string[];
  readonly redactedFields: readonly string[];
  readonly checks: readonly BugBountyScopeCheck[];
  readonly boundaries: readonly BugBountyScopeBoundary[];
  readonly nextAllowedActions: readonly string[];
  readonly blockedUntilClarified: boolean;
}

export interface BugBountyScopeRecord extends BugBountyScopeIntake {
  readonly runId: string;
  readonly recordedBy: "user";
  readonly createdAt: string;
  readonly intakeAssessment: BugBountyScopeIntakeAssessment;
  readonly moochackerAssessment: MoochackerAssessment;
}

export type BugBountyHttpMethod =
  | "GET"
  | "POST"
  | "PUT"
  | "PATCH"
  | "DELETE"
  | "HEAD"
  | "OPTIONS"
  | "OTHER";

export type BugBountyTargetMapFileFlow = "none" | "upload" | "download" | "upload_download";

export type BugBountyTargetMapCheckStatus = "passed" | "missing" | "warning" | "blocked";

export interface BugBountyTargetMapRoleAccess {
  readonly role: string;
  readonly authState: string;
  readonly canAccess: readonly string[];
  readonly cannotAccess: readonly string[];
  readonly notes?: string;
}

export interface BugBountyTargetEndpointInput {
  readonly method?: BugBountyHttpMethod;
  readonly host?: string;
  readonly apiBase?: string;
  readonly path: string;
  readonly parameters: readonly string[];
  readonly authState?: string;
  readonly roles: readonly string[];
  readonly stateChanging: boolean;
  readonly fileFlow: BugBountyTargetMapFileFlow;
  readonly redirects: readonly string[];
  readonly thirdPartyIntegrations: readonly string[];
  readonly notes?: string;
}

export interface BugBountyTargetEndpoint extends BugBountyTargetEndpointInput {
  readonly id: string;
}

export interface BugBountyTargetMapInput {
  readonly hosts: readonly string[];
  readonly applications: readonly string[];
  readonly apiBases: readonly string[];
  readonly authStates: readonly string[];
  readonly roleAccess: readonly BugBountyTargetMapRoleAccess[];
  readonly endpoints: readonly BugBountyTargetEndpointInput[];
  readonly fileFlows: readonly string[];
  readonly redirects: readonly string[];
  readonly thirdPartyIntegrations: readonly string[];
  readonly sourceArtifacts: readonly string[];
  readonly notes?: string;
}

export interface BugBountyTargetMapCheck {
  readonly id: string;
  readonly status: BugBountyTargetMapCheckStatus;
  readonly summary: string;
}

export interface BugBountyTargetMapAssessment {
  readonly passiveOnly: true;
  readonly noRequestsMade: true;
  readonly scopeStatus: BugBountyScopeStatus;
  readonly safetyLevel: MoochackerSafetyLevel;
  readonly missingFields: readonly string[];
  readonly outOfScopeReferences: readonly string[];
  readonly redactedFields: readonly string[];
  readonly checks: readonly BugBountyTargetMapCheck[];
  readonly endpointCount: number;
  readonly stateChangingEndpoints: number;
  readonly fileFlowEndpoints: number;
  readonly thirdPartyIntegrationCount: number;
  readonly nextRecommendedActions: readonly string[];
}

export interface BugBountyTargetMapRecord extends BugBountyTargetMapInput {
  readonly id: string;
  readonly runId: string;
  readonly recordedBy: "user";
  readonly createdAt: string;
  readonly scopeTarget: string;
  readonly endpoints: readonly BugBountyTargetEndpoint[];
  readonly assessment: BugBountyTargetMapAssessment;
}

export type BugBountyEvidenceStatus =
  | "hypothesis"
  | "testing"
  | "confirmed"
  | "duplicate-risk"
  | "non-issue"
  | "blocked";

export type BugBountyEvidenceConfidence = "low" | "medium" | "high";

export interface BugBountyRequestResponsePlaceholder {
  readonly requestSummary?: string;
  readonly responseSummary?: string;
  readonly redactionApplied: true;
}

export interface BugBountyEvidenceInput {
  readonly status: BugBountyEvidenceStatus;
  readonly asset: string;
  readonly endpoint?: string;
  readonly method?: BugBountyHttpMethod;
  readonly authState?: string;
  readonly userRole?: string;
  readonly objectOwnership?: string;
  readonly hypothesis: string;
  readonly testPerformed?: string;
  readonly requestSummary?: string;
  readonly responseSummary?: string;
  readonly evidence?: string;
  readonly impact: string;
  readonly confidence: BugBountyEvidenceConfidence;
  readonly scopeNote: string;
  readonly programRuleNotes?: string;
  readonly nextAction: string;
}

export interface BugBountyEvidenceRecord extends BugBountyEvidenceInput {
  readonly id: string;
  readonly runId: string;
  readonly recordedBy: "user";
  readonly createdAt: string;
  readonly requestResponse: BugBountyRequestResponsePlaceholder;
  readonly redactionApplied: true;
  readonly redactedFields: readonly string[];
  readonly safetyNotes: readonly string[];
}

export interface BugBountyEvidenceLedger {
  readonly entries: readonly BugBountyEvidenceRecord[];
}

export type BugBountySeverity = "informational" | "low" | "medium" | "high" | "critical";

export interface BugBountyReportDraftInput {
  readonly leadId: string;
  readonly title?: string;
  readonly severity?: BugBountySeverity;
  readonly affectedUsersOrRoles?: readonly string[];
  readonly reproductionSteps?: readonly string[];
  readonly remediation?: string;
  readonly limitations?: string;
  readonly duplicateRisk?: boolean;
}

export interface BugBountyReportDraftRecord {
  readonly id: string;
  readonly runId: string;
  readonly leadId: string;
  readonly createdAt: string;
  readonly title: string;
  readonly severity: BugBountySeverity;
  readonly severityRationale: string;
  readonly confidence: BugBountyEvidenceConfidence;
  readonly affectedAsset: string;
  readonly affectedEndpoint?: string;
  readonly affectedUsersOrRoles: readonly string[];
  readonly summary: string;
  readonly impact: string;
  readonly reproductionSteps: readonly string[];
  readonly evidence: readonly string[];
  readonly whyThisMatters: string;
  readonly remediation: string;
  readonly limitations: string;
  readonly scopeNotes: readonly string[];
  readonly suggestedRetest: string;
  readonly duplicateRisk: boolean;
  readonly markdownPath: string;
  readonly redactionApplied: true;
  readonly safetyNotes: readonly string[];
  readonly nextRecommendedAction: string;
}

export interface AppliedPatchFile {
  readonly path: string;
  readonly operation: "create" | "modify";
  readonly targetPath: string;
  readonly backupPath?: string;
  readonly previousHash?: string;
  readonly newHash: string;
}

export type ApplyPreflightCheckStatus = "passed" | "blocked";

export interface ApplyPreflightCheck {
  readonly id: string;
  readonly status: ApplyPreflightCheckStatus;
  readonly summary: string;
}

export interface ApplyPreflightFilePlan {
  readonly path: string;
  readonly operation: "create" | "modify";
  readonly targetPath: string;
  readonly previousExists: boolean;
  readonly backupPlanned: boolean;
  readonly proposedHash: string;
}

export interface ApplyPreflightSummary {
  readonly totalFiles: number;
  readonly creates: number;
  readonly modifies: number;
  readonly backupsPlanned: number;
}

export interface ApplyPreflight {
  readonly checkedAt: string;
  readonly workspaceRoot: string;
  readonly backupRoot: string;
  readonly approvalExpiresAt?: string;
  readonly checks: readonly ApplyPreflightCheck[];
  readonly files: readonly ApplyPreflightFilePlan[];
  readonly summary: ApplyPreflightSummary;
}

export interface ApplyRecord {
  readonly runId: string;
  readonly proposalId: string;
  readonly appliedBy: "user-approved-controlled-apply";
  readonly createdAt: string;
  readonly workspaceRoot: string;
  readonly backupRoot: string;
  readonly preflight: ApplyPreflight;
  readonly summary: ApplyPreflightSummary;
  readonly previousStatus: RunStatus;
  readonly nextStatus: "applied";
  readonly files: readonly AppliedPatchFile[];
  readonly nextRecommendedAction: string;
}

export interface RollbackRecord {
  readonly runId: string;
  readonly proposalId: string;
  readonly createdAt: string;
  readonly workspaceRoot: string;
  readonly backupRoot: string;
  readonly createdFiles: readonly string[];
  readonly modifiedFiles: readonly string[];
  readonly backupFileMap: Record<string, string>;
  readonly previousHashes: Record<string, string>;
  readonly newHashes: Record<string, string>;
  readonly rollbackImplemented: false;
  readonly note: string;
}

export interface RunRecord {
  readonly id: string;
  readonly status: RunStatus;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly input: string;
  readonly selectedMode: TaskMode;
  readonly confidenceScore: number;
  readonly proposalKind: ProposalKind;
  readonly proposalId: string;
  readonly requiresApproval: boolean;
  readonly artifactPaths: RunArtifactPaths;
}

export interface RunMetadata extends RunRecord {
  readonly selectedAgentTeam: readonly AssistantAgentRole[];
  readonly nextRecommendedAction: string;
}

export interface RunListItem {
  readonly id: string;
  readonly status: RunStatus;
  readonly selectedMode: TaskMode;
  readonly proposalKind: ProposalKind;
  readonly proposalId: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly input: string;
  readonly requiresApproval: boolean;
}

export type RunExportFormat = "markdown";

export interface RunExportRecord {
  readonly runId: string;
  readonly format: RunExportFormat;
  readonly outputPath: string;
  readonly createdAt: string;
  readonly summary: string;
  readonly nextRecommendedAction: string;
}

export interface ConsoleRunSnapshot {
  readonly version: "0.1.0";
  readonly generatedAt: string;
  readonly source: {
    readonly kind: "dure-console-data";
    readonly readOnly: true;
    readonly redacted: true;
  };
  readonly run: {
    readonly id: string;
    readonly status: RunStatus;
    readonly selectedMode: TaskMode;
    readonly proposalKind: ProposalKind;
    readonly proposalId: string;
    readonly createdAt: string;
    readonly updatedAt: string;
    readonly input: string;
    readonly requiresApproval: boolean;
    readonly nextRecommendedAction: string;
  };
  readonly routing: {
    readonly inferredIntent: string;
    readonly confidenceScore: number;
    readonly assumptions: readonly string[];
    readonly requiredCapabilities: readonly Capability[];
    readonly safetyRequirements: readonly string[];
    readonly requiresUserApproval: boolean;
    readonly requiresExternalTools: boolean;
    readonly rejectedModes: readonly TaskMode[];
  };
  readonly agents: readonly {
    readonly name: AssistantAgentRole;
    readonly status: "active" | "reviewing" | "guarding";
    readonly summary: string;
  }[];
  readonly proposal: {
    readonly id: string;
    readonly kind: ProposalKind;
    readonly summary: string;
    readonly riskLevel: RiskLevel;
    readonly requiresApproval: boolean;
    readonly assumptions: readonly string[];
    readonly nextActions: readonly string[];
  };
  readonly safety: {
    readonly allowed: boolean;
    readonly requiresApproval: boolean;
    readonly externalToolsRequired: boolean;
    readonly summary: string;
    readonly blockedCapabilities: readonly Capability[];
    readonly details: readonly string[];
  };
  readonly verification: {
    readonly proposalAccepted?: boolean;
    readonly workspaceAccepted?: boolean;
    readonly checks: readonly {
      readonly name: string;
      readonly status: string;
      readonly mocked?: boolean;
      readonly summary: string;
    }[];
  };
  readonly projectState?: {
    readonly packageManager: ProjectPackageManager;
    readonly languages: readonly ProjectLanguageSummary[];
    readonly frameworks: readonly ProjectFramework[];
    readonly configuredScripts: readonly string[];
    readonly missingScripts: readonly string[];
    readonly currentMvpStage: {
      readonly id: MvpStageId;
      readonly name: string;
      readonly confidence: number;
      readonly rationale: string;
    };
    readonly fileCount: number;
    readonly sampledFiles: readonly string[];
    readonly notes: readonly string[];
  };
  readonly development?: {
    readonly stage?: string;
    readonly patchChanges: readonly {
      readonly path: string;
      readonly operation: PatchOperation;
      readonly rationale: string;
    }[];
    readonly patchPreview?: {
      readonly summary: string;
      readonly riskAssessment: PatchRiskAssessment;
      readonly changePlan: readonly PatchChangePlan[];
      readonly unifiedDiff: string;
    };
    readonly approval?: ApprovalDecision;
    readonly appliedFiles: number;
  };
  readonly bugBounty?: {
    readonly target?: string;
    readonly scopeStatus?: BugBountyScopeStatus;
    readonly safetyLevel?: MoochackerSafetyLevel;
    readonly targetMapEndpoints: number;
    readonly targetMapStateChangingEndpoints: number;
    readonly evidenceLeads: number;
    readonly reportDrafts: number;
    readonly stopConditions: readonly string[];
  };
  readonly artifacts: {
    readonly hasApproval: boolean;
    readonly hasApply: boolean;
    readonly hasWorkspaceVerification: boolean;
    readonly hasScope: boolean;
    readonly hasTargetMap: boolean;
    readonly hasEvidenceLedger: boolean;
    readonly hasReports: boolean;
    readonly hasMarkdownExport: boolean;
    readonly hasProjectState: boolean;
  };
  readonly decisions: readonly {
    readonly type: DecisionLogEntryType;
    readonly message: string;
    readonly timestamp: string;
  }[];
}

export interface RunPreview {
  readonly metadata: RunMetadata;
  readonly request: {
    readonly originalInput: string;
    readonly receivedAt: string;
  };
  readonly context: AssistantRequestContext;
  readonly proposal: TaskModeProposal;
  readonly safetyDecision: SafetyDecision;
  readonly verificationResult?: VerificationResult;
  readonly developmentProjectState?: DevelopmentProjectState;
  readonly workspaceVerificationRecord?: WorkspaceVerificationRecord;
  readonly approvalRecord?: ApprovalRecord;
  readonly bugBountyScope?: BugBountyScopeRecord;
  readonly bugBountyTargetMap?: BugBountyTargetMapRecord;
  readonly bugBountyEvidenceLedger?: BugBountyEvidenceLedger;
  readonly bugBountyReportDrafts?: readonly BugBountyReportDraftRecord[];
  readonly applyRecord?: ApplyRecord;
  readonly rollbackRecord?: RollbackRecord;
  readonly decisionLog: DecisionLog;
  readonly artifactPaths: RunArtifactPaths;
}

export interface SkillManifest {
  readonly name: string;
  readonly version: string;
  readonly summary: string;
  readonly tags: readonly string[];
  readonly permissions: readonly string[];
  readonly estimatedSize: number;
  readonly trusted: boolean;
  readonly hash?: string;
  readonly signature?: string;
}

export interface SkillPreview {
  readonly name: string;
  readonly version: string;
  readonly summary: string;
  readonly tags: readonly string[];
  readonly permissions: readonly string[];
  readonly estimatedSize: number;
  readonly trusted: boolean;
  readonly hash: string;
  readonly signature?: string;
}

export interface LlmCompletion {
  readonly text: string;
  readonly tokensUsed?: number;
}

export interface LlmProvider {
  readonly name: string;
  complete(prompt: string): Promise<LlmCompletion>;
}

export interface AssistantRequestContext {
  readonly originalInput: string;
  readonly inferredIntent: string;
  readonly selectedMode: TaskMode;
  readonly confidenceScore: number;
  readonly assumptions: readonly string[];
  readonly requiredCapabilities: readonly Capability[];
  readonly safetyRequirements: readonly string[];
  readonly requiresUserApproval: boolean;
  readonly requiresExternalTools: boolean;
  readonly rejectedModes: readonly TaskMode[];
  readonly createdAt: string;
}

export interface IntentRoute {
  readonly inferredIntent: string;
  readonly selectedMode: TaskMode;
  readonly confidenceScore: number;
  readonly assumptions: readonly string[];
  readonly requiredCapabilities: readonly Capability[];
  readonly safetyRequirements: readonly string[];
  readonly requiresUserApproval: boolean;
  readonly requiresExternalTools: boolean;
  readonly rejectedModes: readonly TaskMode[];
}

export interface SafetyDecision {
  readonly allowed: boolean;
  readonly requiresApproval: boolean;
  readonly externalToolsRequired: boolean;
  readonly summary: string;
  readonly blockedCapabilities: readonly Capability[];
  readonly details: readonly string[];
  readonly policyEvaluation?: SafetyPolicyEvaluation;
}

export interface TaskModeExecutionResult {
  readonly mode: TaskMode;
  readonly selectedAgentTeam: readonly AssistantAgentRole[];
  readonly proposal: TaskModeProposal;
  readonly safetyDecision: SafetyDecision;
  readonly verificationResult?: VerificationResult;
  readonly developmentResult?: OrchestrationResult;
  readonly developmentProjectState?: DevelopmentProjectState;
  readonly nextRecommendedAction: string;
}

export interface OrchestrationResult {
  readonly goalState: GoalState;
  readonly councilDecision: CouncilDecision;
  readonly selectedNextStep: MvpStage;
  readonly patchProposal: PatchProposal;
  readonly verificationResult: VerificationResult;
  readonly decisionLog: DecisionLog;
  readonly nextRecommendedAction: string;
}

export interface AssistantRunResult {
  readonly context: AssistantRequestContext;
  readonly selectedAgentTeam: readonly AssistantAgentRole[];
  readonly proposal: TaskModeProposal;
  readonly safetyDecision: SafetyDecision;
  readonly verificationResult?: VerificationResult;
  readonly developmentResult?: OrchestrationResult;
  readonly developmentProjectState?: DevelopmentProjectState;
  readonly decisionLog: DecisionLog;
  readonly runId?: string;
  readonly runRecord?: RunRecord;
  readonly runArtifactPaths?: RunArtifactPaths;
  readonly nextRecommendedAction: string;
}

export function createStableId(prefix: string, parts: readonly string[]): string {
  const source = parts.join("|").toLowerCase().replace(/[^a-z0-9]+/g, "-");
  const compact = source.replace(/^-+|-+$/g, "").slice(0, 48) || "item";
  return `${prefix}-${compact}`;
}
