import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";
import test from "node:test";

const root = new URL("../", import.meta.url);

async function readProjectFile(path) {
  return readFile(new URL(path, root), "utf8");
}

test("static prototype exposes the required UI anchors", async () => {
  const html = await readProjectFile("index.html");

  assert.match(html, /<html lang="ko">/);
  assert.match(html, /id="agent-field"/);
  assert.match(html, /data-mode="development"/);
  assert.match(html, /data-mode-choice="development"/);
  assert.match(html, /data-mode-choice="bug-bounty"/);
  assert.match(html, /Dure와 대화 중/);
  assert.match(html, /채팅 위치: Dure에게 말하기/);
  assert.match(html, /에이전트 회의 보기/);
  assert.match(html, /에이전트 설정/);
  assert.match(html, /id="chat-form"/);
  assert.match(html, /id="chat-input"/);
  assert.match(html, /id="meeting-route"/);
  assert.match(html, /id="setting-display-name"/);
  assert.match(html, /id="setting-role"/);
  assert.match(html, /id="setting-autospeak"/);
  assert.match(html, /id="setting-participation"/);
  assert.match(html, /id="setting-tone"/);
  assert.match(html, /id="setting-authority"/);
  assert.match(html, /id="setting-avatar"/);
  assert.match(html, /id="color-swatches"/);
  assert.match(html, /id="snapshot-file"/);
  assert.match(html, /id="snapshot-project"/);
  assert.match(html, /id="snapshot-patch-risk"/);
  assert.match(html, /정적 회의록/);
  assert.match(html, /읽기 전용 미리보기/);
});

test("mode colors, agent dots, and reduced-motion styles are present", async () => {
  const css = await readProjectFile("styles.css");

  assert.match(css, /\[data-mode="development"\]/);
  assert.match(css, /\[data-mode="bug-bounty"\]/);
  assert.match(css, /\.agent-node/);
  assert.match(css, /\.chat-form/);
  assert.match(css, /\.color-swatch/);
  assert.match(css, /\.avatar-hex/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(css, /working-drift/);
});

test("prototype logic remains local and read-only", async () => {
  const js = await readProjectFile("app.js");

  assert.match(js, /const agents = \[/);
  assert.match(js, /const agentSettings = /);
  assert.match(js, /const colorPalette = /);
  assert.match(js, /const conversations = \[/);
  assert.match(js, /function renderAgents/);
  assert.match(js, /function renderSettings/);
  assert.match(js, /function renderColorSwatches/);
  assert.match(js, /function renderDialogue/);
  assert.match(js, /function handleChatSubmit/);
  assert.match(js, /function updateSelectedSettings/);
  assert.match(js, /function selectAgent/);
  assert.match(js, /function applyConsoleSnapshot/);
  assert.match(js, /function summarizeSnapshotProject/);
  assert.match(js, /function summarizeSnapshotPatchRisk/);
  assert.match(js, /value\.source\?\.kind === "dure-console-data"/);
  assert.doesNotMatch(js, /\bfetch\s*\(/);
  assert.doesNotMatch(js, /XMLHttpRequest/);
  assert.doesNotMatch(js, /localStorage/);
  assert.doesNotMatch(js, /\.innerHTML\s*=/);
});
