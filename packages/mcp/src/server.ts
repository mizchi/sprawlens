/**
 * Bridge the tool surface to the MCP SDK's low-level Server: advertise `TOOLS`
 * on list, and run each call through the connection's `Session`. Result data is
 * returned as text (summary + JSON) so any MCP client can read it; errors map to
 * an `isError` tool result rather than throwing.
 */
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import type { GraphIndex } from "@sprawlens/agent";
import { Session, TOOLS } from "./tools.ts";

export function createServer(idx: GraphIndex): Server {
  const session = new Session(idx);
  const server = new Server(
    { name: "sprawlens", version: "0.0.0" },
    { capabilities: { tools: {} } },
  );

  server.setRequestHandler(ListToolsRequestSchema, () => ({ tools: TOOLS }));

  server.setRequestHandler(CallToolRequestSchema, (req) => {
    const result = session.call(
      req.params.name,
      (req.params.arguments ?? {}) as Record<string, unknown>,
    );
    if (result.kind === "error") {
      return { content: [{ type: "text", text: `Error: ${result.message}` }], isError: true };
    }
    // SVG renders come back as an image block (plus the summary) so clients can
    // display the map; other data is summary + JSON text.
    if (
      result.kind === "data" &&
      typeof result.data === "string" &&
      result.data.startsWith("<svg")
    ) {
      return {
        content: [
          { type: "text", text: result.summary },
          {
            type: "image",
            data: Buffer.from(result.data).toString("base64"),
            mimeType: "image/svg+xml",
          },
        ],
      };
    }
    const text =
      result.kind === "data"
        ? `${result.summary}\n\n${JSON.stringify(result.data, null, 2)}`
        : result.summary;
    return { content: [{ type: "text", text }] };
  });

  return server;
}
