import assert from "node:assert/strict";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { SkillRegistry } from "../src/index";

test("skill registry previews manifests without loading untrusted skills", async () => {
  const catalog = await mkdtemp(path.join(tmpdir(), "aegisforge-skills-"));
  const skillDir = path.join(catalog, "security-review-basic");
  await mkdir(skillDir);
  await writeFile(
    path.join(skillDir, "manifest.json"),
    JSON.stringify({
      name: "security-review-basic",
      version: "0.1.0",
      summary: "Basic security review checklist for generated code.",
      tags: ["security", "review"],
      permissions: ["read_files"],
      estimatedSize: 10240,
      trusted: false
    })
  );

  const registry = new SkillRegistry(catalog);
  const previews = await registry.listPreviews();

  assert.equal(previews.length, 1);
  assert.equal(previews[0].name, "security-review-basic");
  assert.equal(previews[0].trusted, false);
  assert.match(previews[0].hash, /^sha256:/);
  await assert.rejects(() => registry.loadSkill("security-review-basic"), /untrusted/);
});
