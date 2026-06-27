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

export interface BugBountyReviewProposal extends BaseProposal {
  readonly kind: "bug_bounty_review";
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

export type DecisionLogEntryType =
  | "original_user_input"
  | "task_mode_selected"
  | "routing_decision"
  | "selected_agent_team"
  | "proposal_produced"
  | "safety_decision"
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
}

export interface TaskModeExecutionResult {
  readonly mode: TaskMode;
  readonly selectedAgentTeam: readonly AssistantAgentRole[];
  readonly proposal: TaskModeProposal;
  readonly safetyDecision: SafetyDecision;
  readonly verificationResult?: VerificationResult;
  readonly developmentResult?: OrchestrationResult;
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
