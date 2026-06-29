/**
 * Headless renderer: project a graph + ViewState to a static SVG so an agent can
 * *see* the map without a browser. A two-level squarified treemap (modules →
 * files) reusing the layout's `squarify` and the live map's hierarchical wedge
 * colors, so the image reads like the interactive map's treemap mode. Selection
 * is outlined; a focused node tints its direct dependencies / dependents; the
 * camera crops the viewBox to the focused module.
 */
import {
  type Rect,
  squarify,
  type WedgeProfile,
  hashKey,
  moduleHue,
  wedgeColor,
} from "@sprawlens/layout";
import type { GraphIndex } from "./graphQuery.ts";
import { dependencies, dependents, resolve } from "./graphQuery.ts";
import type { ViewState } from "./viewState.ts";

export type RenderOptions = { width?: number; height?: number; theme?: "light" | "dark" };

type Theme = {
  bg: string;
  wedge: WedgeProfile;
  districtFill: (h: number) => string;
  districtStroke: (h: number) => string;
  label: string;
  select: string;
  depFill: string;
  dependentFill: string;
};

const THEMES: Record<"light" | "dark", Theme> = {
  light: {
    bg: "#f8fafc",
    wedge: { l: [0.86, 0.95], c: [0.035, 0.09], hueSpread: 24 },
    districtFill: (h) => `hsl(${h} 30% 97%)`,
    districtStroke: (h) => `hsl(${h} 45% 55%)`,
    label: "#0f172a",
    select: "#1d4ed8",
    depFill: "hsl(21 90% 86%)",
    dependentFill: "hsl(193 70% 86%)",
  },
  dark: {
    bg: "#111827",
    wedge: { l: [0.2, 0.32], c: [0.045, 0.11], hueSpread: 24 },
    districtFill: (h) => `hsl(${h} 35% 12%)`,
    districtStroke: (h) => `hsl(${h} 50% 45%)`,
    label: "#e2e8f0",
    select: "#60a5fa",
    depFill: "hsl(21 65% 28%)",
    dependentFill: "hsl(193 55% 26%)",
  },
};

const esc = (s: string): string =>
  s.replace(/[<>&]/g, (c) => (c === "<" ? "&lt;" : c === ">" ? "&gt;" : "&amp;"));

const rect = (r: Rect, fill: string, stroke: string, sw: number): string =>
  `<rect x="${r.x.toFixed(1)}" y="${r.y.toFixed(1)}" width="${r.w.toFixed(1)}" height="${r.h.toFixed(1)}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"/>`;

/** Render `view` over `idx` to an SVG document string. */
export function renderView(idx: GraphIndex, view: ViewState, opts: RenderOptions = {}): string {
  const W = opts.width ?? 960;
  const H = opts.height ?? 640;
  const theme = THEMES[opts.theme ?? "light"];

  const selected = new Set(view.selection);
  // a focused node tints its 1-hop neighbors so the image answers "what does
  // this connect to". Resolve the first selection/camera target to its level.
  const focusTarget = view.camera.target ?? view.selection[0];
  const focusLevel = focusTarget ? resolve(idx, focusTarget)?.level : undefined;
  const depSet = new Set(
    focusTarget ? (dependencies(idx, focusTarget)?.items.map((i) => i.id) ?? []) : [],
  );
  const dependentSet = new Set(
    focusTarget ? (dependents(idx, focusTarget)?.items.map((i) => i.id) ?? []) : [],
  );

  // filesByModule, module weight = file count
  const filesByModule = new Map<string, string[]>();
  for (const [f, m] of idx.moduleOfFile)
    (filesByModule.get(m) ?? filesByModule.set(m, []).get(m)!).push(f);

  const moduleTiles = squarify(
    [...filesByModule].map(([id, files]) => ({ id, weight: files.length })),
    { x: 0, y: 0, w: W, h: H },
  );

  const body: string[] = [];
  const labels: string[] = [];
  let focusRect: Rect | null = null;

  for (const mt of moduleTiles) {
    const moduleId = mt.item.id;
    const hue = moduleHue(moduleId);
    const moduleRect: Rect = { x: mt.x, y: mt.y, w: mt.w, h: mt.h };
    if (focusLevel === "module" && moduleId === focusTarget) focusRect = moduleRect;
    const moduleSelected = selected.has(moduleId);
    body.push(
      rect(
        moduleRect,
        theme.districtFill(hue),
        moduleSelected ? theme.select : theme.districtStroke(hue),
        moduleSelected ? 2.5 : 1,
      ),
    );

    // inset for the module's files (leave a rim for the border + label)
    const pad = 3;
    const inner: Rect = {
      x: mt.x + pad,
      y: mt.y + pad + 12,
      w: Math.max(0, mt.w - pad * 2),
      h: Math.max(0, mt.h - pad * 2 - 12),
    };
    const files = filesByModule.get(moduleId)!;
    const fileTiles = squarify(
      files.map((f) => ({ id: f, weight: Math.max(1, idx.nodeById.get(f)?.metrics.loc ?? 1) })),
      inner,
    );
    for (const ft of fileTiles) {
      const id = ft.item.id;
      const r: Rect = { x: ft.x, y: ft.y, w: ft.w, h: ft.h };
      if (focusLevel === "file" && id === focusTarget) focusRect = moduleRect;
      const fill = selected.has(id)
        ? wedgeColor(hue, hashKey(id), theme.wedge)
        : depSet.has(id)
          ? theme.depFill
          : dependentSet.has(id)
            ? theme.dependentFill
            : wedgeColor(hue, hashKey(id), theme.wedge);
      body.push(
        rect(
          r,
          fill,
          selected.has(id) ? theme.select : theme.districtStroke(hue),
          selected.has(id) ? 2 : 0.4,
        ),
      );
    }

    // module label, gated on enough room
    if (mt.w > 60 && mt.h > 24) {
      labels.push(
        `<text x="${(mt.x + 4).toFixed(1)}" y="${(mt.y + 11).toFixed(1)}" font-family="ui-monospace, monospace" font-size="10" font-weight="700" fill="${theme.label}">${esc(moduleId)}</text>`,
      );
    }
  }

  const view0 = focusRect
    ? `${(focusRect.x - 8).toFixed(1)} ${(focusRect.y - 8).toFixed(1)} ${(focusRect.w + 16).toFixed(1)} ${(focusRect.h + 16).toFixed(1)}`
    : `0 0 ${W} ${H}`;

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="${view0}">`,
    `<rect x="0" y="0" width="${W}" height="${H}" fill="${theme.bg}"/>`,
    ...body,
    ...labels,
    `</svg>`,
  ].join("");
}
