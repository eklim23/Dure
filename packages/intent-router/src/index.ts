import type { Capability, IntentRoute, TaskMode } from "@aegisforge/core";

const ALL_MODES: readonly TaskMode[] = [
  "assistant",
  "development",
  "documentation",
  "security",
  "operations",
  "personal_productivity"
];

const CAPABILITIES: Record<TaskMode, readonly Capability[]> = {
  assistant: ["answer_general_request"],
  development: ["read_project_files", "propose_file_changes", "run_tests_placeholder"],
  documentation: ["read_project_files", "generate_document"],
  security: ["read_project_files", "inspect_dependencies_placeholder", "secret_scan_placeholder"],
  operations: ["read_logs_placeholder", "inspect_server_status_placeholder"],
  personal_productivity: ["read_calendar_placeholder", "read_email_placeholder", "create_task_placeholder"]
};

const MODE_KEYWORDS: Record<TaskMode, readonly string[]> = {
  assistant: ["explain", "question", "help", "summarize", "what is", "how do", "설명", "질문", "도와", "요약"],
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
    "만들",
    "구현",
    "코드",
    "앱",
    "로그인",
    "게시판",
    "기능"
  ],
  documentation: [
    "readme",
    "document",
    "documentation",
    "report",
    "spec",
    "architecture",
    "draft",
    "문서",
    "보고서",
    "명세",
    "아키텍처",
    "초안",
    "정리"
  ],
  security: [
    "security",
    "threat",
    "risk",
    "vulnerability",
    "secret",
    "dependency",
    "audit",
    "보안",
    "위험",
    "취약",
    "시크릿",
    "의존성",
    "감사"
  ],
  operations: [
    "server",
    "deploy",
    "deployment",
    "status",
    "logs",
    "incident",
    "uptime",
    "서버",
    "배포",
    "상태",
    "로그",
    "운영",
    "장애"
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
    "일정",
    "캘린더",
    "메일",
    "이메일",
    "작업 목록",
    "할 일",
    "회의",
    "발표",
    "내일"
  ]
};

export class IntentRouter {
  route(input: string): IntentRoute {
    const normalized = normalizeInput(input);
    const scores = scoreModes(normalized);
    const selectedMode = selectMode(scores);
    const selectedScore = scores[selectedMode];

    return {
      inferredIntent: inferIntent(selectedMode),
      selectedMode,
      confidenceScore: confidenceFor(selectedMode, selectedScore),
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
  return mode === "operations" || mode === "personal_productivity";
}
