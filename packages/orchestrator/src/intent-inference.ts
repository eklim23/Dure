import type { AgentRole, GoalState, RiskLevel } from "@aegisforge/core";
import { MvpLadder } from "./mvp-ladder";

const DEFAULT_AGENTS: readonly AgentRole[] = [
  "IntentAgent",
  "ProductAgent",
  "ArchitectAgent",
  "SecurityAgent",
  "MaintainerAgent",
  "TesterAgent",
  "ReviewerAgent",
  "BuilderAgent"
];

export class IntentInferenceEngine {
  private readonly ladder = new MvpLadder();

  infer(rawRequest: string, now = new Date()): GoalState {
    const request = normalizeRequest(rawRequest);
    const riskLevel = inferRiskLevel(request);
    const projectKind = inferProjectKind(request);

    return {
      rawRequest,
      inferredGoal: `Build ${articleFor(projectKind)} ${projectKind}.`,
      mvpScope: inferMvpScope(request),
      deferredScope: inferDeferredScope(request),
      assumptions: inferAssumptions(request),
      riskLevel,
      requiredAgents: DEFAULT_AGENTS,
      suggestedPhases: this.ladder.asDevelopmentPhases(),
      createdAt: now.toISOString()
    };
  }
}

function normalizeRequest(rawRequest: string): string {
  const trimmed = rawRequest.trim().replace(/\s+/g, " ");
  if (trimmed.length === 0) {
    throw new Error("A natural language development request is required.");
  }
  return trimmed;
}

function inferProjectKind(request: string): string {
  const lower = request.toLowerCase();

  if (lower.includes("bulletin") || lower.includes("board")) {
    if (lower.includes("login") || lower.includes("auth")) {
      return "simple login-enabled bulletin board";
    }
    return "simple bulletin board";
  }

  if (lower.includes("todo") || lower.includes("to-do")) {
    return "small todo application";
  }

  if (lower.includes("api")) {
    return "small API service";
  }

  if (lower.includes("cli")) {
    return "small CLI tool";
  }

  return "small software project";
}

function inferRiskLevel(request: string): RiskLevel {
  const lower = request.toLowerCase();
  const highRiskTerms = ["login", "auth", "password", "payment", "token", "private", "admin"];
  const mediumRiskTerms = ["database", "deploy", "api", "upload", "email", "webhook"];

  if (highRiskTerms.some((term) => lower.includes(term))) {
    return "high";
  }

  if (mediumRiskTerms.some((term) => lower.includes(term))) {
    return "medium";
  }

  return "low";
}

function inferMvpScope(request: string): readonly string[] {
  const lower = request.toLowerCase();
  const scope = [
    "Executable project skeleton with one clear run command.",
    "One demonstrable core workflow before feature expansion.",
    "Decision log and verification gate for every proposed change."
  ];

  if (lower.includes("bulletin") || lower.includes("board")) {
    scope.push("Create and list bulletin-board posts using a local deterministic store.");
  }

  if (lower.includes("login") || lower.includes("auth")) {
    scope.push("Auth boundary stub with explicit assumptions; no production password storage in the first patch.");
  }

  return scope;
}

function inferDeferredScope(request: string): readonly string[] {
  const lower = request.toLowerCase();
  const deferred = [
    "Polished web dashboard.",
    "Production deployment automation.",
    "Multi-agent autonomous file modification without review."
  ];

  if (lower.includes("login") || lower.includes("auth")) {
    deferred.push("Password reset, email verification, OAuth, role administration, and production session hardening.");
  }

  if (lower.includes("bulletin") || lower.includes("board")) {
    deferred.push("Moderation queues, search, rich text editing, notifications, and database persistence.");
  }

  return deferred;
}

function inferAssumptions(request: string): readonly string[] {
  const lower = request.toLowerCase();
  const assumptions = [
    "The first step should optimize for a stable MVP, not full feature breadth.",
    "The project should run without external LLM API keys.",
    "Patch generation must remain controlled by the single-writer policy."
  ];

  if (lower.includes("login") || lower.includes("auth")) {
    assumptions.push("Authentication is security-sensitive and must be staged behind review.");
  }

  return assumptions;
}

function articleFor(projectKind: string): "a" | "an" {
  return /^[aeiou]/i.test(projectKind) ? "an" : "a";
}
