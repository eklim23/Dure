import { spawnSync } from "node:child_process";
import { existsSync, lstatSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import type {
  PatchProposal,
  RunStatus,
  VerificationCheck,
  VerificationResult,
  WorkspaceVerificationCommandResult,
  WorkspaceVerificationGateResult,
  WorkspaceVerificationOutputArtifact,
  WorkspaceVerificationRecord,
  WorkspaceVerificationScriptName
} from "@dure/core";
import { ControlledWorkspace } from "@dure/sandbox";

const SECRET_PATTERNS: readonly RegExp[] = [
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/gi,
  /\bAKIA[0-9A-Z]{16}\b/g,
  /\b(api[_-]?key|secret|token|password)\s*[:=]\s*["']?[^"'\s]{8,}["']?/gi
];
const WORKSPACE_SCRIPT_NAMES = ["test", "lint", "typecheck"] as const satisfies readonly WorkspaceVerificationScriptName[];
const OUTPUT_LIMIT = 4000;
const DEFAULT_TIMEOUT_MS = 30_000;
const MAX_TIMEOUT_MS = 120_000;

export class PatchVerifier {
  private readonly workspace = new ControlledWorkspace();

  verifyPatch(proposal: PatchProposal): VerificationResult {
    const checks = [
      this.placeholder("test", "Test command placeholder passed.", [
        "No shell command is executed in v0.1.",
        "Future versions should run an approved test command."
      ]),
      this.placeholder("lint", "Lint command placeholder passed.", [
        "No linter is executed in v0.1.",
        "The check is represented so policy can depend on it."
      ]),
      this.placeholder("typecheck", "Typecheck command placeholder passed.", [
        "No project typecheck command is executed in v0.1.",
        "Dure itself is still typechecked by its package scripts."
      ]),
      this.securityScan(proposal),
      this.secretScan(proposal),
      this.placeholder("dependency_audit", "Dependency audit placeholder passed.", [
        "No network access or package audit is executed in v0.1."
      ])
    ] satisfies VerificationCheck[];

    return {
      patchId: proposal.id,
      accepted: checks.every((check) => check.passed),
      checks,
      completedAt: new Date().toISOString()
    };
  }

  private placeholder(
    name: VerificationCheck["name"],
    summary: string,
    details: readonly string[]
  ): VerificationCheck {
    return {
      name,
      passed: true,
      mocked: true,
      summary,
      details
    };
  }

  private securityScan(proposal: PatchProposal): VerificationCheck {
    const safety = this.workspace.validatePatchProposal(proposal);
    return {
      name: "security_scan",
      passed: safety.safe,
      mocked: false,
      summary: safety.safe ? "Patch paths are constrained to the controlled workspace." : "Unsafe patch path detected.",
      details: safety.safe
        ? ["All proposed paths are relative and traversal-free."]
        : safety.rejectedPaths.map((candidate) => `Rejected path: ${candidate}`)
    };
  }

  private secretScan(proposal: PatchProposal): VerificationCheck {
    const matches = proposal.changes.flatMap((change) => {
      const content = change.content ?? "";
      return detectSecret(content) ? [change.path] : [];
    });

    return {
      name: "secret_scan",
      passed: matches.length === 0,
      mocked: false,
      summary: matches.length === 0 ? "No obvious secrets found in proposed content." : "Potential secret found.",
      details: matches.length === 0
        ? ["Scanned proposed patch content with conservative local patterns."]
        : matches.map((path) => `Potential secret-like content in ${path}.`)
    };
  }
}

export interface WorkspaceVerifierInput {
  readonly runId: string;
  readonly proposalId: string;
  readonly workspaceRoot: string;
  readonly outputRoot: string;
  readonly previousStatus: RunStatus;
  readonly scripts?: readonly WorkspaceVerificationScriptName[];
  readonly timeoutMs?: number;
  readonly now?: Date;
}

interface InternalCommandResult {
  readonly result: WorkspaceVerificationCommandResult;
  readonly secretDetected: boolean;
  readonly policyFailures: readonly string[];
}

interface PackageScriptReadResult {
  readonly scripts: Record<string, string>;
  readonly error?: string;
}

interface CapturedOutput {
  readonly value: string;
  readonly redacted: boolean;
  readonly truncated: boolean;
}

export class WorkspaceVerifier {
  verifyWorkspace(input: WorkspaceVerifierInput): WorkspaceVerificationRecord {
    const startedAt = (input.now ?? new Date()).toISOString();
    const workspaceRoot = path.resolve(input.workspaceRoot);
    const outputRoot = path.resolve(input.outputRoot);
    const packageJsonPath = path.join(workspaceRoot, "package.json");
    const timeoutMs = normalizeTimeout(input.timeoutMs);
    const scriptNames = normalizeScripts(input.scripts);

    mkdirSync(outputRoot, { recursive: true });
    const packageScripts = readPackageScripts(workspaceRoot, packageJsonPath);
    const internalCommands = scriptNames.map((name) =>
      this.verifyScript({
        name,
        scripts: packageScripts.scripts,
        packageReadError: packageScripts.error,
        workspaceRoot,
        outputRoot,
        timeoutMs
      })
    );
    const commands = internalCommands.map((command) => command.result);
    const policyFailures = internalCommands.flatMap((command) => command.policyFailures);
    const localChecks = this.localChecks(internalCommands, policyFailures);
    const hasPassedCommand = commands.some((command) => command.status === "passed");
    const gates = buildVerificationGates(commands, localChecks);
    const outputArtifacts = buildOutputArtifacts(commands);
    const summary = buildVerificationSummary(scriptNames, commands, gates, outputArtifacts);
    const accepted = hasPassedCommand && summary.requiredGatesPassed;
    const completedAt = new Date().toISOString();

    return {
      runId: input.runId,
      proposalId: input.proposalId,
      workspaceRoot,
      packageManager: "pnpm",
      startedAt,
      completedAt,
      accepted,
      previousStatus: input.previousStatus,
      nextStatus: accepted ? "verified" : "failed",
      commands,
      localChecks,
      gates,
      summary,
      outputArtifacts,
      nextRecommendedAction: accepted
        ? "This run is verified. Review artifacts before release or expansion."
        : `Inspect workspace verification artifacts and address: ${summary.failureReasons.join("; ")}`
    };
  }

  private verifyScript(input: {
    readonly name: WorkspaceVerificationScriptName;
    readonly scripts: Record<string, string>;
    readonly packageReadError?: string;
    readonly workspaceRoot: string;
    readonly outputRoot: string;
    readonly timeoutMs: number;
  }): InternalCommandResult {
    const displayCommand = ["pnpm", "run", input.name] as const;
    if (input.packageReadError) {
      return {
        result: blockedCommand(input.name, displayCommand, input.packageReadError),
        secretDetected: false,
        policyFailures: [input.packageReadError]
      };
    }

    const lifecycleHooks = [`pre${input.name}`, `post${input.name}`].filter((hook) => input.scripts[hook]);
    if (lifecycleHooks.length > 0) {
      const message = `Lifecycle hooks are blocked in Stage 8: ${lifecycleHooks.join(", ")}.`;
      return {
        result: blockedCommand(input.name, displayCommand, message, input.scripts[input.name]),
        secretDetected: detectSecret(input.scripts[input.name] ?? ""),
        policyFailures: [message]
      };
    }

    const script = input.scripts[input.name]?.trim();
    if (!script) {
      return {
        result: {
          name: input.name,
          status: "not_configured",
          configured: false,
          command: displayCommand,
          durationMs: 0,
          stdoutPreview: "",
          stderrPreview: "",
          stdoutRedacted: false,
          stderrRedacted: false,
          stdoutTruncated: false,
          stderrTruncated: false,
          notes: ["No package.json script is configured for this check."]
        },
        secretDetected: false,
        policyFailures: []
      };
    }

    assertNoSymlinkPath(input.workspaceRoot);
    const started = Date.now();
    const execution = resolvePnpmExecution(input.name);
    const output = spawnSync(execution.command, execution.args, {
      cwd: input.workspaceRoot,
      encoding: "utf8",
      env: verificationEnvironment(),
      shell: false,
      timeout: input.timeoutMs,
      windowsHide: true
    });
    const durationMs = Math.max(0, Date.now() - started);
    const stdout = captureOutput(output.stdout ?? "");
    const stderr = captureOutput(output.stderr ?? output.error?.message ?? "");
    const stdoutPath = path.join(input.outputRoot, `${input.name}.stdout.txt`);
    const stderrPath = path.join(input.outputRoot, `${input.name}.stderr.txt`);

    writeFileSync(stdoutPath, stdout.value, "utf8");
    writeFileSync(stderrPath, stderr.value, "utf8");

    const exitCode = typeof output.status === "number" ? output.status : undefined;
    const timedOut = (output.error as NodeJS.ErrnoException | undefined)?.code === "ETIMEDOUT";
    const status = timedOut ? "timed_out" : exitCode === 0 ? "passed" : "failed";
    const errorNote = output.error && !timedOut ? [`Execution error: ${output.error.message}`] : [];

    return {
      result: {
        name: input.name,
        status,
        configured: true,
        command: displayCommand,
        script: captureOutput(script).value,
        exitCode,
        signal: output.signal ?? undefined,
        durationMs,
        stdoutPath,
        stderrPath,
        stdoutPreview: stdout.value,
        stderrPreview: stderr.value,
        stdoutRedacted: stdout.redacted,
        stderrRedacted: stderr.redacted,
        stdoutTruncated: stdout.truncated,
        stderrTruncated: stderr.truncated,
        notes: [
          `Timeout: ${input.timeoutMs}ms.`,
          ...errorNote
        ]
      },
      secretDetected: detectSecret(script) || stdout.redacted || stderr.redacted,
      policyFailures: []
    };
  }

  private localChecks(
    commands: readonly InternalCommandResult[],
    policyFailures: readonly string[]
  ): readonly VerificationCheck[] {
    const secretDetected = commands.some((command) => command.secretDetected);
    return [
      {
        name: "security_scan",
        passed: policyFailures.length === 0,
        mocked: false,
        summary:
          policyFailures.length === 0
            ? "Workspace verification policy checks passed."
            : "Workspace verification policy blocked one or more checks.",
        details:
          policyFailures.length === 0
            ? ["Only allow-listed package scripts were considered."]
            : policyFailures
      },
      {
        name: "secret_scan",
        passed: !secretDetected,
        mocked: false,
        summary: secretDetected
          ? "Secret-like content was detected and redacted from verification output."
          : "No obvious secrets were detected in scripts or verification output.",
        details: secretDetected
          ? ["Review redacted command output before sharing artifacts."]
          : ["Scanned command scripts and captured output with conservative local patterns."]
      },
      {
        name: "dependency_audit",
        passed: true,
        mocked: true,
        summary: "Dependency audit remains a placeholder in Stage 8.",
        details: ["No package audit or network access was executed."]
      }
    ];
  }
}

function buildVerificationGates(
  commands: readonly WorkspaceVerificationCommandResult[],
  localChecks: readonly VerificationCheck[]
): readonly WorkspaceVerificationGateResult[] {
  const commandGates = commands.map((command): WorkspaceVerificationGateResult => ({
    id: command.name,
    category: "command",
    status: commandGateStatus(command.status),
    required: command.status !== "not_configured",
    summary: commandGateSummary(command)
  }));
  const localGates = localChecks.map((check): WorkspaceVerificationGateResult => ({
    id: check.name,
    category: check.mocked ? "placeholder" : "local_check",
    status: check.mocked ? "skipped" : check.passed ? "passed" : "failed",
    required: !check.mocked,
    summary: check.summary
  }));

  return [...commandGates, ...localGates];
}

function commandGateStatus(status: WorkspaceVerificationCommandResult["status"]): WorkspaceVerificationGateResult["status"] {
  if (status === "passed") {
    return "passed";
  }
  if (status === "not_configured") {
    return "skipped";
  }
  if (status === "blocked" || status === "timed_out") {
    return "blocked";
  }
  return "failed";
}

function commandGateSummary(command: WorkspaceVerificationCommandResult): string {
  if (command.status === "not_configured") {
    return `${command.name} script is not configured and was skipped.`;
  }
  if (command.status === "passed") {
    return `${command.name} script passed.`;
  }
  if (command.status === "failed") {
    return `${command.name} script failed.`;
  }
  if (command.status === "timed_out") {
    return `${command.name} script timed out.`;
  }
  return command.notes[0] ?? `${command.name} script ${command.status}.`;
}

function buildOutputArtifacts(
  commands: readonly WorkspaceVerificationCommandResult[]
): readonly WorkspaceVerificationOutputArtifact[] {
  return commands.flatMap((command) => {
    const artifacts: WorkspaceVerificationOutputArtifact[] = [];
    if (command.stdoutPath) {
      artifacts.push({
        command: command.name,
        stream: "stdout",
        path: command.stdoutPath,
        redacted: command.stdoutRedacted,
        truncated: command.stdoutTruncated
      });
    }
    if (command.stderrPath) {
      artifacts.push({
        command: command.name,
        stream: "stderr",
        path: command.stderrPath,
        redacted: command.stderrRedacted,
        truncated: command.stderrTruncated
      });
    }
    return artifacts;
  });
}

function buildVerificationSummary(
  requestedScripts: readonly WorkspaceVerificationScriptName[],
  commands: readonly WorkspaceVerificationCommandResult[],
  gates: readonly WorkspaceVerificationGateResult[],
  outputArtifacts: readonly WorkspaceVerificationOutputArtifact[]
): WorkspaceVerificationRecord["summary"] {
  const requiredFailures = gates.filter((gate) => gate.required && gate.status !== "passed");
  const hasPassedCommand = commands.some((command) => command.status === "passed");
  const failureReasons = [
    ...(!hasPassedCommand ? ["At least one configured verification script must pass."] : []),
    ...requiredFailures.map((gate) => gate.summary)
  ];

  return {
    requestedScripts,
    configuredScripts: commands.filter((command) => command.configured).map((command) => command.name),
    passedCommands: commands.filter((command) => command.status === "passed").length,
    failedCommands: commands.filter((command) => command.status === "failed").length,
    blockedCommands: commands.filter((command) => command.status === "blocked").length,
    skippedCommands: commands.filter((command) => command.status === "not_configured").length,
    timedOutCommands: commands.filter((command) => command.status === "timed_out").length,
    outputArtifacts: outputArtifacts.length,
    redactedArtifacts: outputArtifacts.filter((artifact) => artifact.redacted).length,
    requiredGatesPassed: requiredFailures.length === 0,
    dependencyAudit: "placeholder",
    failureReasons: [...new Set(failureReasons)]
  };
}

function normalizeScripts(
  scripts: readonly WorkspaceVerificationScriptName[] | undefined
): readonly WorkspaceVerificationScriptName[] {
  const requested = scripts && scripts.length > 0 ? scripts : WORKSPACE_SCRIPT_NAMES;
  return [...new Set(requested)];
}

function normalizeTimeout(timeoutMs: number | undefined): number {
  if (timeoutMs === undefined) {
    return DEFAULT_TIMEOUT_MS;
  }
  if (!Number.isInteger(timeoutMs) || timeoutMs <= 0) {
    throw new Error("Verification timeout must be a positive integer.");
  }
  if (timeoutMs > MAX_TIMEOUT_MS) {
    throw new Error(`Verification timeout cannot exceed ${MAX_TIMEOUT_MS}ms.`);
  }
  return timeoutMs;
}

function readPackageScripts(workspaceRoot: string, packageJsonPath: string): PackageScriptReadResult {
  try {
    assertNoSymlinkPath(workspaceRoot);
    if (!existsSync(packageJsonPath)) {
      return {
        scripts: {},
        error: `Missing package.json in verification workspace: ${workspaceRoot}.`
      };
    }
    assertNoSymlinkPath(packageJsonPath);
    const parsed = JSON.parse(readFileSync(packageJsonPath, "utf8")) as Record<string, unknown>;
    const scripts = parsed.scripts;
    if (!scripts || typeof scripts !== "object" || Array.isArray(scripts)) {
      return { scripts: {} };
    }

    return {
      scripts: Object.fromEntries(
        Object.entries(scripts).filter((entry): entry is [string, string] => typeof entry[1] === "string")
      )
    };
  } catch (error) {
    if (error instanceof SyntaxError) {
      return {
        scripts: {},
        error: `Malformed package.json in verification workspace: ${workspaceRoot}.`
      };
    }
    return {
      scripts: {},
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

function blockedCommand(
  name: WorkspaceVerificationScriptName,
  command: readonly string[],
  message: string,
  script?: string
): WorkspaceVerificationCommandResult {
  return {
    name,
    status: "blocked",
    configured: script !== undefined,
    command,
    script: script ? captureOutput(script).value : undefined,
    durationMs: 0,
    stdoutPreview: "",
    stderrPreview: "",
    stdoutRedacted: false,
    stderrRedacted: false,
    stdoutTruncated: false,
    stderrTruncated: false,
    notes: [message]
  };
}

function resolvePnpmExecution(scriptName: WorkspaceVerificationScriptName): {
  readonly command: string;
  readonly args: readonly string[];
} {
  const npmExecPath = process.env.npm_execpath;
  if (npmExecPath && /pnpm/i.test(path.basename(npmExecPath)) && existsSync(npmExecPath)) {
    return {
      command: process.execPath,
      args: [npmExecPath, "run", scriptName]
    };
  }
  if (process.platform === "win32") {
    return {
      command: "cmd.exe",
      args: ["/d", "/s", "/c", "pnpm", "run", scriptName]
    };
  }
  return {
    command: "pnpm",
    args: ["run", scriptName]
  };
}

function verificationEnvironment(): NodeJS.ProcessEnv {
  const allowedKeys = [
    "APPDATA",
    "ComSpec",
    "COREPACK_HOME",
    "HOME",
    "LOCALAPPDATA",
    "PATH",
    "PATHEXT",
    "Path",
    "SystemRoot",
    "TEMP",
    "TMP",
    "USERPROFILE",
    "WINDIR"
  ];
  const env: NodeJS.ProcessEnv = { CI: "1" };
  for (const key of allowedKeys) {
    const value = process.env[key];
    if (value !== undefined && !isSecretEnvName(key)) {
      env[key] = value;
    }
  }
  return env;
}

function isSecretEnvName(name: string): boolean {
  return /token|secret|key|password|credential/i.test(name);
}

function captureOutput(value: string): CapturedOutput {
  const redacted = redactSecrets(value);
  const secretRedacted = redacted !== value;
  const truncated = redacted.length > OUTPUT_LIMIT;
  const limited = truncated
    ? `${redacted.slice(0, OUTPUT_LIMIT)}\n[truncated ${redacted.length - OUTPUT_LIMIT} chars]`
    : redacted;
  return {
    value: limited,
    redacted: secretRedacted,
    truncated
  };
}

function redactSecrets(value: string): string {
  return SECRET_PATTERNS.reduce((current, pattern) => current.replace(pattern, "[redacted-secret]"), value);
}

function detectSecret(value: string): boolean {
  return SECRET_PATTERNS.some((pattern) => {
    pattern.lastIndex = 0;
    return pattern.test(value);
  });
}

function assertNoSymlinkPath(targetPath: string): void {
  const absolute = path.resolve(targetPath);
  const root = path.parse(absolute).root;
  const segments = path.relative(root, absolute).split(path.sep).filter((segment) => segment.length > 0);
  let current = root;

  for (const segment of segments) {
    current = path.join(current, segment);
    if (existsSync(current) && lstatSync(current).isSymbolicLink()) {
      throw new Error(`Verification path uses a symbolic link and is not allowed: ${absolute}`);
    }
  }
}
