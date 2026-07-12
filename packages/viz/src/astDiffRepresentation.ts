/** Changed line numbers on the after side of a zero-context unified diff. */
export function parseChangedAfterLines(unifiedDiff: string): number[] {
  const lines = new Set<number>();
  for (const line of unifiedDiff.split("\n")) {
    const match = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/.exec(line);
    if (!match) continue;
    const start = Number.parseInt(match[1]!, 10);
    const count = match[2] === undefined ? 1 : Number.parseInt(match[2], 10);
    for (let offset = 0; offset < count; offset++) lines.add(start + offset);
  }
  return [...lines].sort((a, b) => a - b);
}
