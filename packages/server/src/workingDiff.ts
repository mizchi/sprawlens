import { execFile } from "node:child_process";
import { watch } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { promisify } from "node:util";

/**
 * Uncommitted working-tree changes in the same shape as a history diff,
 * so the map highlights them with the existing changed-file strokes.
 * `loc` carries the current line count of each changed/added file so the
 * client can re-target that cell's area without a full re-parse — the
 * file-level unit of incremental recompute.
 */
export type WorkingDiff = {
  changed: Record<string, "added" | "modified">;
  removed: string[];
  loc?: Record<string, number>;
};

/** Line count of a file's content (a trailing newline does not add one). */
export function countLines(content: string): number {
  if (content.length === 0) return 0;
  const breaks = content.split("\n").length;
  return content.endsWith("\n") ? breaks - 1 : breaks;
}

/**
 * Attach the current line count of every changed/added file. Reads are
 * best-effort: a file deleted between the diff and the read (or binary,
 * unreadable) is simply omitted from `loc`, and the cell keeps its prior
 * area. Removed files are not read.
 */
export async function enrichWithLoc(root: string, diff: WorkingDiff): Promise<WorkingDiff> {
  const loc: Record<string, number> = {};
  await Promise.all(
    Object.keys(diff.changed).map(async (path) => {
      try {
        loc[path] = countLines(await readFile(join(root, path), "utf8"));
      } catch {
        // unreadable mid-operation: leave the cell at its prior area
      }
    }),
  );
  return { ...diff, loc };
}

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

/** `git diff --name-status <base>` lines: `M\tpath`, `R087\told\tnew`, ... */
export function parseNameStatus(output: string): WorkingDiff {
  const changed: Record<string, "added" | "modified"> = {};
  const removed: string[] = [];
  for (const line of output.split("\n")) {
    const parts = line.split("\t");
    const code = parts[0]?.[0];
    if (!code || parts.length < 2) continue;
    if (code === "R" || code === "C") {
      if (parts.length >= 3) {
        if (code === "R") removed.push(parts[1]!);
        changed[parts[2]!] = "added";
      }
    } else if (code === "D") {
      removed.push(parts[1]!);
    } else if (code === "A") {
      changed[parts[1]!] = "added";
    } else {
      changed[parts[1]!] = "modified";
    }
  }
  return { changed, removed };
}

/** Refs travel into git argv: never empty, never option-shaped. */
export function isSafeRef(ref: string): boolean {
  return /^[A-Za-z0-9][A-Za-z0-9_./~^@{}-]*$/.test(ref);
}

const exec = promisify(execFile);
const GIT_OPTS = { maxBuffer: 10 * 1024 * 1024 };

/**
 * Changes in the working tree. Without `base`: uncommitted changes vs
 * HEAD (`git status`). With `base`: everything that differs from that
 * ref — committed and dirty — plus untracked files.
 */
export async function workingDiff(root: string, base?: string): Promise<WorkingDiff> {
  const { stdout: status } = await exec("git", ["status", "--porcelain"], {
    cwd: root,
    ...GIT_OPTS,
  });
  const dirty = parseGitStatus(status);
  if (!base) return dirty;
  if (!isSafeRef(base)) throw new Error(`unsafe ref: ${base}`);
  const { stdout } = await exec("git", ["diff", "--name-status", base], {
    cwd: root,
    ...GIT_OPTS,
  });
  const diff = parseNameStatus(stdout);
  // git diff misses untracked files; merge them in from status
  for (const [path, kind] of Object.entries(dirty.changed)) {
    if (kind === "added" && !diff.changed[path]) diff.changed[path] = "added";
  }
  return diff;
}

/** Event noise the watcher must never react to (or `git status` runs would
 * feed back into the watch loop via .git/index writes). */
export function isIgnoredPath(path: string): boolean {
  const normalized = path.replaceAll("\\", "/");
  return /(^|\/)(\.git|node_modules|dist|\.codesprawl|coverage|\.turbo)(\/|$)/.test(normalized);
}

/**
 * fs.watch the tree with a trailing debounce, skipping ignored paths. Calls
 * `onChange` once per settled burst of edits. Returns a stop function. The
 * generic building block under both the working-diff and snapshot streams.
 */
export function watchDir(root: string, onChange: () => void, debounceMs = 300): () => void {
  let timer: ReturnType<typeof setTimeout> | null = null;
  const fire = () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      onChange();
    }, debounceMs);
  };
  const watcher = watch(root, { recursive: true }, (_event, filename) => {
    if (!filename || isIgnoredPath(filename)) return;
    fire();
  });
  return () => {
    watcher.close();
    if (timer) clearTimeout(timer);
  };
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
  base?: string,
): () => void {
  let lastJson: string | null = null;
  let stopped = false;
  const stop = watchDir(
    root,
    async () => {
      try {
        const diff = await workingDiff(root, base);
        const json = JSON.stringify(diff);
        if (stopped || json === lastJson) return;
        lastJson = json;
        listener(diff);
      } catch {
        // git unavailable mid-operation (rebase etc.): retry on next event
      }
    },
    debounceMs,
  );
  // emit the initial diff immediately (watchDir only fires on later changes)
  void (async () => {
    try {
      const diff = await workingDiff(root, base);
      lastJson = JSON.stringify(diff);
      if (!stopped) listener(diff);
    } catch {
      // no git / not a repo: stay quiet until a change occurs
    }
  })();
  return () => {
    stopped = true;
    stop();
  };
}
