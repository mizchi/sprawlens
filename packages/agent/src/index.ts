/**
 * `@sprawlens/agent` — the headless command core that wraps the visualizer for
 * AI agents. A pure intent layer over the AtlasGraph: `applyIntent(index, view,
 * intent)` advances a ViewState (navigation) or answers a graph query, with no
 * browser. The MCP server and the in-app chat both ride on this.
 */
export * from "./viewState.ts";
export * from "./intent.ts";
export * from "./graphQuery.ts";
export * from "./applyIntent.ts";
