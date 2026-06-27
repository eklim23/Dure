import assert from "node:assert/strict";
import test from "node:test";
import type { PatchProposal } from "@dure/core";
import { PatchVerifier } from "../src/index";

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
