import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { RunStore } from "@dure/memory";
import { AssistantCore } from "../src/index";

test("assistant core routes development requests through development mode", () => {
  const result = new AssistantCore().run("Create a simple login-enabled bulletin board");

  assert.equal(result.context.selectedMode, "development");
  assert.equal(result.proposal.kind, "patch");
  assert.equal(result.verificationResult?.accepted, true);
  assert.ok(result.developmentProjectState);
});

test("assistant core routes documentation requests to document proposals", () => {
  const result = new AssistantCore().run("이 프로젝트 README 초안 만들어줘");

  assert.equal(result.context.selectedMode, "documentation");
  assert.equal(result.proposal.kind, "document");
});

test("assistant core supports bug bounty mode", () => {
  const result = new AssistantCore().run("버그바운티 스코프 확인하고 리포트 초안 만들어줘");

  assert.equal(result.context.selectedMode, "bug_bounty");
  assert.equal(result.proposal.kind, "bug_bounty_review");
  assert.ok(result.selectedAgentTeam.includes("MoochackerAgent"));
  assert.equal(result.proposal.moochackerAssessment.agent, "MoochackerAgent");
  assert.equal(result.safetyDecision.policyEvaluation?.mode, "bug_bounty");
  assert.ok(result.safetyDecision.blockedCapabilities.includes("map_targets_placeholder"));

  const teamEntry = result.decisionLog.entries.find((entry) => entry.type === "selected_agent_team");
  assert.ok(teamEntry);
  assert.deepEqual(teamEntry.data.selectedAgentTeam, result.selectedAgentTeam);

  const moochackerEntry = result.decisionLog.entries.find((entry) => entry.type === "agent_comments");
  assert.ok(moochackerEntry);
  assert.deepEqual(moochackerEntry.data.moochackerAssessment, result.proposal.moochackerAssessment);
});

test("assistant core supports explicit mode override", () => {
  const result = new AssistantCore().run("정리해줘", new Date("2026-06-27T00:00:00.000Z"), {
    modeOverride: "development"
  });

  assert.equal(result.context.selectedMode, "development");
  assert.equal(result.proposal.kind, "patch");
});

test("assistant core records assistant-level decisions", () => {
  const result = new AssistantCore().run("내일 발표 준비할 작업 목록 정리해줘");

  assert.equal(result.context.selectedMode, "personal_productivity");
  assert.deepEqual(
    result.decisionLog.entries.map((entry) => entry.type),
    [
      "original_user_input",
      "task_mode_selected",
      "routing_decision",
      "selected_agent_team",
      "proposal_produced",
      "safety_decision",
      "next_recommended_step"
    ]
  );
});

test("assistant core can persist a run record", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "dure-assistant-runs-"));
  const result = new AssistantCore().run("Draft a README for this project", new Date("2026-06-27T00:00:00.000Z"), {
    persist: true,
    runStoreRoot: path.join(root, ".dure", "runs")
  });

  assert.ok(result.runId);
  assert.ok(result.runRecord);
  assert.ok(result.runArtifactPaths);
  assert.equal(result.runRecord.status, "proposed");
  assert.equal(result.runRecord.selectedMode, "documentation");
  assert.ok(existsSync(result.runArtifactPaths.metadata));
  assert.ok(existsSync(result.runArtifactPaths.decisionLog));
});

test("assistant core persists development project state for development runs", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "dure-assistant-development-state-"));
  const workspaceRoot = path.join(root, "workspace");
  const runStoreRoot = path.join(root, ".dure", "runs");
  await mkdir(path.join(workspaceRoot, "src"), { recursive: true });
  await writeFile(path.join(workspaceRoot, "package.json"), JSON.stringify({ scripts: { test: "node --test" } }), "utf8");
  await writeFile(path.join(workspaceRoot, "package-lock.json"), "{}", "utf8");
  await writeFile(path.join(workspaceRoot, "src", "index.js"), "module.exports = true;\n", "utf8");

  const result = new AssistantCore().run("Create a small app", new Date("2026-06-27T00:00:00.000Z"), {
    modeOverride: "development",
    persist: true,
    runStoreRoot,
    workspaceRoot
  });
  assert.ok(result.runId);

  const preview = new RunStore(runStoreRoot).loadPreview(result.runId);
  const snapshot = new RunStore(runStoreRoot).createConsoleSnapshot(result.runId);

  assert.ok(preview.developmentProjectState);
  assert.equal(preview.developmentProjectState.packageManager, "npm");
  assert.equal(preview.developmentProjectState.scripts.find((script) => script.name === "test")?.configured, true);
  assert.ok(preview.artifactPaths.projectState);
  assert.ok(existsSync(preview.artifactPaths.projectState));
  assert.equal(preview.decisionLog.entries.some((entry) => entry.type === "development_project_state"), true);
  assert.equal(snapshot.projectState?.packageManager, "npm");
  assert.equal(snapshot.artifacts.hasProjectState, true);
});

test("assistant core persists MoochackerAgent in bug bounty run metadata", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "dure-assistant-bug-bounty-runs-"));
  const runStoreRoot = path.join(root, ".dure", "runs");
  const result = new AssistantCore().run(
    "Prepare an authorized bug bounty scope and evidence plan for an in scope API",
    new Date("2026-06-27T00:00:00.000Z"),
    {
      modeOverride: "bug_bounty",
      persist: true,
      runStoreRoot
    }
  );

  assert.ok(result.runId);

  const preview = new RunStore(runStoreRoot).loadPreview(result.runId);

  assert.ok(preview.metadata.selectedAgentTeam.includes("MoochackerAgent"));
  assert.equal(preview.proposal.kind, "bug_bounty_review");
  assert.equal(preview.proposal.moochackerAssessment.agent, "MoochackerAgent");
  assert.equal(preview.safetyDecision.policyEvaluation?.mode, "bug_bounty");
  assert.ok(preview.safetyDecision.blockedCapabilities.includes("collect_evidence_placeholder"));
});

test("assistant core does not persist when persist is false", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "dure-assistant-no-runs-"));
  const runStoreRoot = path.join(root, ".dure", "runs");
  const result = new AssistantCore().run("Draft a README for this project", new Date("2026-06-27T00:00:00.000Z"), {
    persist: false,
    runStoreRoot
  });

  assert.equal(result.runId, undefined);
  assert.equal(result.runRecord, undefined);
  assert.equal(existsSync(runStoreRoot), false);
});
