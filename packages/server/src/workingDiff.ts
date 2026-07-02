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
  stats?: Record<string, DiffLineStat>;
  hunks?: Record<string, DiffHunk[]>;
};

export type DiffLineStat = {
  added: number;
  deleted: number;
  touched: number;
};

export type DiffHunk = {
  oldStart: number;
  oldLines: number;
  newStart: number;
  newLines: number;
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
export async function enrichWithLoc(
  root: string,
  diff: WorkingDiff,
  base?: string,
): Promise<WorkingDiff> {
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
  const { stats, hunks } = await diffDetails(root, diff, loc, base);
  return { ...diff, loc, stats, hunks };
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

export function parseNumstat(output: string): Record<string, { added: number; deleted: number }> {
  const stats: Record<string, { added: number; deleted: number }> = {};
  for (const line of output.split("\n")) {
    if (!line) continue;
    const [addedText, deletedText, ...pathParts] = line.split("\t");
    const added = Number.parseInt(addedText ?? "", 10);
    const deleted = Number.parseInt(deletedText ?? "", 10);
    if (!Number.isFinite(added) || !Number.isFinite(deleted)) continue;
    const path = normalizeDiffPath(pathParts.join("\t"));
    if (path) stats[path] = { added, deleted };
  }
  return stats;
}

export function parseUnifiedDiffHunks(output: string): Record<string, DiffHunk[]> {
  const hunks: Record<string, DiffHunk[]> = {};
  let currentPath: string | null = null;
  for (const line of output.split("\n")) {
    if (line.startsWith("+++ ")) {
      currentPath = normalizePatchPath(line.slice(4));
      continue;
    }
    if (!currentPath) continue;
    const match = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/.exec(line);
    if (!match) continue;
    (hunks[currentPath] ??= []).push({
      oldStart: Number.parseInt(match[1]!, 10),
      oldLines: match[2] === undefined ? 1 : Number.parseInt(match[2], 10),
      newStart: Number.parseInt(match[3]!, 10),
      newLines: match[4] === undefined ? 1 : Number.parseInt(match[4], 10),
    });
  }
  return hunks;
}

export function touchCountFromHunks(hunks: readonly DiffHunk[] | undefined): number {
  if (!hunks?.length) return 0;
  return hunks.reduce((sum, hunk) => sum + (hunk.newLines > 0 ? hunk.newLines : hunk.oldLines), 0);
}

function normalizePatchPath(path: string): string | null {
  const clean = path.split("\t")[0]!.trim();
  if (clean === "/dev/null") return null;
  return normalizeDiffPath(clean.startsWith("b/") ? clean.slice(2) : clean);
}

function normalizeDiffPath(path: string): string {
  const clean = path.trim();
  const braced = /^(.*)\{(.+?) => (.+?)\}(.*)$/.exec(clean);
  if (braced) return `${braced[1]}${braced[3]}${braced[4]}`;
  const plain = /^(.+?) => (.+)$/.exec(clean);
  if (plain) return plain[2]!;
  return clean;
}

/** Refs travel into git argv: never empty, never option-shaped. */
export function isSafeRef(ref: string): boolean {
  return /^[A-Za-z0-9][A-Za-z0-9_./~^@{}-]*$/.test(ref);
}

const exec = promisify(execFile);
const GIT_OPTS = { maxBuffer: 10 * 1024 * 1024 };

async function diffDetails(
  root: string,
  diff: WorkingDiff,
  loc: Record<string, number>,
  base?: string,
): Promise<Pick<WorkingDiff, "stats" | "hunks">> {
  const stats: Record<string, DiffLineStat> = {};
  let hunks: Record<string, DiffHunk[]> = {};
  const ref = base || "HEAD";
  if (isSafeRef(ref)) {
    try {
      const [{ stdout: numstat }, { stdout: patch }] = await Promise.all([
        exec("git", ["diff", "--numstat", ref, "--"], { cwd: root, ...GIT_OPTS }),
        exec("git", ["diff", "--unified=0", ref, "--"], { cwd: root, ...GIT_OPTS }),
      ]);
      const parsedHunks = parseUnifiedDiffHunks(patch);
      for (const [path, stat] of Object.entries(parseNumstat(numstat))) {
        if (!diff.changed[path]) continue;
        stats[path] = {
          added: stat.added,
          deleted: stat.deleted,
          touched: touchCountFromHunks(parsedHunks[path]) || stat.added + stat.deleted,
        };
      }
      hunks = Object.fromEntries(
        Object.entries(parsedHunks).filter(([path]) => diff.changed[path]),
      );
    } catch {
      // Git can be transiently unavailable during rebases or initial repos.
      // The caller still gets loc and the binary changed/removed shape.
    }
  }
  for (const [path, kind] of Object.entries(diff.changed)) {
    if (stats[path]) continue;
    const lines = loc[path] ?? 0;
    if (kind === "added") {
      stats[path] = { added: lines, deleted: 0, touched: lines };
      if (lines > 0 && !hunks[path]) {
        hunks[path] = [{ oldStart: 0, oldLines: 0, newStart: 1, newLines: lines }];
      }
    }
  }
  return { stats, hunks };
}

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
 * `git status` runs. Clean no-op bursts are suppressed, but a dirty tree is
 * re-emitted even when the changed-file set is stable because LOC and hunk
 * density can change inside the same files. Returns a stop function.
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
        const dirty = Object.keys(diff.changed).length > 0 || diff.removed.length > 0;
        if (stopped || (json === lastJson && !dirty)) return;
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
