import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";
import test from "node:test";

const root = new URL("../", import.meta.url);

async function readProjectFile(path) {
  return readFile(new URL(path, root), "utf8");
}

test("static prototype exposes the required UI anchors", async () => {
  const html = await readProjectFile("index.html");

  assert.match(html, /id="agent-field"/);
  assert.match(html, /data-mode="development"/);
  assert.match(html, /data-mode-choice="development"/);
  assert.match(html, /data-mode-choice="bug-bounty"/);
  assert.match(html, /id="snapshot-file"/);
  assert.match(html, /simulated transcript/);
  assert.match(html, /Read-only simulation/);
});

test("mode colors, agent dots, and reduced-motion styles are present", async () => {
  const css = await readProjectFile("styles.css");

  assert.match(css, /\[data-mode="development"\]/);
  assert.match(css, /\[data-mode="bug-bounty"\]/);
  assert.match(css, /\.agent-node/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(css, /working-drift/);
});

test("prototype logic remains local and read-only", async () => {
  const js = await readProjectFile("app.js");

  assert.match(js, /const agents = \[/);
  assert.match(js, /const conversations = \[/);
  assert.match(js, /function renderAgents/);
  assert.match(js, /function selectAgent/);
  assert.match(js, /function applyConsoleSnapshot/);
  assert.match(js, /value\.source\?\.kind === "dure-console-data"/);
  assert.doesNotMatch(js, /\bfetch\s*\(/);
  assert.doesNotMatch(js, /XMLHttpRequest/);
  assert.doesNotMatch(js, /localStorage/);
  assert.doesNotMatch(js, /\.innerHTML\s*=/);
});
