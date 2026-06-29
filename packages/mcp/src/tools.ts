/**
 * The MCP tool surface, kept independent of the transport so it can be unit-
 * tested without a client. Each tool maps its arguments to an `@sprawlens/agent`
 * intent and runs it through the shared `applyIntent`; a `Session` carries the
 * headless ViewState that navigation tools advance. `server.ts` wires these
 * descriptors into the MCP SDK.
 */
import type { GraphIndex, Intent, IntentResult, ViewState } from "@sprawlens/agent";
import { applyIntent, initialView, renderView } from "@sprawlens/agent";

type JsonSchema = {
  type: "object";
  properties: Record<string, { type: string; description?: string }>;
  required?: string[];
};

type ToolDescriptor = { name: string; description: string; inputSchema: JsonSchema };

type ToolSpec = ToolDescriptor & { toIntent: (args: Record<string, unknown>) => Intent };

const obj = (properties: JsonSchema["properties"], required: string[] = []): JsonSchema => ({
  type: "object",
  properties,
  required,
});

const str = (description: string) => ({ type: "string", description });
const numb = (description: string) => ({ type: "number", description });

/** Intent-backed tools. `get_view` is handled directly by the Session (it reads
 * state rather than running an intent) and added to the listing separately. */
const TOOL_SPECS: ToolSpec[] = [
  {
    name: "structure",
    description:
      "List the children one level down: top-level modules (no target), a module's files, or a file's symbols.",
    inputSchema: obj({ target: str("module/file id; omit for the top-level module list") }),
    toIntent: (a) => ({ type: "structure", target: a.target as string | undefined }),
  },
  {
    name: "dependencies",
    description: "What the target depends on (imports), depth-bounded (default 1 = direct).",
    inputSchema: obj({ target: str("node or module id"), depth: numb("hops, default 1") }, [
      "target",
    ]),
    toIntent: (a) => ({
      type: "dependencies",
      target: a.target as string,
      depth: a.depth as number | undefined,
    }),
  },
  {
    name: "dependents",
    description: "What depends on the target, depth-bounded (default 1 = direct).",
    inputSchema: obj({ target: str("node or module id"), depth: numb("hops, default 1") }, [
      "target",
    ]),
    toIntent: (a) => ({
      type: "dependents",
      target: a.target as string,
      depth: a.depth as number | undefined,
    }),
  },
  {
    name: "impact",
    description: "Everything affected by changing the target (full upstream dependency closure).",
    inputSchema: obj({ target: str("node or module id") }, ["target"]),
    toIntent: (a) => ({ type: "impact", target: a.target as string }),
  },
  {
    name: "find",
    description: "Fuzzy-search modules and nodes by label/id; returns ranked matches.",
    inputSchema: obj({ query: str("search text"), limit: numb("max results, default 10") }, [
      "query",
    ]),
    toIntent: (a) => ({
      type: "find",
      query: a.query as string,
      limit: a.limit as number | undefined,
    }),
  },
  {
    name: "cycles",
    description: "Dependency cycles (strongly-connected components) at the module or file level.",
    inputSchema: obj({ level: str('"module" (default) or "file"') }),
    toIntent: (a) => ({ type: "cycles", level: a.level as "module" | "file" | undefined }),
  },
  {
    name: "path",
    description: "Shortest dependency path from one node/module to another (following imports).",
    inputSchema: obj({ from: str("source id"), to: str("target id") }, ["from", "to"]),
    toIntent: (a) => ({ type: "path", from: a.from as string, to: a.to as string }),
  },
  {
    name: "describe",
    description: "Metadata and in/out degree for a node or module.",
    inputSchema: obj({ target: str("node or module id") }, ["target"]),
    toIntent: (a) => ({ type: "describe", target: a.target as string }),
  },
  {
    name: "focus",
    description:
      "Frame the target and select it in the headless view (so a later render centers on it).",
    inputSchema: obj({ target: str("node or module id") }, ["target"]),
    toIntent: (a) => ({ type: "focus", target: a.target as string }),
  },
];

const GET_VIEW: ToolDescriptor = {
  name: "get_view",
  description: "Return the current headless view state (layout, granularity, selection, camera).",
  inputSchema: obj({}),
};

const RENDER: ToolDescriptor = {
  name: "render",
  description:
    "Render the current view to an SVG map image: modules as colored districts, files as hierarchical-wedge cells, the selection outlined, a focused node's dependencies/dependents tinted, cropped to the focused module.",
  inputSchema: obj({ theme: str('"light" (default) or "dark"') }),
};

/** Everything advertised to the MCP client. */
export const TOOLS: ToolDescriptor[] = [
  ...TOOL_SPECS.map(({ name, description, inputSchema }) => ({ name, description, inputSchema })),
  GET_VIEW,
  RENDER,
];

/** One client connection: the graph it queries plus the view it's navigating. */
export class Session {
  view: ViewState = initialView;
  constructor(private readonly idx: GraphIndex) {}

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
      const svg = renderView(this.idx, this.view, {
        theme: args.theme === "dark" ? "dark" : "light",
      });
      return { kind: "data", data: svg, summary: `Rendered SVG map (${svg.length} bytes)` };
    }
    const spec = TOOL_SPECS.find((s) => s.name === name);
    if (!spec) return { kind: "error", message: `unknown tool: ${name}` };
    const { view, result } = applyIntent(this.idx, this.view, spec.toIntent(args));
    this.view = view;
    return result;
  }
}
