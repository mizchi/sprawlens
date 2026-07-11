/**
 * The MCP tool surface, kept independent of the transport so it can be unit-
 * tested without a client. The intent tools come straight from `@sprawlens/agent`
 * (`INTENT_TOOLS`, the same vocabulary the in-app chat uses); MCP adds `get_view`
 * and `render`, which read/draw the carried state rather than running an intent.
 * `server.ts` wires these descriptors into the MCP SDK.
 */
import type { GraphIndex, IntentResult, JsonSchema, LensResult, ViewState } from "@sprawlens/agent";
import type { AtlasEvidence } from "@sprawlens/schema";
import { normalizeAtlasEvidence, projectAtlasEvidence } from "@sprawlens/schema";
import {
  applyIntent,
  initialView,
  INTENT_TOOLS,
  normalizeViewState,
  renderLens,
} from "@sprawlens/agent";
import { renderAtlasViewSvg } from "@sprawlens/viz/headless";

type ToolDescriptor = { name: string; description: string; inputSchema: JsonSchema };

const obj = (properties: JsonSchema["properties"], required: string[] = []): JsonSchema => ({
  type: "object",
  properties,
  required,
});

const GET_VIEW: ToolDescriptor = {
  name: "get_view",
  description: "Return the current headless view state (layout, granularity, selection, camera).",
  inputSchema: obj({}),
};

const RENDER: ToolDescriptor = {
  name: "render",
  description:
    "Render the current ViewState through the same rings/treemap scene and SVG renderer as the interactive map.",
  inputSchema: obj({ theme: { type: "string", description: '"light" (default) or "dark"' } }),
};

const GET_EVIDENCE: ToolDescriptor = {
  name: "get_evidence",
  description: "Return the versioned diff, runtime-trace, and test evidence carried by this view.",
  inputSchema: obj({}),
};

const SEE_REPO: ToolDescriptor = {
  name: "see_repo",
  description:
    "Render a SeeRepo-style Agent Lens SVG around a target: dependents on the left, target in the center, dependencies on the right.",
  inputSchema: obj(
    {
      target: { type: "string", description: "node or module id" },
      direction: { type: "string", description: '"dependencies", "dependents", or "both"' },
      depth: { type: "number", description: "hops, default 1" },
      maxNodes: { type: "number", description: "maximum nodes, default 48" },
      theme: { type: "string", description: '"light" (default) or "dark"' },
    },
    ["target"],
  ),
};

/** Everything advertised to the MCP client. */
export const TOOLS: ToolDescriptor[] = [
  ...INTENT_TOOLS.map(({ name, description, inputSchema }) => ({ name, description, inputSchema })),
  GET_VIEW,
  GET_EVIDENCE,
  RENDER,
  SEE_REPO,
];

/** One client connection: the graph it queries plus the view it's navigating. */
export class Session {
  view: ViewState = normalizeViewState(initialView);
  readonly evidence: AtlasEvidence;
  constructor(
    private readonly idx: GraphIndex,
    evidence?: AtlasEvidence,
  ) {
    this.evidence = normalizeAtlasEvidence(evidence);
  }

  call(name: string, args: Record<string, unknown> = {}): IntentResult {
    if (name === GET_VIEW.name) {
      const v = this.view;
      return {
        kind: "data",
        data: v,
        summary: `${v.layout} / ${v.granularity}, ${v.selection.length} selected, camera ${v.camera.target ?? "(all)"}`,
      };
    }
    if (name === RENDER.name) {
      const svg = renderAtlasViewSvg(this.idx.graph, this.view, {
        dark: args.theme === "dark" ? true : args.theme === "light" ? false : undefined,
        evidence: this.evidence,
      });
      return { kind: "data", data: svg, summary: `Rendered SVG map (${svg.length} bytes)` };
    }
    if (name === GET_EVIDENCE.name) {
      const summary = projectAtlasEvidence(this.evidence).summary;
      return {
        kind: "data",
        data: this.evidence,
        summary: `${summary.changes.added + summary.changes.modified + summary.changes.removed} changes, ${summary.traceEdges} trace edges, ${Object.values(summary.tests).reduce((sum, count) => sum + count, 0)} tests`,
      };
    }
    if (name === SEE_REPO.name) {
      const applied = applyIntent(this.idx, this.view, {
        type: "lens",
        target: args.target as string,
        direction: args.direction as "dependencies" | "dependents" | "both" | undefined,
        depth: args.depth as number | undefined,
        maxNodes: args.maxNodes as number | undefined,
      });
      if (applied.result.kind !== "data") return applied.result;
      const svg = renderLens(applied.result.data as LensResult, {
        theme: args.theme === "dark" ? "dark" : "light",
      });
      return { kind: "data", data: svg, summary: `Rendered Agent Lens (${svg.length} bytes)` };
    }
    const spec = INTENT_TOOLS.find((s) => s.name === name);
    if (!spec) return { kind: "error", message: `unknown tool: ${name}` };
    const { view, result } = applyIntent(this.idx, this.view, spec.toIntent(args));
    this.view = view;
    return result;
  }
}
