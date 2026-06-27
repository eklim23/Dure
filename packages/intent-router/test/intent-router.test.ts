import assert from "node:assert/strict";
import test from "node:test";
import { IntentRouter } from "../src/index";

test("routes development requests", () => {
  const route = new IntentRouter().route("로그인 가능한 게시판 만들어줘");

  assert.equal(route.selectedMode, "development");
  assert.ok(route.confidenceScore > 0.6);
});

test("routes documentation requests", () => {
  const route = new IntentRouter().route("이 프로젝트 README 초안 만들어줘");

  assert.equal(route.selectedMode, "documentation");
});

test("routes security requests", () => {
  const route = new IntentRouter().route("이 코드 보안상 위험한 부분 봐줘");

  assert.equal(route.selectedMode, "security");
});

test("routes bug bounty requests separately from security review", () => {
  const route = new IntentRouter().route("버그바운티 대상 endpoint map 만들고 취약점 제보 리포트 준비해줘");

  assert.equal(route.selectedMode, "bug_bounty");
  assert.ok(route.requiredCapabilities.includes("confirm_bug_bounty_scope"));
});

test("can force one of the primary modes", () => {
  const route = new IntentRouter().route("이 요청을 개발 작업으로 다뤄줘", "bug_bounty");

  assert.equal(route.selectedMode, "bug_bounty");
  assert.equal(route.confidenceScore, 1);
});

test("routes personal productivity requests", () => {
  const route = new IntentRouter().route("내일 발표 준비할 작업 목록 정리해줘");

  assert.equal(route.selectedMode, "personal_productivity");
});
