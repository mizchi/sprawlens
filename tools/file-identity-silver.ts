export type IdentityPair = { beforePath: string; afterPath: string };

export type GitRenamePair = IdentityPair & { similarity: number };

export function parseGitRenameStatus(output: string): GitRenamePair[] {
  if (output.includes("\0")) {
    const fields = output.split("\0");
    const pairs: GitRenamePair[] = [];
    for (let index = 0; index + 2 < fields.length; index += 3) {
      const status = fields[index] ?? "";
      const match = /^R(\d+)$/.exec(status);
      if (!match) continue;
      const beforePath = fields[index + 1];
      const afterPath = fields[index + 2];
      if (!beforePath || !afterPath) continue;
      pairs.push({ beforePath, afterPath, similarity: Number(match[1]) });
    }
    return pairs;
  }
  const pairs: GitRenamePair[] = [];
  for (const line of output.split("\n")) {
    if (!line) continue;
    const [status, beforePath, afterPath] = line.split("\t");
    const match = /^R(\d+)$/.exec(status ?? "");
    if (!match || !beforePath || !afterPath) continue;
    pairs.push({ beforePath, afterPath, similarity: Number(match[1]) });
  }
  return pairs;
}

export function compareIdentityPairs(
  predicted: readonly IdentityPair[],
  silver: readonly IdentityPair[],
): { agreements: number; predictionOnly: number; silverOnly: number } {
  const predictedKeys = new Set(predicted.map(pairKey));
  const silverKeys = new Set(silver.map(pairKey));
  let agreements = 0;
  for (const key of predictedKeys) {
    if (silverKeys.has(key)) agreements += 1;
  }
  return {
    agreements,
    predictionOnly: predictedKeys.size - agreements,
    silverOnly: silverKeys.size - agreements,
  };
}

function pairKey(pair: IdentityPair): string {
  return JSON.stringify([pair.beforePath, pair.afterPath]);
}
