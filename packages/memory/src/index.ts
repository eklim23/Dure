import type { DecisionLog, DecisionLogEntry, DecisionLogEntryType } from "@dure/core";

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
