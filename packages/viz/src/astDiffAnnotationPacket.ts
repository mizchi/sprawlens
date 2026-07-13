import type { AstSymbolLike } from "./astSymbolDiff.ts";
import type { AstDiffSymbolSelector } from "./astSymbolDiffEvaluation.ts";

export type AstDiffAnnotationPacketCase = {
  id: string;
  language: string;
  repository: string;
  beforeRevision: string;
  afterRevision: string;
  file: string;
  changeKinds: string[];
};

/** Render source evidence for a labeler without invoking the evaluated diff. */
export function renderAstDiffAnnotationPacket(
  testCase: AstDiffAnnotationPacketCase,
  afterSymbols: readonly AstSymbolLike[],
  unifiedDiff: string,
  options: {
    predictionBlind?: boolean;
    packetId?: string;
    candidateSelectors?: readonly AstDiffSymbolSelector[];
  } = {},
): string {
  const byId = new Map(afterSymbols.map((symbol) => [symbol.id, symbol]));
  const orderedSymbols = [...afterSymbols].sort(
    (a, b) =>
      (a.startLine ?? 0) - (b.startLine ?? 0) ||
      a.kind.localeCompare(b.kind) ||
      a.name.localeCompare(b.name) ||
      a.id.localeCompare(b.id),
  );
  if (
    options.candidateSelectors !== undefined &&
    options.candidateSelectors.length !== orderedSymbols.length
  ) {
    throw new Error("candidateSelectors must correspond one-to-one with afterSymbols");
  }
  const candidates = orderedSymbols.map((symbol, index) => {
    const parent = symbol.parentClass ? byId.get(symbol.parentClass) : undefined;
    const selector =
      options.candidateSelectors?.[index] ??
      ({
        kind: symbol.kind,
        name: symbol.name,
        ...(parent ? { parent: { kind: parent.kind, name: parent.name } } : {}),
      } satisfies AstDiffSymbolSelector);
    const start = symbol.startLine ?? 0;
    const end = symbol.endLine ?? start;
    return `- [ ] \`added\` / \`modified\` / none — \`${JSON.stringify(selector)}\` (lines ${start}–${end})`;
  });

  return [
    `# ${options.predictionBlind === false ? "Post-hoc" : "Blind"} annotation packet: ${options.packetId ?? testCase.id}`,
    "",
    `- Repository: \`${testCase.repository}\``,
    `- Before: \`${testCase.beforeRevision}\``,
    `- After: \`${testCase.afterRevision}\``,
    `- File: \`${testCase.file}\``,
    `- Sampling strata: ${testCase.changeKinds.map((kind) => `\`${kind}\``).join(", ")}`,
    "",
    "## Instructions",
    "",
    "Inspect the source patch, then label every after-revision symbol that should be visible as added or modified. Ignore absolute line shifts, whitespace, and comments. A changed member also requires its surviving visible parent class.",
    "",
    "## Source patch",
    "",
    "```diff",
    unifiedDiff.trimEnd(),
    "```",
    "",
    "## After-revision symbol candidates",
    "",
    ...(candidates.length > 0 ? candidates : ["No after-revision symbols were extracted."]),
    "",
  ].join("\n");
}
