import type { Capability, IntentRoute, TaskMode } from "@dure/core";

export const PRIMARY_MODES: readonly TaskMode[] = ["development", "bug_bounty"];

const ALL_MODES: readonly TaskMode[] = [
  "assistant",
  "development",
  "bug_bounty",
  "documentation",
  "security",
  "operations",
  "personal_productivity"
];

const CAPABILITIES: Record<TaskMode, readonly Capability[]> = {
  assistant: ["answer_general_request"],
  development: ["read_project_files", "propose_file_changes", "run_tests_placeholder"],
  bug_bounty: [
    "confirm_bug_bounty_scope",
    "review_program_rules",
    "map_targets_placeholder",
    "collect_evidence_placeholder",
    "draft_finding_report"
  ],
  documentation: ["read_project_files", "generate_document"],
  security: ["read_project_files", "inspect_dependencies_placeholder", "secret_scan_placeholder"],
  operations: ["read_logs_placeholder", "inspect_server_status_placeholder"],
  personal_productivity: ["read_calendar_placeholder", "read_email_placeholder", "create_task_placeholder"]
};

const MODE_KEYWORDS: Record<TaskMode, readonly string[]> = {
  assistant: [
    "explain",
    "question",
    "help",
    "summarize",
    "what is",
    "how do",
    "\uc124\uba85",
    "\uc9c8\ubb38",
    "\ub3c4\uc640",
    "\uc694\uc57d"
  ],
  development: [
    "create",
    "build",
    "implement",
    "code",
    "app",
    "api",
    "login",
    "bulletin",
    "board",
    "feature",
    "\ub9cc\ub4e4",
    "\uad6c\ud604",
    "\ucf54\ub4dc",
    "\uc571",
    "\ub85c\uadf8\uc778",
    "\uac8c\uc2dc\ud310",
    "\uae30\ub2a5"
  ],
  bug_bounty: [
    "bug bounty",
    "bug-bounty",
    "bounty",
    "burp",
    "idor",
    "xss",
    "ssrf",
    "csrf",
    "scope",
    "program rules",
    "finding",
    "poc",
    "reproduce",
    "endpoint map",
    "\ubc84\uadf8\ubc14\uc6b4\ud2f0",
    "\ucde8\uc57d\uc810",
    "\uc81c\ubcf4",
    "\uc2a4\ucf54\ud504",
    "\ud5c8\uac00",
    "\uc778\uc99d \ubc94\uc704",
    "\uc5d4\ub4dc\ud3ec\uc778\ud2b8",
    "\ub9ac\ud3ec\ud2b8",
    "\uc99d\uac70",
    "\uc7ac\ud604",
    "\uc6f9 \ucde8\uc57d\uc810"
  ],
  documentation: [
    "readme",
    "document",
    "documentation",
    "report",
    "spec",
    "architecture",
    "draft",
    "\ubb38\uc11c",
    "\ubcf4\uace0\uc11c",
    "\uba85\uc138",
    "\uc544\ud0a4\ud14d\ucc98",
    "\ucd08\uc548",
    "\uc815\ub9ac"
  ],
  security: [
    "security",
    "threat",
    "risk",
    "vulnerability",
    "secret",
    "dependency",
    "audit",
    "\ubcf4\uc548",
    "\uc704\ud5d8",
    "\ucde8\uc57d",
    "\uc2dc\ud06c\ub9bf",
    "\uc758\uc874\uc131",
    "\uac10\uc0ac"
  ],
  operations: [
    "server",
    "deploy",
    "deployment",
    "status",
    "logs",
    "incident",
    "uptime",
    "\uc11c\ubc84",
    "\ubc30\ud3ec",
    "\uc0c1\ud0dc",
    "\ub85c\uadf8",
    "\uc6b4\uc601",
    "\uc7a5\uc560"
  ],
  personal_productivity: [
    "schedule",
    "calendar",
    "email",
    "task list",
    "todo list",
    "meeting",
    "presentation",
    "plan my day",
    "\uc77c\uc815",
    "\uce98\ub9b0\ub354",
    "\uba54\uc77c",
    "\uc774\uba54\uc77c",
    "\uc791\uc5c5 \ubaa9\ub85d",
    "\ud560 \uc77c",
    "\ud68c\uc758",
    "\ubc1c\ud45c",
    "\ub0b4\uc77c"
  ]
};

export class IntentRouter {
  route(input: string, modeOverride?: TaskMode): IntentRoute {
    const normalized = normalizeInput(input);
    const scores = scoreModes(normalized);
    const selectedMode = modeOverride ?? selectMode(scores);
    const selectedScore = modeOverride ? 5 : scores[selectedMode];

    return {
      inferredIntent: inferIntent(selectedMode),
      selectedMode,
      confidenceScore: modeOverride ? 1 : confidenceFor(selectedMode, selectedScore),
      assumptions: assumptionsFor(selectedMode),
      requiredCapabilities: CAPABILITIES[selectedMode],
      safetyRequirements: safetyRequirementsFor(selectedMode),
      requiresUserApproval: requiresApproval(selectedMode),
      requiresExternalTools: requiresExternalTools(selectedMode),
      rejectedModes: ALL_MODES.filter((mode) => mode !== selectedMode)
    };
  }
}

export function capabilitiesForMode(mode: TaskMode): readonly Capability[] {
  return CAPABILITIES[mode];
}

export function isTaskMode(value: string): value is TaskMode {
  return ALL_MODES.includes(value as TaskMode);
}

function normalizeInput(input: string): string {
  const normalized = input.trim().replace(/\s+/g, " ");
  if (normalized.length === 0) {
    throw new Error("A natural language assistant request is required.");
  }
  return normalized.toLowerCase();
}

function scoreModes(input: string): Record<TaskMode, number> {
  const scores = Object.fromEntries(ALL_MODES.map((mode) => [mode, 0])) as Record<TaskMode, number>;

  for (const mode of ALL_MODES) {
    for (const keyword of MODE_KEYWORDS[mode]) {
      if (input.includes(keyword.toLowerCase())) {
        scores[mode] += keyword.length > 6 ? 2 : 1;
      }
    }
  }

  if (scores.documentation > 0 && scores.development > 0 && input.includes("readme")) {
    scores.documentation += 3;
  }

  if (scores.bug_bounty > 0 && scores.security > 0) {
    scores.bug_bounty += 2;
  }

  if (scores.security > 0 && input.includes("code")) {
    scores.security += 1;
  }

  if (scores.personal_productivity > 0 && input.includes("app")) {
    scores.development += 2;
  }

  return scores;
}

function selectMode(scores: Record<TaskMode, number>): TaskMode {
  const ranked = [...ALL_MODES].sort((left, right) => scores[right] - scores[left]);
  const [best] = ranked;
  return scores[best] === 0 ? "assistant" : best;
}

function confidenceFor(mode: TaskMode, score: number): number {
  if (mode === "assistant" && score === 0) {
    return 0.62;
  }
  return Math.min(0.95, 0.55 + score * 0.08);
}

function inferIntent(mode: TaskMode): string {
  switch (mode) {
    case "assistant":
      return "Answer or structure a general assistant request safely.";
    case "development":
      return "Plan and propose the smallest safe development step.";
    case "bug_bounty":
      return "Prepare an authorized bug bounty workflow with scope, evidence, and reporting gates.";
    case "documentation":
      return "Create or improve documentation as a structured proposal.";
    case "security":
      return "Review security posture using safe local and placeholder checks.";
    case "operations":
      return "Plan operational review steps without touching live systems.";
    case "personal_productivity":
      return "Organize personal tasks without accessing real calendar or email integrations.";
  }
}

function assumptionsFor(mode: TaskMode): readonly string[] {
  const common = ["The request should be handled with deterministic v0.1 behavior."];
  switch (mode) {
    case "assistant":
      return [...common, "No external tools are required for the first response."];
    case "development":
      return [...common, "Code changes must remain proposals until explicitly approved."];
    case "bug_bounty":
      return [
        ...common,
        "Bug bounty work requires explicit authorization and program scope before active testing.",
        "Dure v0.1 produces passive plans and report scaffolds only."
      ];
    case "documentation":
      return [...common, "Generated documentation should be reviewable before file writes."];
    case "security":
      return [...common, "Security findings are advisory until backed by approved scans."];
    case "operations":
      return [...common, "Live server, shell, cloud, and network inspection are placeholders in v0.1."];
    case "personal_productivity":
      return [...common, "Calendar, email, and task integrations are placeholders in v0.1."];
  }
}

function safetyRequirementsFor(mode: TaskMode): readonly string[] {
  switch (mode) {
    case "assistant":
      return ["Return structured help without external side effects."];
    case "development":
      return ["Use Single Writer, Multi Reviewer.", "Run verification before accepting patch proposals."];
    case "bug_bounty":
      return [
        "Confirm target scope and authorization before active testing.",
        "Use minimal-impact verification only after approval.",
        "Do not access, dump, alter, or publish real user data.",
        "Redact credentials, cookies, tokens, personal data, and internal identifiers."
      ];
    case "documentation":
      return ["Do not overwrite documents automatically.", "Keep generated content as a proposal."];
    case "security":
      return ["Do not expose secrets.", "Do not run dependency or network scans without approval."];
    case "operations":
      return ["Do not access live logs, shells, servers, or cloud APIs in v0.1."];
    case "personal_productivity":
      return ["Do not access real email, calendar, or task systems in v0.1."];
  }
}

function requiresApproval(mode: TaskMode): boolean {
  return mode !== "assistant" && mode !== "documentation";
}

function requiresExternalTools(mode: TaskMode): boolean {
  return mode === "bug_bounty" || mode === "operations" || mode === "personal_productivity";
}
