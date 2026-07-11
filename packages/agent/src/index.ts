/**
 * `@sprawlens/agent` — the renderer-independent command core for AI agents. A
 * pure intent layer over AtlasGraph: `applyIntent(index, view, intent)` advances
 * the versioned ViewState or answers a graph query. Composition roots render
 * that state through `@sprawlens/viz/headless`, the same scene path as the app.
 */
export * from "./viewState.ts";
export * from "./intent.ts";
export * from "./graphQuery.ts";
export * from "./applyIntent.ts";
export * from "./renderLens.ts";
export * from "./toolSpecs.ts";
export * from "./chat.ts";
