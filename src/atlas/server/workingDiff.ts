import { execFile } from "node:child_process";
import { watch } from "node:fs";
import { promisify } from "node:util";

/**
 * Uncommitted working-tree changes in the same shape as a history diff,
 * so the map highlights them with the existing changed-file strokes.
 */
export type WorkingDiff = {
  changed: Record<string, "added" | "modified">;
  removed: string[];
};

export function parseGitStatus(porcelain: string): WorkingDiff {
  const changed: Record<string, "added" | "modified"> = {};
  const removed: string[] = [];
  for (const line of porcelain.split("\n")) {
    if (line.length < 4) continue;
    const status = line.slice(0, 2);
    const path = line.slice(3);
    if (status === "??") {
      changed[path] = "added";
    } else if (status.includes("R")) {
      const arrow = path.indexOf(" -> ");
      if (arrow >= 0) {
        removed.push(path.slice(0, arrow));
        changed[path.slice(arrow + 4)] = "added";
      }
    } else if (status.includes("D")) {
      removed.push(path);
    } else if (status.includes("A")) {
      changed[path] = "added";
    } else if (/[MTU]/.test(status)) {
      changed[path] = "modified";
    }
  }
  return { changed, removed };
}

export async function workingDiff(root: string): Promise<WorkingDiff> {
  const { stdout } = await promisify(execFile)(
    "git",
    ["status", "--porcelain"],
    { cwd: root, maxBuffer: 10 * 1024 * 1024 },
  );
  return parseGitStatus(stdout);
}

/** Event noise the watcher must never react to (or `git status` runs would
 * feed back into the watch loop via .git/index writes). */
export function isIgnoredPath(path: string): boolean {
  const normalized = path.replaceAll("\\", "/");
  return /(^|\/)(\.git|node_modules|dist|\.codesprawl|coverage|\.turbo)(\/|$)/.test(
    normalized,
  );
}

/**
 * Watches the working tree and pushes a fresh diff whenever it actually
 * changes: fs events are batched through a trailing debounce, then one
 * `git status` runs and the listener fires only when the result differs
 * from the last push. Returns a stop function.
 */
export function watchWorkingDiff(
  root: string,
  listener: (diff: WorkingDiff) => void,
  debounceMs = 300,
): () => void {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let lastJson: string | null = null;
  let stopped = false;
  const refresh = () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(async () => {
      timer = null;
      try {
        const diff = await workingDiff(root);
        const json = JSON.stringify(diff);
        if (stopped || json === lastJson) return;
        lastJson = json;
        listener(diff);
      } catch {
        // git unavailable mid-operation (rebase etc.): retry on next event
      }
    }, debounceMs);
  };
  const watcher = watch(root, { recursive: true }, (_event, filename) => {
    if (!filename || isIgnoredPath(filename)) return;
    refresh();
  });
  refresh();
  return () => {
    stopped = true;
    watcher.close();
    if (timer) clearTimeout(timer);
  };
}
