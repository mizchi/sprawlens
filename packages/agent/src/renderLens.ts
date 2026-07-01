import type { LensNode, LensResult } from "./graphQuery.ts";

export type RenderLensOptions = {
  width?: number;
  height?: number;
  theme?: "light" | "dark";
};

type Theme = {
  bg: string;
  panel: string;
  edge: string;
  label: string;
  muted: string;
  target: string;
  dependent: string;
  dependency: string;
  both: string;
  changedAdded: string;
  changedModified: string;
};

const THEMES: Record<"light" | "dark", Theme> = {
  light: {
    bg: "#f8fafc",
    panel: "#ffffff",
    edge: "#64748b",
    label: "#0f172a",
    muted: "#475569",
    target: "#dbeafe",
    dependent: "#cffafe",
    dependency: "#ffedd5",
    both: "#ede9fe",
    changedAdded: "#22c55e",
    changedModified: "#ef4444",
  },
  dark: {
    bg: "#0f172a",
    panel: "#111827",
    edge: "#94a3b8",
    label: "#e5e7eb",
    muted: "#cbd5e1",
    target: "#1e3a8a",
    dependent: "#164e63",
    dependency: "#7c2d12",
    both: "#4c1d95",
    changedAdded: "#4ade80",
    changedModified: "#fb7185",
  },
};

const esc = (s: string): string =>
  s.replace(/[<>&"]/g, (c) =>
    c === "<" ? "&lt;" : c === ">" ? "&gt;" : c === "&" ? "&amp;" : "&quot;",
  );

const short = (s: string, max = 34): string => (s.length <= max ? s : `${s.slice(0, max - 3)}...`);

const fillOf = (node: LensNode, theme: Theme): string => {
  if (node.role === "target") return theme.target;
  if (node.role === "dependent") return theme.dependent;
  if (node.role === "dependency") return theme.dependency;
  return theme.both;
};

export function renderLens(result: LensResult, opts: RenderLensOptions = {}): string {
  const W = opts.width ?? 960;
  const H = opts.height ?? 560;
  const theme = THEMES[opts.theme ?? "light"];
  const cx = W / 2;
  const colW = Math.max(150, Math.min(230, (W - 160) / Math.max(2, result.depth * 2)));
  const nodeW = Math.min(220, colW - 22);
  const nodeH = 40;
  const top = 82;
  const bottom = H - 44;

  const keyOf = (n: LensNode): string => {
    if (n.role === "target" || n.role === "both") return n.role;
    return `${n.role}:${n.depth}`;
  };
  const groups = new Map<string, LensNode[]>();
  for (const node of result.nodes) {
    const key = keyOf(node);
    (groups.get(key) ?? groups.set(key, []).get(key)!).push(node);
  }
  for (const nodes of groups.values()) nodes.sort((a, b) => a.id.localeCompare(b.id));

  const xOf = (node: LensNode): number => {
    if (node.role === "target" || node.role === "both") return cx - nodeW / 2;
    const dir = node.role === "dependent" ? -1 : 1;
    return cx + dir * colW * node.depth - nodeW / 2;
  };

  const yById = new Map<string, number>();
  const xById = new Map<string, number>();
  const placeGroup = (key: string, nodes: LensNode[]) => {
    const span = bottom - top;
    const step = nodes.length <= 1 ? 0 : Math.min(58, span / (nodes.length - 1));
    const start = nodes.length <= 1 ? H / 2 - nodeH / 2 : H / 2 - ((nodes.length - 1) * step) / 2;
    nodes.forEach((node, i) => {
      xById.set(node.id, xOf(node));
      yById.set(node.id, Math.max(top, Math.min(bottom - nodeH, start + i * step)));
    });
  };
  for (const [key, nodes] of groups) placeGroup(key, nodes);

  const edges = result.edges
    .filter((e) => xById.has(e.source) && xById.has(e.target))
    .map((e) => {
      const sx = xById.get(e.source)! + nodeW;
      const sy = yById.get(e.source)! + nodeH / 2;
      const tx = xById.get(e.target)!;
      const ty = yById.get(e.target)! + nodeH / 2;
      const c = Math.max(40, Math.abs(tx - sx) * 0.45);
      return `<path d="M ${sx.toFixed(1)} ${sy.toFixed(1)} C ${(sx + c).toFixed(1)} ${sy.toFixed(1)}, ${(tx - c).toFixed(1)} ${ty.toFixed(1)}, ${tx.toFixed(1)} ${ty.toFixed(1)}" fill="none" stroke="${theme.edge}" stroke-width="1.2" stroke-opacity="0.65" marker-end="url(#arrow)"/>`;
    });

  const nodes = result.nodes.map((node) => {
    const x = xById.get(node.id)!;
    const y = yById.get(node.id)!;
    const changed = node.changed
      ? `<rect x="${(x + nodeW - 9).toFixed(1)}" y="${(y + 5).toFixed(1)}" width="4" height="${(nodeH - 10).toFixed(1)}" rx="2" fill="${node.changed === "added" ? theme.changedAdded : theme.changedModified}"/>`
      : "";
    return [
      `<g>`,
      `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${nodeW.toFixed(1)}" height="${nodeH}" rx="6" fill="${fillOf(node, theme)}" stroke="${node.role === "target" ? theme.label : theme.edge}" stroke-width="${node.role === "target" ? 2 : 1}"/>`,
      changed,
      `<title>${esc(node.id)}</title>`,
      `<text x="${(x + 10).toFixed(1)}" y="${(y + 17).toFixed(1)}" font-family="ui-monospace, monospace" font-size="11" font-weight="700" fill="${theme.label}">${esc(short(node.label))}</text>`,
      `<text x="${(x + 10).toFixed(1)}" y="${(y + 31).toFixed(1)}" font-family="ui-sans-serif, system-ui, sans-serif" font-size="10" fill="${theme.muted}">${esc(`${node.role} d${node.depth}`)}</text>`,
      `</g>`,
    ].join("");
  });

  const subtitle = `${result.level} lens, ${result.nodes.length} nodes, ${result.edges.length} edges, ${result.summary.dependents} upstream / ${result.summary.dependencies} downstream`;
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">`,
    `<defs><marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="${theme.edge}"/></marker></defs>`,
    `<rect x="0" y="0" width="${W}" height="${H}" fill="${theme.bg}"/>`,
    `<text x="24" y="30" font-family="ui-sans-serif, system-ui, sans-serif" font-size="18" font-weight="700" fill="${theme.label}">Agent Lens</text>`,
    `<text x="24" y="50" font-family="ui-sans-serif, system-ui, sans-serif" font-size="12" fill="${theme.muted}">${esc(result.target)}</text>`,
    `<text x="${W - 24}" y="32" text-anchor="end" font-family="ui-sans-serif, system-ui, sans-serif" font-size="12" fill="${theme.muted}">${esc(subtitle)}</text>`,
    ...edges,
    ...nodes,
    `</svg>`,
  ].join("");
}
