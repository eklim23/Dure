import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import type { PatchProposal } from "@dure/core";
import { PatchVerifier, WorkspaceVerifier } from "../src/index";

test("verifier accepts a safe placeholder proposal", () => {
  const verifier = new PatchVerifier();
  const result = verifier.verifyPatch(patchProposal("console.log('hello');\n"));

  assert.equal(result.accepted, true);
  assert.ok(result.checks.some((check) => check.name === "test" && check.mocked));
  assert.ok(result.checks.some((check) => check.name === "secret_scan" && !check.mocked));
});

test("verifier rejects obvious secret-like content", () => {
  const verifier = new PatchVerifier();
  const result = verifier.verifyPatch(patchProposal("const apiKey = '123456789-secret-value';\n"));

  assert.equal(result.accepted, false);
  assert.equal(result.checks.find((check) => check.name === "secret_scan")?.passed, false);
});

test("workspace verifier runs allow-listed configured scripts", async () => {
  const workspaceRoot = await mkdtemp(path.join(tmpdir(), "dure-verifier-workspace-"));
  await writePackage(workspaceRoot, {
    test: "node -e \"console.log('test ok')\"",
    lint: "node -e \"console.log('lint ok')\"",
    typecheck: "node -e \"console.log('types ok')\""
  });

  const record = new WorkspaceVerifier().verifyWorkspace({
    runId: "run-20260627-000000Z-abcdef",
    proposalId: "patch-test",
    workspaceRoot,
    outputRoot: path.join(workspaceRoot, ".verification-output"),
    previousStatus: "applied",
    scripts: ["test", "lint", "typecheck"],
    timeoutMs: 30_000
  });

  assert.equal(record.accepted, true);
  assert.deepEqual(record.commands.map((command) => command.status), ["passed", "passed", "passed"]);
  assert.ok(record.commands.every((command) => command.command.join(" ") === `pnpm run ${command.name}`));
  assert.ok(record.commands.every((command) => command.stdoutPath && existsSync(command.stdoutPath)));
});

test("workspace verifier allows missing lint and typecheck scripts when one check passes", async () => {
  const workspaceRoot = await mkdtemp(path.join(tmpdir(), "dure-verifier-missing-scripts-"));
  await writePackage(workspaceRoot, {
    test: "node -e \"console.log('test ok')\""
  });

  const record = new WorkspaceVerifier().verifyWorkspace({
    runId: "run-20260627-000000Z-abcdef",
    proposalId: "patch-test",
    workspaceRoot,
    outputRoot: path.join(workspaceRoot, ".verification-output"),
    previousStatus: "applied",
    scripts: ["test", "lint", "typecheck"]
  });

  assert.equal(record.accepted, true);
  assert.equal(record.commands.find((command) => command.name === "test")?.status, "passed");
  assert.equal(record.commands.find((command) => command.name === "lint")?.status, "not_configured");
  assert.equal(record.commands.find((command) => command.name === "typecheck")?.status, "not_configured");
});

test("workspace verifier fails failed scripts and blocks lifecycle hooks", async () => {
  const failingRoot = await mkdtemp(path.join(tmpdir(), "dure-verifier-failing-"));
  await writePackage(failingRoot, {
    test: "node -e \"process.exit(1)\""
  });
  const blockedRoot = await mkdtemp(path.join(tmpdir(), "dure-verifier-lifecycle-"));
  await writePackage(blockedRoot, {
    pretest: "node -e \"console.log('hidden')\"",
    test: "node -e \"console.log('test ok')\""
  });

  const failed = new WorkspaceVerifier().verifyWorkspace({
    runId: "run-20260627-000000Z-abcdef",
    proposalId: "patch-test",
    workspaceRoot: failingRoot,
    outputRoot: path.join(failingRoot, ".verification-output"),
    previousStatus: "applied",
    scripts: ["test"]
  });
  const blocked = new WorkspaceVerifier().verifyWorkspace({
    runId: "run-20260627-000000Z-abcdef",
    proposalId: "patch-test",
    workspaceRoot: blockedRoot,
    outputRoot: path.join(blockedRoot, ".verification-output"),
    previousStatus: "applied",
    scripts: ["test"]
  });

  assert.equal(failed.accepted, false);
  assert.equal(failed.commands[0].status, "failed");
  assert.equal(blocked.accepted, false);
  assert.equal(blocked.commands[0].status, "blocked");
  assert.match(blocked.commands[0].notes.join("\n"), /Lifecycle hooks are blocked/);
});

test("workspace verifier records missing package.json as a failed policy result", async () => {
  const workspaceRoot = await mkdtemp(path.join(tmpdir(), "dure-verifier-no-package-"));

  const record = new WorkspaceVerifier().verifyWorkspace({
    runId: "run-20260627-000000Z-abcdef",
    proposalId: "patch-test",
    workspaceRoot,
    outputRoot: path.join(workspaceRoot, ".verification-output"),
    previousStatus: "applied",
    scripts: ["test"]
  });

  assert.equal(record.accepted, false);
  assert.equal(record.commands[0].status, "blocked");
  assert.equal(record.localChecks.find((check) => check.name === "security_scan")?.passed, false);
});

test("workspace verifier redacts secret-like command output", async () => {
  const workspaceRoot = await mkdtemp(path.join(tmpdir(), "dure-verifier-secret-output-"));
  await writePackage(workspaceRoot, {
    test: "node -e \"console.log('token=supersecretvalue123')\""
  });

  const record = new WorkspaceVerifier().verifyWorkspace({
    runId: "run-20260627-000000Z-abcdef",
    proposalId: "patch-test",
    workspaceRoot,
    outputRoot: path.join(workspaceRoot, ".verification-output"),
    previousStatus: "applied",
    scripts: ["test"]
  });
  const stdoutPath = record.commands[0].stdoutPath;

  assert.equal(record.accepted, false);
  assert.ok(stdoutPath);
  assert.match(await readFile(stdoutPath, "utf8"), /\[redacted-secret\]/);
  assert.doesNotMatch(await readFile(stdoutPath, "utf8"), /supersecretvalue123/);
  assert.equal(record.localChecks.find((check) => check.name === "secret_scan")?.passed, false);
});

function patchProposal(content: string): PatchProposal {
  return {
    id: "patch-test",
    kind: "patch",
    author: "BuilderRuntime",
    goal: "Build a test project.",
    stage: {
      id: 1,
      name: "create executable skeleton",
      objective: "Create the smallest runnable structure.",
      exitCriteria: ["Project has an entry point"]
    },
    summary: "Test proposal.",
    riskLevel: "low",
    requiresApproval: true,
    assumptions: ["Fixture proposal for verifier tests."],
    nextActions: ["Run verifier."],
    changes: [
      {
        path: "src/index.js",
        operation: "create",
        rationale: "Smoke test.",
        content
      }
    ],
    policy: {
      singleWriter: true,
      writer: "BuilderRuntime",
      reviewers: [
        "IntentAgent",
        "ProductAgent",
        "ArchitectAgent",
        "SecurityAgent",
        "MaintainerAgent",
        "TesterAgent",
        "ReviewerAgent"
      ]
    },
    createdAt: "2026-06-27T00:00:00.000Z",
    status: "proposed"
  };
}

async function writePackage(workspaceRoot: string, scripts: Record<string, string>): Promise<void> {
  await writeFile(
    path.join(workspaceRoot, "package.json"),
    `${JSON.stringify({ name: "workspace-verifier-test", private: true, scripts }, null, 2)}\n`,
    "utf8"
  );
}
