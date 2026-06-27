import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import type { SkillManifest, SkillPreview } from "@aegisforge/core";

export interface LoadedSkill {
  readonly manifest: SkillManifest;
  readonly manifestPath: string;
  readonly executable: false;
}

export interface LoadSkillOptions {
  readonly allowUntrusted?: boolean;
}

export class SkillRegistry {
  constructor(private readonly catalogPath: string) {}

  async listPreviews(): Promise<readonly SkillPreview[]> {
    const manifestPaths = await this.findManifestPaths();
    const previews = await Promise.all(manifestPaths.map((manifestPath) => this.readPreview(manifestPath)));
    return previews.sort((left, right) => left.name.localeCompare(right.name));
  }

  async preview(name: string): Promise<SkillPreview | undefined> {
    const previews = await this.listPreviews();
    return previews.find((preview) => preview.name === name);
  }

  async loadSkill(name: string, options: LoadSkillOptions = {}): Promise<LoadedSkill> {
    const manifestPath = await this.findManifestPathByName(name);
    if (!manifestPath) {
      throw new Error(`Skill not found: ${name}`);
    }

    const manifest = await this.readManifest(manifestPath);
    if (!manifest.trusted && options.allowUntrusted !== true) {
      throw new Error(`Skill ${name} is untrusted and cannot be loaded without explicit approval.`);
    }

    return {
      manifest,
      manifestPath,
      executable: false
    };
  }

  private async findManifestPaths(): Promise<readonly string[]> {
    const entries = await readdir(this.catalogPath, { withFileTypes: true });
    const paths = entries
      .filter((entry) => entry.isDirectory())
      .map((entry) => path.join(this.catalogPath, entry.name, "manifest.json"));
    return paths;
  }

  private async findManifestPathByName(name: string): Promise<string | undefined> {
    const manifestPaths = await this.findManifestPaths();
    for (const manifestPath of manifestPaths) {
      const manifest = await this.readManifest(manifestPath);
      if (manifest.name === name) {
        return manifestPath;
      }
    }
    return undefined;
  }

  private async readPreview(manifestPath: string): Promise<SkillPreview> {
    const manifest = await this.readManifest(manifestPath);
    return {
      name: manifest.name,
      version: manifest.version,
      summary: manifest.summary,
      tags: manifest.tags,
      permissions: manifest.permissions,
      estimatedSize: manifest.estimatedSize,
      trusted: manifest.trusted,
      hash: manifest.hash ?? (await hashFile(manifestPath)),
      signature: manifest.signature
    };
  }

  private async readManifest(manifestPath: string): Promise<SkillManifest> {
    const source = await readFile(manifestPath, "utf8");
    const parsed = JSON.parse(source) as unknown;
    return parseSkillManifest(parsed);
  }
}

function parseSkillManifest(value: unknown): SkillManifest {
  if (!isRecord(value)) {
    throw new Error("Skill manifest must be a JSON object.");
  }

  return {
    name: requireString(value, "name"),
    version: requireString(value, "version"),
    summary: requireString(value, "summary"),
    tags: requireStringArray(value, "tags"),
    permissions: requireStringArray(value, "permissions"),
    estimatedSize: requireNumber(value, "estimatedSize"),
    trusted: requireBoolean(value, "trusted"),
    hash: optionalString(value, "hash"),
    signature: optionalString(value, "signature")
  };
}

async function hashFile(filePath: string): Promise<string> {
  const source = await readFile(filePath);
  return `sha256:${createHash("sha256").update(source).digest("hex")}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requireString(record: Record<string, unknown>, key: string): string {
  const value = record[key];
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`Skill manifest field ${key} must be a non-empty string.`);
  }
  return value;
}

function optionalString(record: Record<string, unknown>, key: string): string | undefined {
  const value = record[key];
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`Skill manifest field ${key} must be a non-empty string when present.`);
  }
  return value;
}

function requireStringArray(record: Record<string, unknown>, key: string): readonly string[] {
  const value = record[key];
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    throw new Error(`Skill manifest field ${key} must be an array of strings.`);
  }
  return value;
}

function requireNumber(record: Record<string, unknown>, key: string): number {
  const value = record[key];
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    throw new Error(`Skill manifest field ${key} must be a positive number.`);
  }
  return value;
}

function requireBoolean(record: Record<string, unknown>, key: string): boolean {
  const value = record[key];
  if (typeof value !== "boolean") {
    throw new Error(`Skill manifest field ${key} must be a boolean.`);
  }
  return value;
}
