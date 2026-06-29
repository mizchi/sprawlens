/**
 * `@sprawlens/mcp` — an MCP server that exposes the headless agent core
 * (`@sprawlens/agent`) as tools: query the code graph (dependencies, impact,
 * cycles, find, …) and navigate a headless view. Run via the `sprawlens-mcp`
 * bin; import `createServer` / `Session` to embed it.
 */
export { createServer } from "./server.ts";
export { Session, TOOLS } from "./tools.ts";
