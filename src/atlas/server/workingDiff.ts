import { execFile } from "node:child_process";
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
