import assert from "node:assert/strict";
import test from "node:test";
import { AssistantCore } from "../src/index";

test("assistant core routes development requests through development mode", () => {
  const result = new AssistantCore().run("Create a simple login-enabled bulletin board");

  assert.equal(result.context.selectedMode, "development");
  assert.equal(result.proposal.kind, "patch");
  assert.equal(result.verificationResult?.accepted, true);
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
