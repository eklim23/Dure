import assert from "node:assert/strict";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import type { AssistantRequestContext } from "@dure/core";
import { TaskModeRunner } from "../src/index";

test("development mode reuses the existing patch orchestrator", () => {
  const result = new TaskModeRunner().execute(context("development", "Create a simple login-enabled bulletin board"));

  assert.equal(result.proposal.kind, "patch");
  assert.equal(result.verificationResult?.accepted, true);
  assert.equal(result.safetyDecision.allowed, true);
  assert.equal(result.safetyDecision.policyEvaluation?.mode, "development");
  assert.ok(result.developmentResult);
  assert.equal(result.selectedAgentTeam.includes("MoochackerAgent"), false);
});

test("development mode detects local project state without running scripts", async () => {
  const workspaceRoot = await mkdtemp(path.join(tmpdir(), "dure-project-state-"));
  await mkdir(path.join(workspaceRoot, "src"), { recursive: true });
  await mkdir(path.join(workspaceRoot, "docs"), { recursive: true });
  await writeFile(path.join(workspaceRoot, "pnpm-lock.yaml"), "lockfileVersion: '9.0'\n", "utf8");
  await writeFile(
    path.join(workspaceRoot, "package.json"),
    JSON.stringify({
      scripts: {
        test: "node --test",
        typecheck: "tsc --noEmit",
        build: "tsc -b"
      },
      dependencies: {
        react: "latest"
      },
      devDependencies: {
        vite: "latest",
        typescript: "latest"
      }
    }),
    "utf8"
  );
  await writeFile(path.join(workspaceRoot, "src", "index.ts"), "export const ok = true;\n", "utf8");
  await writeFile(path.join(workspaceRoot, "src", "index.test.ts"), "import 'node:test';\n", "utf8");
  await writeFile(path.join(workspaceRoot, "docs", "architecture.md"), "# Architecture\n", "utf8");

  const result = new TaskModeRunner().execute(
    context("development", "Add a small feature"),
    { workspaceRoot, now: new Date("2026-06-28T00:00:00.000Z") }
  );
  const state = result.developmentProjectState;

  assert.ok(state);
  assert.equal(state.packageManager, "pnpm");
  assert.ok(state.packageManagerEvidence.includes("pnpm-lock.yaml"));
  assert.ok(state.languages.some((item) => item.language === "typescript"));
  assert.ok(state.frameworks.includes("react"));
  assert.ok(state.frameworks.includes("vite"));
  assert.equal(state.scripts.find((script) => script.name === "test")?.configured, true);
  assert.equal(state.scripts.find((script) => script.name === "lint")?.configured, false);
  assert.equal(state.currentMvpStage.stage.id, 4);
  assert.equal(state.notes.some((note) => note.includes("no scripts or external commands were executed")), true);
});

test("documentation mode returns a document proposal", () => {
  const result = new TaskModeRunner().execute(context("documentation", "Draft a README"));

  assert.equal(result.proposal.kind, "document");
  assert.equal(result.safetyDecision.allowed, true);
});

test("bug bounty mode returns a scoped review proposal", () => {
  const result = new TaskModeRunner().execute(
    context("bug_bounty", "Prepare an authorized bug bounty report for an in scope API with test accounts")
  );

  assert.equal(result.proposal.kind, "bug_bounty_review");
  assert.deepEqual(result.selectedAgentTeam, [
    "BugBountyAgent",
    "MoochackerAgent",
    "ScopeGuardAgent",
    "EvidenceAgent",
    "ReviewerAgent"
  ]);
  assert.equal(result.proposal.riskLevel, "high");
  assert.equal(result.proposal.requiresApproval, true);
  assert.equal(result.proposal.moochackerAssessment.agent, "MoochackerAgent");
  assert.equal(result.proposal.moochackerAssessment.scopeStatus, "sufficient");
  assert.equal(result.proposal.moochackerAssessment.safetyLevel, "caution");
  assert.ok(result.proposal.scopeGate.some((item) => item.includes("authorized")));
  assert.ok(result.proposal.stopConditions.some((item) => item.includes("availability")));
  assert.ok(result.proposal.stopConditions.some((item) => item.includes("personal data")));
  assert.ok(result.proposal.moochackerAssessment.evidenceGuidance.some((item) => item.includes("minimal-impact")));
  assert.ok(result.proposal.moochackerAssessment.redactionRequirements.some((item) => item.includes("Redact")));
  assert.equal(result.safetyDecision.allowed, true);
  assert.ok(result.safetyDecision.blockedCapabilities.includes("map_targets_placeholder"));
  assert.ok(result.safetyDecision.blockedCapabilities.includes("collect_evidence_placeholder"));
  assert.ok(result.safetyDecision.policyEvaluation?.violations.some((violation) => violation.code === "external_tool_blocked"));
});

test("moochacker blocks unsafe bug bounty requests", () => {
  const result = new TaskModeRunner().execute(
    context("bug_bounty", "Run a DDoS test and bypass rate limits against an out of scope target")
  );

  assert.equal(result.proposal.kind, "bug_bounty_review");
  assert.equal(result.proposal.moochackerAssessment.scopeStatus, "out_of_scope");
  assert.equal(result.proposal.moochackerAssessment.safetyLevel, "blocked");
  assert.ok(result.proposal.moochackerAssessment.blockedActions.some((item) => item.includes("denial-of-service")));
  assert.equal(result.safetyDecision.allowed, false);
  assert.ok(result.safetyDecision.policyEvaluation?.violations.some((violation) => violation.code === "active_testing_stop_condition"));
  assert.match(result.nextRecommendedAction, /Do not proceed/);
});

function context(selectedMode: AssistantRequestContext["selectedMode"], originalInput: string): AssistantRequestContext {
  return {
    originalInput,
    inferredIntent: "Test intent.",
    selectedMode,
    confidenceScore: 0.8,
    assumptions: ["Test assumption."],
    requiredCapabilities: capabilitiesFor(selectedMode),
    safetyRequirements: ["No external side effects."],
    requiresUserApproval: selectedMode !== "assistant",
    requiresExternalTools: false,
    rejectedModes: [],
    createdAt: "2026-06-27T00:00:00.000Z"
  };
}

function capabilitiesFor(selectedMode: AssistantRequestContext["selectedMode"]): AssistantRequestContext["requiredCapabilities"] {
  switch (selectedMode) {
    case "assistant":
      return ["answer_general_request"];
    case "development":
      return ["read_project_files", "propose_file_changes", "run_tests_placeholder"];
    case "bug_bounty":
      return [
        "confirm_bug_bounty_scope",
        "review_program_rules",
        "record_passive_target_map",
        "map_targets_placeholder",
        "collect_evidence_placeholder",
        "draft_finding_report"
      ];
    case "documentation":
      return ["read_project_files", "generate_document"];
    case "security":
      return ["read_project_files", "inspect_dependencies_placeholder", "secret_scan_placeholder"];
    case "operations":
      return ["read_logs_placeholder", "inspect_server_status_placeholder"];
    case "personal_productivity":
      return ["read_calendar_placeholder", "read_email_placeholder", "create_task_placeholder"];
  }
}
