export type SnapshotLoadStatus = "idle" | "loading" | "ready" | "error";

export type SnapshotLoadState = {
  status: SnapshotLoadStatus;
  repo: string;
  startedAt: number;
  error?: string;
};

export type SnapshotLoadingUi = {
  visible: boolean;
  tone: "loading" | "ready" | "error";
  percent: number;
  label: string;
};

export function estimateSnapshotProgress(elapsedMs: number): number {
  if (elapsedMs <= 0) return 8;
  const eased = 1 - Math.exp(-elapsedMs / 4_800);
  return Math.min(94, Math.round(8 + eased * 86));
}

export function snapshotLoadingUi(input: {
  status: SnapshotLoadStatus;
  repo: string;
  elapsedMs?: number;
  error?: string;
}): SnapshotLoadingUi | null {
  if (input.status === "idle") return null;
  const repo = input.repo || "repository";
  if (input.status === "ready") {
    return {
      visible: true,
      tone: "ready",
      percent: 100,
      label: `Loaded ${repo}`,
    };
  }
  if (input.status === "error") {
    return {
      visible: true,
      tone: "error",
      percent: 100,
      label: `Failed to load ${repo}: ${input.error ?? "unknown error"}`,
    };
  }
  return {
    visible: true,
    tone: "loading",
    percent: estimateSnapshotProgress(input.elapsedMs ?? 0),
    label: `Loading ${repo}`,
  };
}
