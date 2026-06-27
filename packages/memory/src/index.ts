import { randomBytes } from "node:crypto";
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import type {
  AssistantAgentRole,
  AssistantRequestContext,
  DecisionLog,
  DecisionLogEntry,
  DecisionLogEntryType,
  RunArtifactPaths,
  RunMetadata,
  RunPreview,
  RunRecord,
  SafetyDecision,
  TaskModeProposal,
  VerificationResult
} from "@dure/core";

export class DecisionLogRecorder {
  private readonly entries: DecisionLogEntry[] = [];

  append(type: DecisionLogEntryType, message: string, data: Record<string, unknown>): DecisionLogEntry {
    const entry: DecisionLogEntry = {
      type,
      message,
      data,
      timestamp: new Date().toISOString()
    };
    this.entries.push(entry);
    return entry;
  }

  toDecisionLog(): DecisionLog {
    return {
      entries: [...this.entries]
    };
  }
}

export interface PersistRunInput {
  readonly context: AssistantRequestContext;
  readonly selectedAgentTeam: readonly AssistantAgentRole[];
  readonly proposal: TaskModeProposal;
  readonly safetyDecision: SafetyDecision;
  readonly verificationResult?: VerificationResult;
  readonly decisionLog: DecisionLog;
  readonly nextRecommendedAction: string;
  readonly now?: Date;
}

export class RunStore {
  readonly root: string;

  constructor(root = path.join(process.cwd(), ".dure", "runs")) {
    this.root = path.resolve(root);
  }

  persistRun(input: PersistRunInput): RunRecord {
    const now = input.now ?? new Date();
    const runId = this.createUniqueRunId(now);
    const runDir = path.join(this.root, runId);
    const artifactPaths = createArtifactPaths(runDir, input.verificationResult !== undefined);

    mkdirSync(runDir, { recursive: true });

    const record: RunRecord = {
      id: runId,
      status: "proposed",
      createdAt: input.context.createdAt,
      updatedAt: now.toISOString(),
      input: input.context.originalInput,
      selectedMode: input.context.selectedMode,
      confidenceScore: input.context.confidenceScore,
      proposalKind: input.proposal.kind,
      proposalId: input.proposal.id,
      requiresApproval: input.proposal.requiresApproval,
      artifactPaths
    };

    writeJson(artifactPaths.request, {
      originalInput: input.context.originalInput,
      receivedAt: input.context.createdAt
    });
    writeJson(artifactPaths.context, input.context);
    writeJson(artifactPaths.proposal, input.proposal);
    writeJson(artifactPaths.safety, input.safetyDecision);
    if (artifactPaths.verification && input.verificationResult) {
      writeJson(artifactPaths.verification, input.verificationResult);
    }
    writeJson(artifactPaths.metadata, {
      ...record,
      selectedAgentTeam: input.selectedAgentTeam,
      nextRecommendedAction: input.nextRecommendedAction
    });
    this.appendDecisionEntries(artifactPaths.decisionLog, input.decisionLog.entries);

    return record;
  }

  appendDecisionEntry(run: RunRecord, entry: DecisionLogEntry): void {
    appendJsonLine(run.artifactPaths.decisionLog, entry);
  }

  loadPreview(runId: string): RunPreview {
    if (!isSafeRunId(runId)) {
      throw new Error(`Invalid run id: ${runId}`);
    }

    const runDir = path.join(this.root, runId);
    const artifactPaths = createArtifactPaths(runDir, existsSync(path.join(runDir, "verification.json")));
    if (!existsSync(artifactPaths.metadata)) {
      throw new Error(`Run not found: ${runId}`);
    }

    const metadata = readJson<RunMetadata>(artifactPaths.metadata);
    if (metadata.id !== runId) {
      throw new Error(`Malformed run artifact: metadata.json id does not match ${runId}.`);
    }

    const request = readJson<RunPreview["request"]>(artifactPaths.request);
    const context = readJson<AssistantRequestContext>(artifactPaths.context);
    const proposal = readJson<TaskModeProposal>(artifactPaths.proposal);
    const safetyDecision = readJson<SafetyDecision>(artifactPaths.safety);
    const verificationResult = artifactPaths.verification && existsSync(artifactPaths.verification)
      ? readJson<VerificationResult>(artifactPaths.verification)
      : undefined;
    const decisionLog = readDecisionLog(artifactPaths.decisionLog);

    return {
      metadata: {
        id: metadata.id,
        status: metadata.status,
        createdAt: metadata.createdAt,
        updatedAt: metadata.updatedAt,
        input: metadata.input,
        selectedMode: metadata.selectedMode,
        confidenceScore: metadata.confidenceScore,
        proposalKind: metadata.proposalKind,
        proposalId: metadata.proposalId,
        requiresApproval: metadata.requiresApproval,
        artifactPaths,
        selectedAgentTeam: metadata.selectedAgentTeam,
        nextRecommendedAction: metadata.nextRecommendedAction
      },
      request,
      context,
      proposal,
      safetyDecision,
      verificationResult,
      decisionLog,
      artifactPaths
    };
  }

  loadRun(runId: string): RunPreview {
    return this.loadPreview(runId);
  }

  private createUniqueRunId(now: Date): string {
    for (let attempt = 0; attempt < 10; attempt += 1) {
      const candidate = createRunId(now);
      if (!existsSync(path.join(this.root, candidate))) {
        return candidate;
      }
    }
    throw new Error("Unable to create a unique run id.");
  }

  private appendDecisionEntries(filePath: string, entries: readonly DecisionLogEntry[]): void {
    for (const entry of entries) {
      appendJsonLine(filePath, entry);
    }
  }
}

export function createRunId(now = new Date()): string {
  const timestamp = now
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}Z$/, "Z")
    .replace("T", "-");
  return `run-${timestamp}-${randomBytes(3).toString("hex")}`;
}

export function isSafeRunId(runId: string): boolean {
  return /^run-\d{8}-\d{6}Z-[0-9a-f]{6}$/.test(runId);
}

function createArtifactPaths(runDir: string, hasVerification: boolean): RunArtifactPaths {
  return {
    runDir,
    request: path.join(runDir, "request.json"),
    context: path.join(runDir, "context.json"),
    proposal: path.join(runDir, "proposal.json"),
    safety: path.join(runDir, "safety.json"),
    decisionLog: path.join(runDir, "decision-log.jsonl"),
    metadata: path.join(runDir, "metadata.json"),
    verification: hasVerification ? path.join(runDir, "verification.json") : undefined
  };
}

function writeJson(filePath: string, value: unknown): void {
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function appendJsonLine(filePath: string, value: unknown): void {
  appendFileSync(filePath, `${JSON.stringify(value)}\n`, "utf8");
}

function readJson<T>(filePath: string): T {
  try {
    return JSON.parse(readFileSync(filePath, "utf8")) as T;
  } catch (error) {
    const fileName = path.basename(filePath);
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      throw new Error(`Missing run artifact: ${fileName}.`);
    }
    throw new Error(`Malformed run artifact: ${fileName}.`);
  }
}

function readDecisionLog(filePath: string): DecisionLog {
  let source: string;
  try {
    source = readFileSync(filePath, "utf8").trim();
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      throw new Error("Missing run artifact: decision-log.jsonl.");
    }
    throw error;
  }

  if (source.length === 0) {
    return { entries: [] };
  }

  try {
    return {
      entries: source.split("\n").map((line) => JSON.parse(line) as DecisionLogEntry)
    };
  } catch {
    throw new Error("Malformed run artifact: decision-log.jsonl.");
  }
}
