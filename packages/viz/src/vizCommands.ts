import type { PlaygroundParams } from "./Controls.tsx";

/**
 * One viz operation, defined once and exposed two ways: as a WebMCP tool (so an
 * LLM can drive the map) and as a keybinding (so a human can). Keeping a single
 * registry keeps the two surfaces consistent. See useCommandBridge.
 */
export type VizCommand = {
  /** Stable id; also the WebMCP tool name. */
  id: string;
  title: string;
  /** Keyboard shortcuts (single keys, matched against KeyboardEvent.key). */
  keys?: string[];
  /** JSON Schema for the tool's arguments; omit for a no-arg command. */
  inputSchema?: Record<string, unknown>;
  /** Run it; the return value (string or JSON) is the tool result. */
  run: (args?: Record<string, unknown>) => unknown;
};

type HistoryControl = {
  active: boolean;
  index: number;
  count: number;
  go: (index: number) => void;
};

export type VizCommandCtx = {
  params: PlaygroundParams;
  setParam: (partial: Partial<PlaygroundParams>) => void;
  /** Fuzzy-find nodes by id/label substring. */
  searchNodes: (query: string) => { id: string; label: string }[];
  /** Select + frame a node by id. */
  focusNode: (id: string) => void;
  history: HistoryControl | null;
  experimental: boolean;
  toggleExperimental: () => void;
};

const SOURCES = ["synthetic", "sprawlens", "sprawlens-history", "playwright", "served"];
const enumSchema = (values: string[]) => ({
  type: "object",
  properties: { value: { type: "string", enum: values } },
  required: ["value"],
});

export function buildVizCommands(ctx: VizCommandCtx): VizCommand[] {
  const { params, setParam } = ctx;
  const toggle = (key: keyof PlaygroundParams, title: string, keys: string[]): VizCommand => ({
    id: `toggle_${key}`,
    title,
    keys,
    run: () => {
      const next = !params[key];
      setParam({ [key]: next } as Partial<PlaygroundParams>);
      return `${key} = ${next}`;
    },
  });

  const commands: VizCommand[] = [
    {
      id: "set_layout",
      title: "Set the map layout (rings or treemap)",
      inputSchema: enumSchema(["rings", "treemap"]),
      keys: undefined,
      run: (a) => {
        const value = (a?.value as string) ?? (params.layout === "rings" ? "treemap" : "rings");
        setParam({ layout: value as PlaygroundParams["layout"] });
        return `layout = ${value}`;
      },
    },
    { id: "layout_rings", title: "Switch to the rings layout", keys: ["r"], run: () => (setParam({ layout: "rings" as PlaygroundParams["layout"] }), "layout = rings") },
    { id: "layout_treemap", title: "Switch to the treemap layout", keys: ["t"], run: () => (setParam({ layout: "treemap" as PlaygroundParams["layout"] }), "layout = treemap") },
    {
      id: "set_source",
      title: "Set the data source",
      inputSchema: enumSchema(SOURCES),
      run: (a) => {
        const value = a?.value as string;
        if (!SOURCES.includes(value)) return `unknown source: ${value}`;
        setParam({ source: value as PlaygroundParams["source"] });
        return `source = ${value}`;
      },
    },
    {
      id: "set_weight",
      title: "Set the cell weight metric (loc or complexity)",
      inputSchema: enumSchema(["loc", "complexity"]),
      run: (a) => {
        const value = (a?.value as string) ?? "loc";
        setParam({ weight: value as PlaygroundParams["weight"] });
        return `weight = ${value}`;
      },
    },
    toggle("showEdges", "Toggle dependency edges", ["e"]),
    toggle("dark", "Toggle dark mode", ["d"]),
    toggle("groupByService", "Toggle grouping by service", ["g"]),
    {
      id: "search_nodes",
      title: "Find nodes whose id or label matches a query",
      inputSchema: {
        type: "object",
        properties: { query: { type: "string" } },
        required: ["query"],
      },
      run: (a) => {
        const hits = ctx.searchNodes(String(a?.query ?? "")).slice(0, 20);
        return hits.length ? hits : "no matches";
      },
    },
    {
      id: "focus_node",
      title: "Select and frame a node by its id",
      inputSchema: {
        type: "object",
        properties: { id: { type: "string" } },
        required: ["id"],
      },
      run: (a) => {
        const id = String(a?.id ?? "");
        ctx.focusNode(id);
        return `focused ${id}`;
      },
    },
    {
      id: "toggle_experimental",
      title: "Toggle experimental viz features",
      keys: ["x"],
      run: () => {
        ctx.toggleExperimental();
        return `experimental = ${!ctx.experimental}`;
      },
    },
  ];

  if (ctx.history?.active) {
    const h = ctx.history;
    commands.push(
      { id: "prev_commit", title: "Go to the previous commit", keys: ["["], run: () => (h.go(h.index - 1), `commit ${Math.max(0, h.index - 1)}`) },
      { id: "next_commit", title: "Go to the next commit", keys: ["]"], run: () => (h.go(h.index + 1), `commit ${Math.min(h.count - 1, h.index + 1)}`) },
      {
        id: "goto_commit",
        title: "Go to a commit by index",
        inputSchema: { type: "object", properties: { index: { type: "number" } }, required: ["index"] },
        run: (a) => { const i = Number(a?.index ?? 0); h.go(i); return `commit ${i}`; },
      },
    );
  }

  return commands;
}
