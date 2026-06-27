import path from "node:path";
import type { PatchProposal } from "@aegisforge/core";

export interface PatchSafetyReport {
  readonly safe: boolean;
  readonly rejectedPaths: readonly string[];
}

export function isSafeRelativePath(candidate: string): boolean {
  if (candidate.trim().length === 0) {
    return false;
  }

  if (path.isAbsolute(candidate)) {
    return false;
  }

  if (/^[a-zA-Z]:[\\/]/.test(candidate)) {
    return false;
  }

  if (candidate.includes("\0")) {
    return false;
  }

  const normalized = candidate.replace(/\\/g, "/");
  const segments = normalized.split("/");
  return segments.every((segment) => segment !== ".." && segment !== "");
}

export class ControlledWorkspace {
  validatePatchProposal(proposal: PatchProposal): PatchSafetyReport {
    const rejectedPaths = proposal.changes
      .map((change) => change.path)
      .filter((candidate) => !isSafeRelativePath(candidate));

    return {
      safe: rejectedPaths.length === 0,
      rejectedPaths
    };
  }
}
