import type {
  AssistantRequestContext,
  BugBountyReviewProposal,
  Capability,
  CapabilityDefinition,
  ModeSafetyPolicy,
  SafetyDecision,
  SafetyPolicyEvaluation,
  SafetyPolicyRedactionRule,
  SafetyPolicyViolation,
  TaskMode,
  TaskModeProposal,
  VerificationResult
} from "@dure/core";

export interface SafetyPolicyEngineInput {
  readonly context: AssistantRequestContext;
  readonly proposal: TaskModeProposal;
  readonly verificationResult?: VerificationResult;
}

export interface RedactionResult {
  readonly value: string;
  readonly redacted: boolean;
  readonly appliedRules: readonly string[];
}

export const REDACTION_RULES: readonly SafetyPolicyRedactionRule[] = [
  {
    id: "authorization-header",
    summary: "Redact Authorization, Cookie, and Set-Cookie headers.",
    replacement: "[redacted-secret]"
  },
  {
    id: "named-secret",
    summary: "Redact common token, key, password, session, and CSRF assignments.",
    replacement: "[redacted-secret]"
  },
  {
    id: "bearer-token",
    summary: "Redact bearer token values.",
    replacement: "[redacted-secret]"
  },
  {
    id: "email-address",
    summary: "Redact email-like personal data.",
    replacement: "[redacted-email]"
  }
];

const REDACTION_PATTERNS: readonly {
  readonly id: string;
  readonly pattern: RegExp;
  readonly replacement: string;
}[] = [
  { id: "authorization-header", pattern: /\b(authorization|cookie|set-cookie)\s*:\s*[^\r\n]+/gi, replacement: "[redacted-secret]" },
  {
    id: "named-secret",
    pattern: /\b(api[_-]?key|secret|token|password|session|csrf)\s*[:=]\s*["']?[^"'\s,;]{6,}["']?/gi,
    replacement: "[redacted-secret]"
  },
  { id: "bearer-token", pattern: /\bbearer\s+[A-Za-z0-9._~+/=-]{8,}/gi, replacement: "[redacted-secret]" },
  { id: "email-address", pattern: /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, replacement: "[redacted-email]" }
];

export const CAPABILITY_REGISTRY: Record<Capability, CapabilityDefinition> = {
  answer_general_request: {
    capability: "answer_general_request",
    summary: "Answer or structure a request without side effects.",
    executionKind: "proposal_only",
    placeholder: false,
    requiresApproval: false,
    activeTesting: false
  },
  read_project_files: {
    capability: "read_project_files",
    summary: "Read local project files for context.",
    executionKind: "local",
    placeholder: false,
    requiresApproval: false,
    activeTesting: false
  },
  propose_file_changes: {
    capability: "propose_file_changes",
    summary: "Create controlled patch proposals without applying them.",
    executionKind: "local",
    placeholder: false,
    requiresApproval: true,
    activeTesting: false
  },
  run_tests_placeholder: {
    capability: "run_tests_placeholder",
    summary: "Represent test execution before approval-controlled verification is available.",
    executionKind: "local",
    placeholder: true,
    requiresApproval: true,
    activeTesting: false
  },
  confirm_bug_bounty_scope: {
    capability: "confirm_bug_bounty_scope",
    summary: "Record user-provided bug bounty scope and rules of engagement.",
    executionKind: "proposal_only",
    placeholder: false,
    requiresApproval: true,
    activeTesting: false
  },
  review_program_rules: {
    capability: "review_program_rules",
    summary: "Review user-provided program rules without contacting targets.",
    executionKind: "proposal_only",
    placeholder: false,
    requiresApproval: true,
    activeTesting: false
  },
  map_targets_placeholder: {
    capability: "map_targets_placeholder",
    summary: "Represent target mapping from authorized artifacts only.",
    executionKind: "external",
    placeholder: true,
    requiresApproval: true,
    activeTesting: true
  },
  collect_evidence_placeholder: {
    capability: "collect_evidence_placeholder",
    summary: "Represent evidence collection without active testing in v0.1.",
    executionKind: "external",
    placeholder: true,
    requiresApproval: true,
    activeTesting: true
  },
  draft_finding_report: {
    capability: "draft_finding_report",
    summary: "Draft a report from stored, redacted evidence.",
    executionKind: "proposal_only",
    placeholder: false,
    requiresApproval: true,
    activeTesting: false
  },
  generate_document: {
    capability: "generate_document",
    summary: "Generate reviewable document content.",
    executionKind: "local",
    placeholder: false,
    requiresApproval: false,
    activeTesting: false
  },
  inspect_dependencies_placeholder: {
    capability: "inspect_dependencies_placeholder",
    summary: "Represent dependency inspection without contacting package registries.",
    executionKind: "external",
    placeholder: true,
    requiresApproval: true,
    activeTesting: false
  },
  secret_scan_placeholder: {
    capability: "secret_scan_placeholder",
    summary: "Represent local secret scanning.",
    executionKind: "local",
    placeholder: true,
    requiresApproval: true,
    activeTesting: false
  },
  read_logs_placeholder: {
    capability: "read_logs_placeholder",
    summary: "Represent live log access without connecting to systems in v0.1.",
    executionKind: "external",
    placeholder: true,
    requiresApproval: true,
    activeTesting: false
  },
  inspect_server_status_placeholder: {
    capability: "inspect_server_status_placeholder",
    summary: "Represent live server status inspection without connecting to systems in v0.1.",
    executionKind: "external",
    placeholder: true,
    requiresApproval: true,
    activeTesting: false
  },
  read_calendar_placeholder: {
    capability: "read_calendar_placeholder",
    summary: "Represent calendar access without connecting to external accounts in v0.1.",
    executionKind: "external",
    placeholder: true,
    requiresApproval: true,
    activeTesting: false
  },
  read_email_placeholder: {
    capability: "read_email_placeholder",
    summary: "Represent email access without connecting to external accounts in v0.1.",
    executionKind: "external",
    placeholder: true,
    requiresApproval: true,
    activeTesting: false
  },
  create_task_placeholder: {
    capability: "create_task_placeholder",
    summary: "Represent task creation without writing to external productivity systems in v0.1.",
    executionKind: "external",
    placeholder: true,
    requiresApproval: true,
    activeTesting: false
  }
};

const MODE_POLICIES: Record<TaskMode, ModeSafetyPolicy> = {
  assistant: {
    mode: "assistant",
    allowedCapabilities: ["answer_general_request"],
    externalToolPolicy: "block_by_default",
    requiresApproval: false,
    stopConditions: ["A request requires external account, shell, browser, network, or file-system side effects."],
    redactionRules: REDACTION_RULES
  },
  development: {
    mode: "development",
    allowedCapabilities: ["read_project_files", "propose_file_changes", "run_tests_placeholder"],
    externalToolPolicy: "block_by_default",
    requiresApproval: true,
    stopConditions: [
      "The proposal would apply, delete, or execute code without explicit approval.",
      "The patch bypasses Single Writer, Multi Reviewer policy.",
      "Verification fails or cannot produce a reviewable result."
    ],
    redactionRules: REDACTION_RULES
  },
  bug_bounty: {
    mode: "bug_bounty",
    allowedCapabilities: [
      "confirm_bug_bounty_scope",
      "review_program_rules",
      "map_targets_placeholder",
      "collect_evidence_placeholder",
      "draft_finding_report"
    ],
    externalToolPolicy: "block_by_default",
    requiresApproval: true,
    stopConditions: [
      "Scope, authorization, or program rules are unclear.",
      "The next step could affect availability, billing, production data, or other users.",
      "The test requires bypassing rate limits, evading detection, persistence, or destructive testing.",
      "Evidence suggests access to real secrets, personal data, or privileged systems.",
      "The issue is proven enough to report safely."
    ],
    redactionRules: REDACTION_RULES
  },
  documentation: {
    mode: "documentation",
    allowedCapabilities: ["read_project_files", "generate_document"],
    externalToolPolicy: "block_by_default",
    requiresApproval: false,
    stopConditions: ["The document write would overwrite local files without approval."],
    redactionRules: REDACTION_RULES
  },
  security: {
    mode: "security",
    allowedCapabilities: ["read_project_files", "inspect_dependencies_placeholder", "secret_scan_placeholder"],
    externalToolPolicy: "block_by_default",
    requiresApproval: true,
    stopConditions: [
      "The next step would run a live network, dependency registry, or external security scan without approval.",
      "The output would expose secrets or sensitive configuration."
    ],
    redactionRules: REDACTION_RULES
  },
  operations: {
    mode: "operations",
    allowedCapabilities: ["read_logs_placeholder", "inspect_server_status_placeholder"],
    externalToolPolicy: "block_by_default",
    requiresApproval: true,
    stopConditions: ["The next step would access live logs, shells, servers, cloud APIs, or production systems."],
    redactionRules: REDACTION_RULES
  },
  personal_productivity: {
    mode: "personal_productivity",
    allowedCapabilities: ["read_calendar_placeholder", "read_email_placeholder", "create_task_placeholder"],
    externalToolPolicy: "block_by_default",
    requiresApproval: true,
    stopConditions: ["The next step would read or write real email, calendar, or task data."],
    redactionRules: REDACTION_RULES
  }
};

const BUG_BOUNTY_ACTIVE_TESTING_SIGNALS: readonly string[] = [
  "ddos",
  "dos",
  "brute force",
  "credential stuffing",
  "password spraying",
  "bypass rate limit",
  "dump database",
  "dump data",
  "steal",
  "destructive",
  "persistence",
  "evade detection",
  "out of scope",
  "without permission",
  "unauthorized"
];

export class SafetyPolicyEngine {
  evaluate(input: SafetyPolicyEngineInput): SafetyDecision {
    const evaluation = this.evaluatePolicy(input);

    return {
      allowed: evaluation.allowed,
      requiresApproval: evaluation.requiresApproval,
      externalToolsRequired: input.context.requiresExternalTools,
      summary: evaluation.summary,
      blockedCapabilities: evaluation.blockedCapabilities,
      details: formatPolicyDetails(evaluation),
      policyEvaluation: evaluation
    };
  }

  evaluatePolicy(input: SafetyPolicyEngineInput): SafetyPolicyEvaluation {
    const policy = MODE_POLICIES[input.context.selectedMode];
    const violations: SafetyPolicyViolation[] = [];
    const blockedCapabilities = new Set<Capability>();

    for (const capability of input.context.requiredCapabilities) {
      const definition = CAPABILITY_REGISTRY[capability];
      if (!policy.allowedCapabilities.includes(capability)) {
        blockedCapabilities.add(capability);
        violations.push({
          code: "capability_not_allowed",
          severity: "blocker",
          capability,
          message: `${capability} is not allowed in ${input.context.selectedMode} mode.`,
          recommendation: "Route the request to the correct mode or reduce the requested capability."
        });
        continue;
      }

      if (definition.executionKind === "external" && policy.externalToolPolicy === "block_by_default") {
        blockedCapabilities.add(capability);
        violations.push({
          code: "external_tool_blocked",
          severity: "warning",
          capability,
          message: `${capability} is blocked for execution by default in v0.1.`,
          recommendation: "Keep this as a placeholder until an explicit approval and adapter layer exists."
        });
      }
    }

    if (input.context.selectedMode === "bug_bounty") {
      violations.push(...evaluateBugBountyPolicy(input));
    }

    if (input.verificationResult && !input.verificationResult.accepted) {
      violations.push({
        code: "verification_failed",
        severity: "blocker",
        message: "Verification did not accept the proposal.",
        recommendation: "Fix failed verification checks before accepting or applying the proposal."
      });
    }

    const redaction = redactSensitiveText(input.context.originalInput);
    if (redaction.redacted) {
      violations.push({
        code: "secret_redaction_required",
        severity: "warning",
        message: `Sensitive-looking input matched redaction rules: ${redaction.appliedRules.join(", ")}.`,
        recommendation: "Store and share only redacted artifacts; rotate any real credential that was pasted."
      });
    }

    const hasBlocker = violations.some((violation) => violation.severity === "blocker");
    const requiresApproval =
      input.context.requiresUserApproval
      || input.proposal.requiresApproval
      || policy.requiresApproval
      || violations.some((violation) => violation.severity === "blocker");

    return {
      mode: input.context.selectedMode,
      allowed: !hasBlocker,
      requiresApproval,
      externalToolsBlocked: [...blockedCapabilities].some((capability) => CAPABILITY_REGISTRY[capability].executionKind === "external"),
      allowedCapabilities: policy.allowedCapabilities,
      blockedCapabilities: [...blockedCapabilities],
      stopConditions: policy.stopConditions,
      redactionRules: policy.redactionRules,
      violations,
      summary: summarizePolicy(input.context.selectedMode, !hasBlocker, violations)
    };
  }
}

export function policyForMode(mode: TaskMode): ModeSafetyPolicy {
  return MODE_POLICIES[mode];
}

export function redactSensitiveText(value: string): RedactionResult {
  const appliedRules: string[] = [];
  const redacted = REDACTION_PATTERNS.reduce((current, item) => {
    item.pattern.lastIndex = 0;
    const next = current.replace(item.pattern, item.replacement);
    if (next !== current) {
      appliedRules.push(item.id);
    }
    return next;
  }, value);

  return {
    value: redacted,
    redacted: redacted !== value,
    appliedRules: [...new Set(appliedRules)]
  };
}

function evaluateBugBountyPolicy(input: SafetyPolicyEngineInput): readonly SafetyPolicyViolation[] {
  const violations: SafetyPolicyViolation[] = [];
  const proposal = input.proposal.kind === "bug_bounty_review" ? input.proposal as BugBountyReviewProposal : undefined;

  if (proposal?.moochackerAssessment.safetyLevel === "blocked") {
    violations.push({
      code: "active_testing_stop_condition",
      severity: "blocker",
      message: "MoochackerAgent marked the requested bug bounty workflow as blocked.",
      recommendation: "Continue with passive clarification only until authorization, scope, and rules are safe."
    });
  }

  const normalized = input.context.originalInput.toLowerCase();
  const matchedStopSignal = BUG_BOUNTY_ACTIVE_TESTING_SIGNALS.find((signal) => hasTextSignal(normalized, signal));
  if (matchedStopSignal) {
    violations.push({
      code: "active_testing_stop_condition",
      severity: "blocker",
      message: `The request matched the active testing stop signal: ${matchedStopSignal}.`,
      recommendation: "Stop active testing and ask for safe, authorized scope details before proceeding."
    });
  }

  if (proposal?.moochackerAssessment.scopeStatus === "needs_clarification") {
    violations.push({
      code: "bug_bounty_scope_required",
      severity: "warning",
      message: "Bug bounty scope or authorization details are incomplete.",
      recommendation: "Collect in-scope assets, forbidden techniques, rate limits, test roles, and data handling rules."
    });
  }

  return violations;
}

function formatPolicyDetails(evaluation: SafetyPolicyEvaluation): readonly string[] {
  const details = [
    `policy mode: ${evaluation.mode}`,
    `policy allowed: ${evaluation.allowed ? "yes" : "no"}`,
    `external execution blocked by default: ${evaluation.externalToolsBlocked ? "yes" : "no"}`,
    `allowed capabilities: ${evaluation.allowedCapabilities.join(", ")}`
  ];

  if (evaluation.blockedCapabilities.length > 0) {
    details.push(`blocked execution capabilities: ${evaluation.blockedCapabilities.join(", ")}`);
  }

  if (evaluation.violations.length > 0) {
    details.push(...evaluation.violations.map((violation) => `${violation.severity}: ${violation.message}`));
  } else {
    details.push("policy violations: none");
  }

  return details;
}

function summarizePolicy(
  mode: TaskMode,
  allowed: boolean,
  violations: readonly SafetyPolicyViolation[]
): string {
  if (!allowed) {
    return `Safety policy blocked ${mode} mode until required conditions are resolved.`;
  }
  if (violations.length > 0) {
    return `Safety policy allowed passive ${mode} output with execution limits.`;
  }
  return `Safety policy allowed ${mode} mode with no violations.`;
}

function hasTextSignal(source: string, signal: string): boolean {
  if (/^[a-z0-9]+$/.test(signal) && signal.length <= 3) {
    return new RegExp(`\\b${signal}\\b`, "i").test(source);
  }

  return source.includes(signal);
}
