import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import type {
  DevelopmentProjectState,
  MvpStage,
  ProjectFramework,
  ProjectLanguage,
  ProjectLanguageSummary,
  ProjectPackageManager,
  ProjectScriptSummary
} from "@dure/core";

const IGNORED_DIRECTORIES = [
  ".git",
  ".dure",
  ".next",
  ".turbo",
  ".venv",
  "build",
  "coverage",
  "dist",
  "node_modules",
  "target"
];

const MAX_INDEXED_FILES = 260;
const SCRIPT_NAMES: readonly ProjectScriptSummary["name"][] = ["test", "lint", "typecheck", "build"];

export interface DevelopmentProjectAnalyzerInput {
  readonly workspaceRoot?: string;
  readonly now?: Date;
}

export class DevelopmentProjectAnalyzer {
  analyze(input: DevelopmentProjectAnalyzerInput = {}): DevelopmentProjectState {
    const workspaceRoot = path.resolve(input.workspaceRoot ?? process.cwd());
    const analyzedAt = (input.now ?? new Date()).toISOString();
    const fileIndex = indexFiles(workspaceRoot);
    const packageJson = readPackageJson(workspaceRoot);
    const packageManager = detectPackageManager(workspaceRoot);
    const languages = detectLanguages(fileIndex.sampledFiles);
    const frameworks = detectFrameworks(workspaceRoot, packageJson);
    const scripts = detectScripts(packageJson);
    const currentMvpStage = estimateMvpStage({
      hasPackageJson: packageJson !== undefined,
      fileIndex,
      scripts,
      frameworks,
      languages
    });

    return {
      analyzedAt,
      workspaceRoot,
      fileIndex,
      packageManager: packageManager.packageManager,
      packageManagerEvidence: packageManager.evidence,
      languages,
      frameworks,
      scripts,
      currentMvpStage,
      notes: buildNotes(packageJson, fileIndex, scripts)
    };
  }
}

interface PackageJsonSummary {
  readonly scripts: Record<string, string>;
  readonly dependencies: Record<string, string>;
  readonly devDependencies: Record<string, string>;
}

function indexFiles(workspaceRoot: string): DevelopmentProjectState["fileIndex"] {
  const sampledFiles: string[] = [];
  let totalFiles = 0;

  function visit(directory: string): void {
    let entries;
    try {
      entries = readdirSync(directory, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      const absolutePath = path.join(directory, entry.name);
      const relativePath = toRelative(workspaceRoot, absolutePath);
      if (entry.isDirectory()) {
        if (!IGNORED_DIRECTORIES.includes(entry.name)) {
          visit(absolutePath);
        }
        continue;
      }
      if (!entry.isFile()) {
        continue;
      }

      totalFiles += 1;
      if (sampledFiles.length < MAX_INDEXED_FILES) {
        sampledFiles.push(relativePath);
      }
    }
  }

  visit(workspaceRoot);

  return {
    root: workspaceRoot,
    totalFiles,
    sampledFiles: sampledFiles.sort(),
    ignoredDirectories: IGNORED_DIRECTORIES
  };
}

function readPackageJson(workspaceRoot: string): PackageJsonSummary | undefined {
  const packageJsonPath = path.join(workspaceRoot, "package.json");
  if (!existsSync(packageJsonPath)) {
    return undefined;
  }

  try {
    const raw = JSON.parse(readFileSync(packageJsonPath, "utf8")) as Record<string, unknown>;
    return {
      scripts: stringRecord(raw.scripts),
      dependencies: stringRecord(raw.dependencies),
      devDependencies: stringRecord(raw.devDependencies)
    };
  } catch {
    return {
      scripts: {},
      dependencies: {},
      devDependencies: {}
    };
  }
}

function detectPackageManager(workspaceRoot: string): {
  readonly packageManager: ProjectPackageManager;
  readonly evidence: readonly string[];
} {
  const candidates: readonly { file: string; packageManager: ProjectPackageManager }[] = [
    { file: "pnpm-lock.yaml", packageManager: "pnpm" },
    { file: "package-lock.json", packageManager: "npm" },
    { file: "yarn.lock", packageManager: "yarn" },
    { file: "bun.lockb", packageManager: "bun" },
    { file: "bun.lock", packageManager: "bun" }
  ];
  const match = candidates.find((candidate) => existsSync(path.join(workspaceRoot, candidate.file)));
  if (match) {
    return {
      packageManager: match.packageManager,
      evidence: [match.file]
    };
  }

  return {
    packageManager: existsSync(path.join(workspaceRoot, "package.json")) ? "npm" : "unknown",
    evidence: existsSync(path.join(workspaceRoot, "package.json")) ? ["package.json"] : []
  };
}

function detectLanguages(files: readonly string[]): readonly ProjectLanguageSummary[] {
  const counts = new Map<ProjectLanguage, number>();
  for (const file of files) {
    const language = languageFor(file);
    counts.set(language, (counts.get(language) ?? 0) + 1);
  }

  return [...counts.entries()]
    .map(([language, fileCount]) => ({ language, files: fileCount }))
    .filter((summary) => summary.files > 0)
    .sort((left, right) => right.files - left.files || left.language.localeCompare(right.language));
}

function detectFrameworks(workspaceRoot: string, packageJson: PackageJsonSummary | undefined): readonly ProjectFramework[] {
  const frameworks = new Set<ProjectFramework>();
  const dependencies = {
    ...(packageJson?.dependencies ?? {}),
    ...(packageJson?.devDependencies ?? {})
  };

  if (existsSync(path.join(workspaceRoot, "pnpm-workspace.yaml"))) {
    frameworks.add("pnpm_workspace");
  }
  if (packageJson) {
    frameworks.add("node");
  }
  if ("next" in dependencies) {
    frameworks.add("nextjs");
  }
  if ("react" in dependencies) {
    frameworks.add("react");
  }
  if ("vite" in dependencies) {
    frameworks.add("vite");
  }
  if ("express" in dependencies) {
    frameworks.add("express");
  }
  if ("fastify" in dependencies) {
    frameworks.add("fastify");
  }
  if ("vue" in dependencies) {
    frameworks.add("vue");
  }
  if ("svelte" in dependencies) {
    frameworks.add("svelte");
  }

  return frameworks.size > 0 ? [...frameworks].sort() : ["unknown"];
}

function detectScripts(packageJson: PackageJsonSummary | undefined): readonly ProjectScriptSummary[] {
  return SCRIPT_NAMES.map((name) => {
    const command = packageJson?.scripts[name];
    return command
      ? { name, configured: true, command }
      : { name, configured: false };
  });
}

function estimateMvpStage(input: {
  readonly hasPackageJson: boolean;
  readonly fileIndex: DevelopmentProjectState["fileIndex"];
  readonly scripts: readonly ProjectScriptSummary[];
  readonly frameworks: readonly ProjectFramework[];
  readonly languages: readonly ProjectLanguageSummary[];
}): DevelopmentProjectState["currentMvpStage"] {
  const hasSource = input.fileIndex.sampledFiles.some((file) => /(^|\/)(src|apps|packages)\//.test(file));
  const hasTests = input.fileIndex.sampledFiles.some((file) => /(\.test\.|\.spec\.|\/test\/|\/tests\/)/.test(file))
    || isConfigured(input.scripts, "test");
  const hasValidation = isConfigured(input.scripts, "lint") || isConfigured(input.scripts, "typecheck");
  const hasSecurity = input.fileIndex.sampledFiles.some((file) => /(^|\/)(SECURITY\.md|packages\/safety-policy|packages\/verifier)/.test(file));
  const hasDocs = input.fileIndex.sampledFiles.some((file) => /(^|\/)(README\.md|docs\/)/.test(file));
  const evidence = [
    input.hasPackageJson ? "package.json detected" : "package.json not detected",
    hasSource ? "source/package directories detected" : "source/package directories not detected",
    hasTests ? "test files or test script detected" : "tests not detected",
    hasValidation ? "lint or typecheck script detected" : "lint/typecheck script not detected",
    hasSecurity ? "security or verifier artifacts detected" : "security review artifacts not detected",
    hasDocs ? "documentation detected" : "documentation not detected"
  ];

  if (!input.hasPackageJson) {
    return stageEstimate(0, 0.78, "Project manifest is not present yet.", evidence);
  }
  if (!hasSource) {
    return stageEstimate(1, 0.76, "Executable skeleton exists but source structure is still minimal.", evidence);
  }
  if (!hasTests) {
    return stageEstimate(2, 0.72, "Source exists before practical test coverage is visible.", evidence);
  }
  if (!hasValidation) {
    return stageEstimate(3, 0.72, "Tests exist but validation scripts are not configured.", evidence);
  }
  if (!hasSecurity) {
    return stageEstimate(4, 0.68, "Validation exists before explicit security and maintainability review artifacts.", evidence);
  }
  if (!hasDocs) {
    return stageEstimate(5, 0.66, "Security artifacts exist but documentation is not visible.", evidence);
  }

  return stageEstimate(7, 0.64, "Skeleton, tests, validation, security artifacts, and documentation are visible.", evidence);
}

function stageEstimate(stageId: MvpStage["id"], confidence: number, rationale: string, evidence: readonly string[]): DevelopmentProjectState["currentMvpStage"] {
  return {
    stage: stageFor(stageId),
    confidence,
    rationale,
    evidence
  };
}

function stageFor(stageId: MvpStage["id"]): MvpStage {
  const stages: Record<MvpStage["id"], MvpStage> = {
    0: {
      id: 0,
      name: "understand project",
      objective: "Identify the request, constraints, and current project shape.",
      exitCriteria: ["The goal and assumptions are recorded."]
    },
    1: {
      id: 1,
      name: "create executable skeleton",
      objective: "Create a runnable skeleton before expanding features.",
      exitCriteria: ["A minimal command can run."]
    },
    2: {
      id: 2,
      name: "implement one core feature",
      objective: "Implement the smallest useful feature.",
      exitCriteria: ["One feature works end to end."]
    },
    3: {
      id: 3,
      name: "add tests",
      objective: "Add focused tests for the core behavior.",
      exitCriteria: ["A test command exists or tests are present."]
    },
    4: {
      id: 4,
      name: "add validation and error handling",
      objective: "Add validation, error handling, lint, or typecheck gates.",
      exitCriteria: ["Validation behavior and checks are recorded."]
    },
    5: {
      id: 5,
      name: "security and maintainability review",
      objective: "Review security, maintainability, rollback, and audit concerns.",
      exitCriteria: ["Review findings and mitigations are recorded."]
    },
    6: {
      id: 6,
      name: "deferred feature expansion",
      objective: "Expand only after the stable MVP path is verified.",
      exitCriteria: ["New features have explicit scope and approval."]
    },
    7: {
      id: 7,
      name: "documentation",
      objective: "Document usage, architecture, security, and contribution expectations.",
      exitCriteria: ["User and contributor documentation is present."]
    }
  };

  return stages[stageId];
}

function buildNotes(
  packageJson: PackageJsonSummary | undefined,
  fileIndex: DevelopmentProjectState["fileIndex"],
  scripts: readonly ProjectScriptSummary[]
): readonly string[] {
  return [
    "Static project-state detection only; no scripts or external commands were executed.",
    packageJson ? "package.json was parsed for scripts and dependencies." : "package.json was not found.",
    `Indexed up to ${MAX_INDEXED_FILES} files while ignoring generated and dependency directories.`,
    missingScripts(scripts).length > 0
      ? `Missing common scripts: ${missingScripts(scripts).join(", ")}.`
      : "Common scripts are configured.",
    fileIndex.sampledFiles.length >= MAX_INDEXED_FILES
      ? "File index reached the v0.1 sampling limit."
      : "File index completed within the v0.1 sampling limit."
  ];
}

function languageFor(filePath: string): ProjectLanguage {
  const extension = path.extname(filePath).toLowerCase();
  if (extension === ".ts" || extension === ".tsx") {
    return "typescript";
  }
  if (extension === ".js" || extension === ".jsx" || extension === ".mjs" || extension === ".cjs") {
    return "javascript";
  }
  if (extension === ".py") {
    return "python";
  }
  if (extension === ".rs") {
    return "rust";
  }
  if (extension === ".go") {
    return "go";
  }
  if (extension === ".java") {
    return "java";
  }
  if (extension === ".cs") {
    return "csharp";
  }
  if (extension === ".md" || extension === ".mdx") {
    return "markdown";
  }
  if (extension === ".json" || extension === ".jsonl") {
    return "json";
  }
  return "unknown";
}

function stringRecord(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object") {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value)
      .filter((entry): entry is [string, string] => typeof entry[1] === "string")
  );
}

function isConfigured(scripts: readonly ProjectScriptSummary[], name: ProjectScriptSummary["name"]): boolean {
  return scripts.some((script) => script.name === name && script.configured);
}

function missingScripts(scripts: readonly ProjectScriptSummary[]): readonly string[] {
  return scripts.filter((script) => !script.configured).map((script) => script.name);
}

function toRelative(root: string, filePath: string): string {
  return path.relative(root, filePath).replace(/\\/g, "/");
}
