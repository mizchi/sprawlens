import type { AtlasEdge } from "./graph.ts";
import type { TestStatus } from "./testRun.ts";

/** A serializable change signal shared by browser, headless renderers, and agents. */
export type AtlasChangeEvidence = {
  id: string;
  kind: "added" | "modified" | "removed";
  addedLines?: number;
  deletedLines?: number;
  touchedLines?: number;
  totalLines?: number;
};

export type AtlasTraceEvidence = {
  /** Stable capture identity selected by ViewState.trace.id. */
  id: string | null;
  /** Optional cursor within the capture, in microseconds. */
  timeUs: number | null;
  edges: AtlasEdge[];
  /** Node heat is normalized to [0,1] by consumers. */
  heat: { id: string; value: number }[];
};

export type AtlasTestEvidence = {
  id: string;
  status: TestStatus;
  durationMs?: number;
};

/**
 * Versioned evidence envelope. Arrays keep the wire form JSON-safe; schema
 * projection turns them into the maps consumed by a scene or an agent lens.
 */
export type AtlasEvidence = {
  schemaVersion: 1;
  changes: AtlasChangeEvidence[];
  trace: AtlasTraceEvidence | null;
  tests: AtlasTestEvidence[];
};
