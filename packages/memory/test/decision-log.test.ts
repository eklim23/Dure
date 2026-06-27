import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import type {
  AssistantRequestContext,
  BugBountyEvidenceInput,
  SafetyDecision,
  TaskModeProposal,
  VerificationResult
} from "@dure/core";
import { createRunId, DecisionLogRecorder, RunStore } from "../src/index";

test("decision log records typed entries in order", () => {
  const recorder = new DecisionLogRecorder();
  recorder.append("inferred_goal", "Goal inferred.", { goal: "Build a test project." });
  recorder.append("verification_result", "Verification passed.", { accepted: true });

  const log = recorder.toDecisionLog();
  assert.equal(log.entries.length, 2);
  assert.equal(log.entries[0].type, "inferred_goal");
  assert.equal(log.entries[1].data.accepted, true);
});

test("createRunId uses the expected timestamp and entropy format", () => {
  const runId = createRunId(new Date("2026-06-27T00:00:00.000Z"));

  assert.match(runId, /^run-20260627-000000Z-[0-9a-f]{6}$/);
});

test("run store persists parseable run artifacts and JSONL decisions", async () => {
  const tempRoot = await mkdtemp(path.join(tmpdir(), "dure-runs-"));
  const store = new RunStore(path.join(tempRoot, ".dure", "runs"));
  const log = new DecisionLogRecorder();
  log.append("original_user_input", "Input recorded.", { originalInput: "hello" });
  log.append("proposal_produced", "Proposal recorded.", { proposalKind: "assistant_response" });

  const record = store.persistRun({
    context: contextFixture(),
    selectedAgentTeam: ["AssistantAgent"],
    proposal: proposalFixture(),
    safetyDecision: safetyFixture(),
    decisionLog: log.toDecisionLog(),
    nextRecommendedAction: "Review the structured proposal.",
    now: new Date("2026-06-27T00:00:01.000Z")
  });

  assert.equal(record.status, "proposed");
  assert.equal(record.selectedMode, "assistant");
  assert.ok(record.artifactPaths.runDir.startsWith(path.join(tempRoot, ".dure", "runs")));
  assert.ok(existsSync(record.artifactPaths.request));
  assert.ok(existsSync(record.artifactPaths.context));
  assert.ok(existsSync(record.artifactPaths.proposal));
  assert.ok(existsSync(record.artifactPaths.safety));
  assert.ok(existsSync(record.artifactPaths.metadata));

  const request = JSON.parse(await readFile(record.artifactPaths.request, "utf8")) as { originalInput: string };
  const proposal = JSON.parse(await readFile(record.artifactPaths.proposal, "utf8")) as { kind: string };
  const metadata = JSON.parse(await readFile(record.artifactPaths.metadata, "utf8")) as { id: string };
  const decisionLines = (await readFile(record.artifactPaths.decisionLog, "utf8")).trim().split("\n");

  assert.equal(request.originalInput, "hello");
  assert.equal(proposal.kind, "assistant_response");
  assert.equal(metadata.id, record.id);
  assert.equal(decisionLines.length, 2);
  assert.deepEqual(
    decisionLines.map((line) => JSON.parse(line) as { type: string }).map((entry) => entry.type),
    ["original_user_input", "proposal_produced"]
  );
});

test("run store loads a persisted development patch preview", async () => {
  const tempRoot = await mkdtemp(path.join(tmpdir(), "dure-preview-"));
  const store = new RunStore(path.join(tempRoot, ".dure", "runs"));
  const log = new DecisionLogRecorder();
  log.append("original_user_input", "Input recorded.", { originalInput: "Create a small app." });
  log.append("proposal_produced", "Patch proposal recorded.", { proposalKind: "patch" });

  const record = store.persistRun({
    context: developmentContextFixture(),
    selectedAgentTeam: ["IntentAgent", "ProductAgent", "BuilderAgent", "ReviewerAgent"],
    proposal: patchProposalFixture(),
    safetyDecision: safetyFixture(),
    verificationResult: verificationFixture(),
    decisionLog: log.toDecisionLog(),
    nextRecommendedAction: "Preview the patch before approval.",
    now: new Date("2026-06-27T00:00:02.000Z")
  });

  const preview = store.loadPreview(record.id);

  assert.equal(preview.metadata.id, record.id);
  assert.equal(preview.metadata.selectedMode, "development");
  assert.equal(preview.metadata.proposalKind, "patch");
  assert.equal(preview.metadata.nextRecommendedAction, "Preview the patch before approval.");
  assert.equal(preview.request.originalInput, "Create a small app.");
  assert.equal(preview.proposal.kind, "patch");
  assert.equal(preview.proposal.changes[0].path, "package.json");
  assert.equal(preview.verificationResult?.accepted, true);
  assert.equal(preview.decisionLog.entries.length, 2);
  assert.ok(preview.artifactPaths.runDir.endsWith(record.id));
});

test("run store rejects unsafe and missing run ids", async () => {
  const tempRoot = await mkdtemp(path.join(tmpdir(), "dure-preview-missing-"));
  const store = new RunStore(path.join(tempRoot, ".dure", "runs"));

  assert.throws(() => store.loadPreview("../outside"), /Invalid run id/);
  assert.throws(() => store.loadPreview("run-20260627-000000Z-ffffff"), /Run not found/);
});

test("run store reports malformed artifact names", async () => {
  const tempRoot = await mkdtemp(path.join(tmpdir(), "dure-preview-bad-"));
  const runId = "run-20260627-000000Z-abcdef";
  const runDir = path.join(tempRoot, ".dure", "runs", runId);
  await mkdir(runDir, { recursive: true });

  await writeFile(path.join(runDir, "metadata.json"), `${JSON.stringify(metadataFixture(runId))}\n`, "utf8");
  await writeFile(path.join(runDir, "request.json"), `${JSON.stringify({ originalInput: "hello", receivedAt: "2026-06-27T00:00:00.000Z" })}\n`, "utf8");
  await writeFile(path.join(runDir, "context.json"), `${JSON.stringify(contextFixture())}\n`, "utf8");
  await writeFile(path.join(runDir, "proposal.json"), "{not-json", "utf8");
  await writeFile(path.join(runDir, "safety.json"), `${JSON.stringify(safetyFixture())}\n`, "utf8");
  await writeFile(path.join(runDir, "decision-log.jsonl"), "", "utf8");

  const store = new RunStore(path.join(tempRoot, ".dure", "runs"));

  assert.throws(() => store.loadPreview(runId), /Malformed run artifact: proposal\.json/);
});

test("run store approves a verified patch proposal", async () => {
  const tempRoot = await mkdtemp(path.join(tmpdir(), "dure-approve-"));
  const store = new RunStore(path.join(tempRoot, ".dure", "runs"));
  const record = store.persistRun({
    context: developmentContextFixture(),
    selectedAgentTeam: ["BuilderAgent", "ReviewerAgent"],
    proposal: patchProposalFixture(),
    safetyDecision: safetyFixture(),
    verificationResult: verificationFixture(),
    decisionLog: { entries: [] },
    nextRecommendedAction: "Preview the patch before approval.",
    now: new Date("2026-06-27T00:00:03.000Z")
  });

  const approval = store.approveRun(record.id, {
    reason: "Reviewed preview output.",
    now: new Date("2026-06-27T00:00:04.000Z")
  });
  const preview = store.loadPreview(record.id);

  assert.equal(approval.decision, "approved");
  assert.equal(approval.reason, "Reviewed preview output.");
  assert.equal(preview.metadata.status, "approved");
  assert.equal(preview.approvalRecord?.decision, "approved");
  assert.ok(preview.artifactPaths.approval);
  assert.ok(existsSync(preview.artifactPaths.approval));
  assert.equal(preview.decisionLog.entries.at(-1)?.type, "approval_decision");
});

test("run store rejects duplicate, non-patch, and unverified approvals", async () => {
  const tempRoot = await mkdtemp(path.join(tmpdir(), "dure-approve-reject-"));
  const store = new RunStore(path.join(tempRoot, ".dure", "runs"));
  const patchRecord = store.persistRun({
    context: developmentContextFixture(),
    selectedAgentTeam: ["BuilderAgent", "ReviewerAgent"],
    proposal: patchProposalFixture(),
    safetyDecision: safetyFixture(),
    verificationResult: verificationFixture(),
    decisionLog: { entries: [] },
    nextRecommendedAction: "Preview the patch before approval.",
    now: new Date("2026-06-27T00:00:05.000Z")
  });
  const nonPatchRecord = store.persistRun({
    context: contextFixture(),
    selectedAgentTeam: ["AssistantAgent"],
    proposal: proposalFixture(),
    safetyDecision: safetyFixture(),
    decisionLog: { entries: [] },
    nextRecommendedAction: "Review the structured proposal.",
    now: new Date("2026-06-27T00:00:06.000Z")
  });
  const failedRecord = store.persistRun({
    context: developmentContextFixture(),
    selectedAgentTeam: ["BuilderAgent", "ReviewerAgent"],
    proposal: patchProposalFixture(),
    safetyDecision: safetyFixture(),
    verificationResult: verificationFixture(false),
    decisionLog: { entries: [] },
    nextRecommendedAction: "Fix verification failures.",
    now: new Date("2026-06-27T00:00:07.000Z")
  });

  store.approveRun(patchRecord.id, { now: new Date("2026-06-27T00:00:08.000Z") });

  assert.throws(() => store.approveRun("../outside"), /Invalid run id/);
  assert.throws(() => store.approveRun(patchRecord.id), /current status is approved/);
  assert.throws(() => store.approveRun(nonPatchRecord.id), /not a patch proposal/);
  assert.throws(() => store.approveRun(failedRecord.id), /verification has not accepted/);
});

test("run store applies an approved patch to a controlled workspace", async () => {
  const tempRoot = await mkdtemp(path.join(tmpdir(), "dure-apply-"));
  const store = new RunStore(path.join(tempRoot, ".dure", "runs"));
  const record = store.persistRun({
    context: developmentContextFixture(),
    selectedAgentTeam: ["BuilderAgent", "ReviewerAgent"],
    proposal: patchProposalFixture(),
    safetyDecision: safetyFixture(),
    verificationResult: verificationFixture(),
    decisionLog: { entries: [] },
    nextRecommendedAction: "Preview the patch before approval.",
    now: new Date("2026-06-27T00:00:12.000Z")
  });

  store.approveRun(record.id, { now: new Date("2026-06-27T00:00:13.000Z") });
  const applied = store.applyRun(record.id, { now: new Date("2026-06-27T00:00:14.000Z") });
  const preview = store.loadPreview(record.id);
  const appliedFile = path.join(tempRoot, ".dure", "workspaces", record.id, "package.json");

  assert.equal(applied.nextStatus, "applied");
  assert.equal(preview.metadata.status, "applied");
  assert.equal(preview.applyRecord?.runId, record.id);
  assert.equal(preview.rollbackRecord?.rollbackImplemented, false);
  assert.ok(existsSync(appliedFile));
  assert.equal(preview.decisionLog.entries.at(-1)?.type, "patch_applied");
  assert.throws(() => store.applyRun(record.id), /current status is applied/);
});

test("run store verifies an applied workspace with allow-listed scripts", async () => {
  const tempRoot = await mkdtemp(path.join(tmpdir(), "dure-verify-"));
  const store = new RunStore(path.join(tempRoot, ".dure", "runs"));
  const record = store.persistRun({
    context: developmentContextFixture(),
    selectedAgentTeam: ["BuilderAgent", "ReviewerAgent"],
    proposal: verifiablePatchProposalFixture(),
    safetyDecision: safetyFixture(),
    verificationResult: verificationFixture(),
    decisionLog: { entries: [] },
    nextRecommendedAction: "Preview the patch before approval.",
    now: new Date("2026-06-27T00:00:23.000Z")
  });

  store.approveRun(record.id, { now: new Date("2026-06-27T00:00:24.000Z") });
  store.applyRun(record.id, { now: new Date("2026-06-27T00:00:25.000Z") });
  const verification = store.verifyRun(record.id, {
    scripts: ["test"],
    now: new Date("2026-06-27T00:00:26.000Z")
  });
  const preview = store.loadPreview(record.id);

  assert.equal(verification.accepted, true);
  assert.equal(verification.nextStatus, "verified");
  assert.equal(preview.metadata.status, "verified");
  assert.equal(preview.workspaceVerificationRecord?.accepted, true);
  assert.ok(preview.artifactPaths.workspaceVerification);
  assert.ok(existsSync(preview.artifactPaths.workspaceVerification));
  assert.equal(preview.decisionLog.entries.at(-1)?.type, "workspace_verification_result");
});

test("run store marks failed workspace verification as failed", async () => {
  const tempRoot = await mkdtemp(path.join(tmpdir(), "dure-verify-failed-"));
  const store = new RunStore(path.join(tempRoot, ".dure", "runs"));
  const record = store.persistRun({
    context: developmentContextFixture(),
    selectedAgentTeam: ["BuilderAgent", "ReviewerAgent"],
    proposal: failingVerificationPatchProposalFixture(),
    safetyDecision: safetyFixture(),
    verificationResult: verificationFixture(),
    decisionLog: { entries: [] },
    nextRecommendedAction: "Preview the patch before approval.",
    now: new Date("2026-06-27T00:00:27.000Z")
  });

  store.approveRun(record.id, { now: new Date("2026-06-27T00:00:28.000Z") });
  store.applyRun(record.id, { now: new Date("2026-06-27T00:00:29.000Z") });
  const verification = store.verifyRun(record.id, {
    scripts: ["test"],
    now: new Date("2026-06-27T00:00:30.000Z")
  });
  const preview = store.loadPreview(record.id);

  assert.equal(verification.accepted, false);
  assert.equal(verification.commands[0].status, "failed");
  assert.equal(preview.metadata.status, "failed");
  assert.throws(() => store.verifyRun(record.id), /current status is failed/);
});

test("run store rejects unsafe workspace verification states", async () => {
  const tempRoot = await mkdtemp(path.join(tmpdir(), "dure-verify-reject-"));
  const store = new RunStore(path.join(tempRoot, ".dure", "runs"));
  const record = store.persistRun({
    context: developmentContextFixture(),
    selectedAgentTeam: ["BuilderAgent", "ReviewerAgent"],
    proposal: verifiablePatchProposalFixture(),
    safetyDecision: safetyFixture(),
    verificationResult: verificationFixture(),
    decisionLog: { entries: [] },
    nextRecommendedAction: "Preview the patch before approval.",
    now: new Date("2026-06-27T00:00:31.000Z")
  });

  assert.throws(() => store.verifyRun(record.id), /current status is proposed/);
  store.approveRun(record.id, { now: new Date("2026-06-27T00:00:32.000Z") });
  assert.throws(() => store.verifyRun(record.id), /current status is approved/);
  store.applyRun(record.id, {
    workspaceRoot: path.join(tempRoot, "workspace"),
    now: new Date("2026-06-27T00:00:33.000Z")
  });
  assert.throws(
    () => store.verifyRun(record.id, { workspaceRoot: path.join(tempRoot, "other-workspace") }),
    /must match the applied workspace/
  );
});

test("run store records missing package.json verification as failed", async () => {
  const tempRoot = await mkdtemp(path.join(tmpdir(), "dure-verify-no-package-"));
  const store = new RunStore(path.join(tempRoot, ".dure", "runs"));
  const record = store.persistRun({
    context: developmentContextFixture(),
    selectedAgentTeam: ["BuilderAgent", "ReviewerAgent"],
    proposal: readmeOnlyPatchProposalFixture(),
    safetyDecision: safetyFixture(),
    verificationResult: verificationFixture(),
    decisionLog: { entries: [] },
    nextRecommendedAction: "Preview the patch before approval.",
    now: new Date("2026-06-27T00:00:34.000Z")
  });

  store.approveRun(record.id, { now: new Date("2026-06-27T00:00:35.000Z") });
  store.applyRun(record.id, { now: new Date("2026-06-27T00:00:36.000Z") });
  const verification = store.verifyRun(record.id, {
    scripts: ["test"],
    now: new Date("2026-06-27T00:00:37.000Z")
  });

  assert.equal(verification.accepted, false);
  assert.equal(verification.commands[0].status, "blocked");
  assert.match(verification.commands[0].notes.join("\n"), /Missing package\.json/);
  assert.equal(store.loadPreview(record.id).metadata.status, "failed");
});

test("run store backs up modified files during apply", async () => {
  const tempRoot = await mkdtemp(path.join(tmpdir(), "dure-apply-modify-"));
  const workspaceRoot = path.join(tempRoot, "workspace");
  const target = path.join(workspaceRoot, "README.md");
  await mkdir(workspaceRoot, { recursive: true });
  await writeFile(target, "old content\n", "utf8");

  const store = new RunStore(path.join(tempRoot, ".dure", "runs"));
  const record = store.persistRun({
    context: developmentContextFixture(),
    selectedAgentTeam: ["BuilderAgent", "ReviewerAgent"],
    proposal: modifyPatchProposalFixture(),
    safetyDecision: safetyFixture(),
    verificationResult: verificationFixture(),
    decisionLog: { entries: [] },
    nextRecommendedAction: "Preview the patch before approval.",
    now: new Date("2026-06-27T00:00:15.000Z")
  });

  store.approveRun(record.id, { now: new Date("2026-06-27T00:00:16.000Z") });
  const applied = store.applyRun(record.id, {
    workspaceRoot,
    now: new Date("2026-06-27T00:00:17.000Z")
  });
  const modified = applied.files[0];
  const backupPath = modified.backupPath;

  assert.equal(modified.operation, "modify");
  assert.ok(backupPath);
  assert.ok(existsSync(backupPath));
  assert.equal(await readFile(backupPath, "utf8"), "old content\n");
  assert.equal(await readFile(target, "utf8"), "new content\n");
  assert.notEqual(modified.previousHash, modified.newHash);
});

test("run store rejects unsafe apply requests", async () => {
  const tempRoot = await mkdtemp(path.join(tmpdir(), "dure-apply-reject-"));
  const store = new RunStore(path.join(tempRoot, ".dure", "runs"));
  const proposed = store.persistRun({
    context: developmentContextFixture(),
    selectedAgentTeam: ["BuilderAgent", "ReviewerAgent"],
    proposal: patchProposalFixture(),
    safetyDecision: safetyFixture(),
    verificationResult: verificationFixture(),
    decisionLog: { entries: [] },
    nextRecommendedAction: "Preview the patch before approval.",
    now: new Date("2026-06-27T00:00:18.000Z")
  });
  const unsafe = store.persistRun({
    context: developmentContextFixture(),
    selectedAgentTeam: ["BuilderAgent", "ReviewerAgent"],
    proposal: unsafePatchProposalFixture(),
    safetyDecision: safetyFixture(),
    verificationResult: verificationFixture(),
    decisionLog: { entries: [] },
    nextRecommendedAction: "Preview the patch before approval.",
    now: new Date("2026-06-27T00:00:19.000Z")
  });
  const deletion = store.persistRun({
    context: developmentContextFixture(),
    selectedAgentTeam: ["BuilderAgent", "ReviewerAgent"],
    proposal: deletePatchProposalFixture(),
    safetyDecision: safetyFixture(),
    verificationResult: verificationFixture(),
    decisionLog: { entries: [] },
    nextRecommendedAction: "Preview the patch before approval.",
    now: new Date("2026-06-27T00:00:20.000Z")
  });

  assert.throws(() => store.applyRun(proposed.id), /current status is proposed/);
  store.approveRun(unsafe.id, { now: new Date("2026-06-27T00:00:21.000Z") });
  store.approveRun(deletion.id, { now: new Date("2026-06-27T00:00:22.000Z") });
  assert.throws(() => store.applyRun(unsafe.id), /Unsafe patch path/);
  assert.throws(() => store.applyRun(deletion.id), /Delete operation is not allowed/);
});

test("run store records bug bounty scope intake", async () => {
  const tempRoot = await mkdtemp(path.join(tmpdir(), "dure-scope-"));
  const store = new RunStore(path.join(tempRoot, ".dure", "runs"));
  const record = store.persistRun({
    context: bugBountyContextFixture(),
    selectedAgentTeam: ["BugBountyAgent", "MoochackerAgent", "ScopeGuardAgent", "EvidenceAgent", "ReviewerAgent"],
    proposal: bugBountyProposalFixture(),
    safetyDecision: safetyFixture(),
    decisionLog: { entries: [] },
    nextRecommendedAction: "Review MoochackerAgent's safety guidance.",
    now: new Date("2026-06-27T00:00:09.000Z")
  });

  const scope = store.attachBugBountyScope(record.id, {
    scope: {
      target: "api.example.com",
      inScopeAssets: ["api.example.com", "/v1/*"],
      outOfScopeAssets: ["admin.example.com"],
      allowedTechniques: ["read-only authorization checks"],
      forbiddenTechniques: ["DoS", "brute force"],
      rateLimits: ["10 requests per minute"],
      testAccountRoles: ["user", "admin-test"],
      dataHandlingRules: ["redact tokens and personal data"],
      authorizationNote: "Program scope supplied by user.",
      programRulesUrl: "https://example.com/program"
    },
    now: new Date("2026-06-27T00:00:10.000Z")
  });
  const preview = store.loadPreview(record.id);

  assert.equal(scope.moochackerAssessment.scopeStatus, "sufficient");
  assert.equal(preview.bugBountyScope?.target, "api.example.com");
  assert.ok(preview.artifactPaths.scope);
  assert.ok(existsSync(preview.artifactPaths.scope));
  assert.equal(preview.decisionLog.entries.at(-1)?.type, "bug_bounty_scope_intake");
});

test("run store records bug bounty evidence ledger entries with redaction", async () => {
  const tempRoot = await mkdtemp(path.join(tmpdir(), "dure-evidence-"));
  const store = new RunStore(path.join(tempRoot, ".dure", "runs"));
  const record = store.persistRun({
    context: bugBountyContextFixture(),
    selectedAgentTeam: ["BugBountyAgent", "MoochackerAgent", "ScopeGuardAgent", "EvidenceAgent", "ReviewerAgent"],
    proposal: bugBountyProposalFixture(),
    safetyDecision: safetyFixture(),
    decisionLog: { entries: [] },
    nextRecommendedAction: "Review MoochackerAgent's safety guidance.",
    now: new Date("2026-06-27T00:00:38.000Z")
  });

  store.attachBugBountyScope(record.id, {
    scope: sufficientScopeFixture(),
    now: new Date("2026-06-27T00:00:39.000Z")
  });
  const evidence = store.recordBugBountyEvidence(record.id, {
    evidence: evidenceFixture({
      requestSummary: "GET /v1/orders/123 Authorization: Bearer supersecrettoken123",
      responseSummary: "200 OK for victim@example.com",
      evidence: "token=supersecrettoken123 shows up in copied notes"
    }),
    now: new Date("2026-06-27T00:00:40.000Z")
  });
  const preview = store.loadPreview(record.id);
  const ledgerPath = preview.artifactPaths.evidenceLedger;

  assert.match(evidence.id, /^lead-20260627-000040Z-[0-9a-f]{6}$/);
  assert.equal(evidence.status, "testing");
  assert.equal(evidence.redactionApplied, true);
  assert.ok(evidence.redactedFields.includes("requestSummary"));
  assert.ok(evidence.redactedFields.includes("responseSummary"));
  assert.ok(evidence.redactedFields.includes("evidence"));
  assert.equal(preview.bugBountyEvidenceLedger?.entries.length, 1);
  assert.equal(preview.bugBountyEvidenceLedger?.entries[0].id, evidence.id);
  assert.ok(ledgerPath);
  assert.ok(existsSync(ledgerPath));
  const ledgerSource = await readFile(ledgerPath, "utf8");
  assert.match(ledgerSource, /\[redacted-secret\]/);
  assert.match(ledgerSource, /\[redacted-email\]/);
  assert.doesNotMatch(ledgerSource, /supersecrettoken123/);
  assert.doesNotMatch(ledgerSource, /victim@example.com/);
  assert.equal(preview.decisionLog.entries.at(-1)?.type, "bug_bounty_evidence_recorded");
});

test("run store blocks evidence recording without sufficient bug bounty scope", async () => {
  const tempRoot = await mkdtemp(path.join(tmpdir(), "dure-evidence-scope-"));
  const store = new RunStore(path.join(tempRoot, ".dure", "runs"));
  const record = store.persistRun({
    context: bugBountyContextFixture(),
    selectedAgentTeam: ["BugBountyAgent", "MoochackerAgent", "ScopeGuardAgent", "EvidenceAgent", "ReviewerAgent"],
    proposal: bugBountyProposalFixture(),
    safetyDecision: safetyFixture(),
    decisionLog: { entries: [] },
    nextRecommendedAction: "Review MoochackerAgent's safety guidance.",
    now: new Date("2026-06-27T00:00:41.000Z")
  });

  assert.throws(
    () => store.recordBugBountyEvidence(record.id, { evidence: evidenceFixture() }),
    /before bug bounty scope intake/
  );

  store.attachBugBountyScope(record.id, {
    scope: minimalScopeFixture(),
    now: new Date("2026-06-27T00:00:42.000Z")
  });
  assert.throws(
    () => store.recordBugBountyEvidence(record.id, { evidence: evidenceFixture() }),
    /only record blocked evidence/
  );

  const blocked = store.recordBugBountyEvidence(record.id, {
    evidence: evidenceFixture({ status: "blocked", nextAction: "Clarify allowed techniques and rate limits." }),
    now: new Date("2026-06-27T00:00:43.000Z")
  });
  assert.equal(blocked.status, "blocked");
});

test("run store rejects scope intake on non-bug-bounty runs", async () => {
  const tempRoot = await mkdtemp(path.join(tmpdir(), "dure-scope-reject-"));
  const store = new RunStore(path.join(tempRoot, ".dure", "runs"));
  const record = store.persistRun({
    context: developmentContextFixture(),
    selectedAgentTeam: ["BuilderAgent", "ReviewerAgent"],
    proposal: patchProposalFixture(),
    safetyDecision: safetyFixture(),
    verificationResult: verificationFixture(),
    decisionLog: { entries: [] },
    nextRecommendedAction: "Preview the patch before approval.",
    now: new Date("2026-06-27T00:00:11.000Z")
  });

  assert.throws(
    () => store.attachBugBountyScope(record.id, { scope: minimalScopeFixture() }),
    /not a bug bounty proposal/
  );
});

test("run store rejects evidence recording on non-bug-bounty runs", async () => {
  const tempRoot = await mkdtemp(path.join(tmpdir(), "dure-evidence-reject-"));
  const store = new RunStore(path.join(tempRoot, ".dure", "runs"));
  const record = store.persistRun({
    context: developmentContextFixture(),
    selectedAgentTeam: ["BuilderAgent", "ReviewerAgent"],
    proposal: patchProposalFixture(),
    safetyDecision: safetyFixture(),
    verificationResult: verificationFixture(),
    decisionLog: { entries: [] },
    nextRecommendedAction: "Preview the patch before approval.",
    now: new Date("2026-06-27T00:00:44.000Z")
  });

  assert.throws(
    () => store.recordBugBountyEvidence(record.id, { evidence: evidenceFixture() }),
    /not a bug bounty proposal/
  );
});

function contextFixture(): AssistantRequestContext {
  return {
    originalInput: "hello",
    inferredIntent: "Answer or structure a general assistant request safely.",
    selectedMode: "assistant",
    confidenceScore: 0.62,
    assumptions: ["No external tools are required."],
    requiredCapabilities: ["answer_general_request"],
    safetyRequirements: ["Return structured help without external side effects."],
    requiresUserApproval: false,
    requiresExternalTools: false,
    rejectedModes: ["development", "bug_bounty"],
    createdAt: "2026-06-27T00:00:00.000Z"
  };
}

function proposalFixture(): TaskModeProposal {
  return {
    id: "proposal-test",
    kind: "assistant_response",
    summary: "Structured assistant response prepared without external tools.",
    riskLevel: "low",
    requiresApproval: false,
    assumptions: ["No external tools are required."],
    nextActions: ["Review the structured proposal."],
    response: "Hello.",
    suggestedQuestions: ["What outcome should be considered done?"]
  };
}

function safetyFixture(): SafetyDecision {
  return {
    allowed: true,
    requiresApproval: false,
    externalToolsRequired: false,
    summary: "Safe deterministic proposal produced without external side effects.",
    blockedCapabilities: [],
    details: ["No external integration was required."]
  };
}

function developmentContextFixture(): AssistantRequestContext {
  return {
    ...contextFixture(),
    originalInput: "Create a small app.",
    inferredIntent: "Plan and propose the smallest safe development step.",
    selectedMode: "development",
    confidenceScore: 0.95,
    requiredCapabilities: ["read_project_files", "propose_file_changes", "run_tests_placeholder"],
    safetyRequirements: ["Patch proposals require review before file changes."],
    requiresUserApproval: true,
    rejectedModes: ["assistant", "bug_bounty"]
  };
}

function patchProposalFixture(): TaskModeProposal {
  return {
    id: "patch-test",
    kind: "patch",
    summary: "Controlled proposal for a minimal executable skeleton.",
    riskLevel: "medium",
    requiresApproval: true,
    assumptions: ["No files are modified automatically."],
    nextActions: ["Preview the patch before approval."],
    author: "BuilderRuntime",
    goal: "Create a small app.",
    stage: {
      id: 1,
      name: "create executable skeleton",
      objective: "Create a runnable skeleton before expanding features.",
      exitCriteria: ["A minimal command can run."]
    },
    changes: [
      {
        path: "package.json",
        operation: "create",
        rationale: "Declare a minimal runnable package.",
        content: JSON.stringify({ name: "generated-memory-mvp" }, null, 2)
      }
    ],
    policy: {
      singleWriter: true,
      writer: "BuilderRuntime",
      reviewers: ["ReviewerAgent"]
    },
    createdAt: "2026-06-27T00:00:00.000Z",
    status: "accepted"
  };
}

function verifiablePatchProposalFixture(): TaskModeProposal {
  const base = patchProposalFixture();
  assert.equal(base.kind, "patch");
  return {
    ...base,
    id: "patch-verifiable-test",
    changes: [
      {
        path: "package.json",
        operation: "create",
        rationale: "Declare a minimal package with an executable test script.",
        content: JSON.stringify(
          {
            name: "generated-memory-mvp",
            private: true,
            scripts: {
              test: "node -e \"console.log('test ok')\""
            }
          },
          null,
          2
        )
      }
    ]
  };
}

function failingVerificationPatchProposalFixture(): TaskModeProposal {
  const base = verifiablePatchProposalFixture();
  assert.equal(base.kind, "patch");
  return {
    ...base,
    id: "patch-failing-verification-test",
    changes: [
      {
        path: "package.json",
        operation: "create",
        rationale: "Declare a package with a failing test script.",
        content: JSON.stringify(
          {
            name: "generated-memory-mvp",
            private: true,
            scripts: {
              test: "node -e \"process.exit(1)\""
            }
          },
          null,
          2
        )
      }
    ]
  };
}

function readmeOnlyPatchProposalFixture(): TaskModeProposal {
  const base = patchProposalFixture();
  assert.equal(base.kind, "patch");
  return {
    ...base,
    id: "patch-readme-only-test",
    changes: [
      {
        path: "README.md",
        operation: "create",
        rationale: "Create a file without a package manifest.",
        content: "hello\n"
      }
    ]
  };
}

function modifyPatchProposalFixture(): TaskModeProposal {
  const base = patchProposalFixture();
  assert.equal(base.kind, "patch");
  return {
    ...base,
    id: "patch-modify-test",
    changes: [
      {
        path: "README.md",
        operation: "modify",
        rationale: "Update existing documentation.",
        content: "new content\n"
      }
    ]
  };
}

function unsafePatchProposalFixture(): TaskModeProposal {
  const base = patchProposalFixture();
  assert.equal(base.kind, "patch");
  return {
    ...base,
    id: "patch-unsafe-test",
    changes: [
      {
        path: "../outside.txt",
        operation: "create",
        rationale: "Unsafe traversal path.",
        content: "bad\n"
      }
    ]
  };
}

function deletePatchProposalFixture(): TaskModeProposal {
  const base = patchProposalFixture();
  assert.equal(base.kind, "patch");
  return {
    ...base,
    id: "patch-delete-test",
    changes: [
      {
        path: "README.md",
        operation: "delete",
        rationale: "Deletion requires a separate approval."
      }
    ]
  };
}

function verificationFixture(accepted = true): VerificationResult {
  return {
    patchId: "patch-test",
    accepted,
    completedAt: "2026-06-27T00:00:00.000Z",
    checks: [
      {
        name: "security_scan",
        passed: accepted,
        mocked: false,
        summary: "No unsafe patch paths detected.",
        details: []
      },
      {
        name: "test",
        passed: accepted,
        mocked: true,
        summary: "Placeholder test gate passed.",
        details: []
      }
    ]
  };
}

function bugBountyContextFixture(): AssistantRequestContext {
  return {
    ...contextFixture(),
    originalInput: "Prepare an authorized bug bounty scope and evidence plan.",
    inferredIntent: "Prepare an authorized bug bounty workflow with scope, evidence, and reporting gates.",
    selectedMode: "bug_bounty",
    confidenceScore: 0.95,
    requiredCapabilities: [
      "confirm_bug_bounty_scope",
      "review_program_rules",
      "map_targets_placeholder",
      "collect_evidence_placeholder",
      "draft_finding_report"
    ],
    safetyRequirements: ["Confirm target scope and authorization before active testing."],
    requiresUserApproval: true,
    requiresExternalTools: true,
    rejectedModes: ["assistant", "development"]
  };
}

function bugBountyProposalFixture(): TaskModeProposal {
  return {
    id: "proposal-bug-bounty-test",
    kind: "bug_bounty_review",
    summary: "Bug bounty review proposal with scope and evidence gates.",
    riskLevel: "high",
    requiresApproval: true,
    assumptions: ["No active testing is performed."],
    nextActions: ["Review MoochackerAgent's safety guidance."],
    moochackerAssessment: {
      agent: "MoochackerAgent",
      mode: "bug_bounty",
      scopeStatus: "needs_clarification",
      safetyLevel: "caution",
      allowedActions: ["Passive planning only."],
      blockedActions: ["No live requests."],
      clarifyingQuestions: ["What assets are in scope?"],
      evidenceGuidance: ["Use owned test accounts only."],
      redactionRequirements: ["Redact tokens."],
      reportingNotes: ["Separate findings from hypotheses."]
    },
    scopeGate: ["Confirm the target is in scope and explicitly authorized."],
    targetMapPlaceholders: ["hosts", "endpoints"],
    hypotheses: ["Authorization boundary issues."],
    evidenceLedgerFields: ["lead id", "impact"],
    reportSections: ["title", "impact", "remediation"],
    stopConditions: ["Scope, authorization, or program rules are unclear."]
  };
}

function minimalScopeFixture() {
  return {
    target: "api.example.com",
    inScopeAssets: [],
    outOfScopeAssets: [],
    allowedTechniques: [],
    forbiddenTechniques: [],
    rateLimits: [],
    testAccountRoles: [],
    dataHandlingRules: [],
    authorizationNote: ""
  };
}

function sufficientScopeFixture() {
  return {
    target: "api.example.com",
    inScopeAssets: ["api.example.com", "/v1/*"],
    outOfScopeAssets: ["admin.example.com"],
    allowedTechniques: ["read-only authorization checks"],
    forbiddenTechniques: ["DoS", "brute force"],
    rateLimits: ["10 requests per minute"],
    testAccountRoles: ["user", "admin-test"],
    dataHandlingRules: ["redact tokens and personal data"],
    authorizationNote: "Program scope supplied by user.",
    programRulesUrl: "https://example.com/program"
  };
}

function evidenceFixture(overrides: Partial<BugBountyEvidenceInput> = {}): BugBountyEvidenceInput {
  return {
    status: "testing",
    asset: "api.example.com",
    endpoint: "/v1/orders/123",
    method: "GET",
    authState: "authenticated",
    userRole: "user",
    objectOwnership: "other-user object id placeholder",
    hypothesis: "A user may be able to read another user's order detail by changing an object id.",
    testPerformed: "Placeholder only; no live request was sent by Dure.",
    requestSummary: "GET /v1/orders/{id} with user test account placeholder.",
    responseSummary: "Expected 403 or redacted proof placeholder.",
    evidence: "Evidence placeholder tied to role, timestamp, and scope.",
    impact: "Potential cross-account order detail exposure if confirmed.",
    confidence: "medium",
    scopeNote: "api.example.com and /v1/* are in scope.",
    programRuleNotes: "Read-only authorization checks are allowed.",
    nextAction: "Confirm safely with owned test accounts and minimal requests.",
    ...overrides
  };
}

function metadataFixture(runId: string) {
  return {
    id: runId,
    status: "proposed",
    createdAt: "2026-06-27T00:00:00.000Z",
    updatedAt: "2026-06-27T00:00:00.000Z",
    input: "hello",
    selectedMode: "assistant",
    confidenceScore: 0.62,
    proposalKind: "assistant_response",
    proposalId: "proposal-test",
    requiresApproval: false,
    artifactPaths: {
      runDir: "ignored",
      request: "ignored",
      context: "ignored",
      proposal: "ignored",
      safety: "ignored",
      decisionLog: "ignored",
      metadata: "ignored"
    },
    selectedAgentTeam: ["AssistantAgent"],
    nextRecommendedAction: "Review the structured proposal."
  };
}
