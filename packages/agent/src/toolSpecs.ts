/**
 * The intent vocabulary as LLM-callable tool specs: a name, a description, a
 * JSON-Schema for the arguments, and a mapping from arguments to an `Intent`.
 * Shared by the in-app chat loop (LLM function-calling) and the MCP server, so
 * there is one source for "what the agent can do".
 */
import type { Intent } from "./intent.ts";

export type JsonSchema = {
  type: "object";
  properties: Record<string, { type: string; description?: string }>;
  required?: string[];
};

export type IntentToolSpec = {
  name: string;
  description: string;
  inputSchema: JsonSchema;
  toIntent: (args: Record<string, unknown>) => Intent;
};

const obj = (properties: JsonSchema["properties"], required: string[] = []): JsonSchema => ({
  type: "object",
  properties,
  required,
});
const str = (description: string) => ({ type: "string", description });
const numb = (description: string) => ({ type: "number", description });

/** Query tools — read the graph, do not change the view. */
const QUERY_TOOLS: IntentToolSpec[] = [
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
    name: "lens",
    description:
      "Return a Query/Agent Lens: a depth-bounded subgraph around a target with dependency/dependent roles.",
    inputSchema: obj(
      {
        target: str("node or module id"),
        direction: str('"dependencies", "dependents", or "both" (default)'),
        depth: numb("hops, default 1"),
        maxNodes: numb("maximum nodes, default 48"),
      },
      ["target"],
    ),
    toIntent: (a) => ({
      type: "lens",
      target: a.target as string,
      direction: a.direction as "dependencies" | "dependents" | "both" | undefined,
      depth: a.depth as number | undefined,
      maxNodes: a.maxNodes as number | undefined,
    }),
  },
];

/** Navigation tools — advance the view (what the map shows). */
const NAVIGATION_TOOLS: IntentToolSpec[] = [
  {
    name: "focus",
    description: "Frame the target and select it.",
    inputSchema: obj({ target: str("node or module id") }, ["target"]),
    toIntent: (a) => ({ type: "focus", target: a.target as string }),
  },
  {
    name: "select",
    description: "Select node ids (replace, or add with additive=true).",
    inputSchema: obj(
      {
        ids: { type: "array", description: "node ids" },
        additive: { type: "boolean", description: "add to current selection" },
      } as unknown as JsonSchema["properties"],
      ["ids"],
    ),
    toIntent: (a) => ({
      type: "select",
      ids: (a.ids as string[]) ?? [],
      additive: a.additive as boolean | undefined,
    }),
  },
  {
    name: "set_granularity",
    description: 'Switch detail level: "module", "file", or "symbol".',
    inputSchema: obj({ granularity: str('"module" | "file" | "symbol"') }, ["granularity"]),
    toIntent: (a) => ({
      type: "setGranularity",
      granularity: a.granularity as "module" | "file" | "symbol",
    }),
  },
  {
    name: "set_layout",
    description: 'Switch layout: "rings" or "treemap".',
    inputSchema: obj({ layout: str('"rings" | "treemap"') }, ["layout"]),
    toIntent: (a) => ({ type: "setLayout", layout: a.layout as "rings" | "treemap" }),
  },
  {
    name: "home",
    description: "Frame the whole map and clear the selection.",
    inputSchema: obj({}),
    toIntent: () => ({ type: "home" }),
  },
];

/** Everything the chat loop exposes to the model. */
export const INTENT_TOOLS: IntentToolSpec[] = [...QUERY_TOOLS, ...NAVIGATION_TOOLS];
