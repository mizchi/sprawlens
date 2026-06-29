import { describe, expect, it } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import type { AtlasGraph } from "@sprawlens/schema";
import { indexGraph } from "@sprawlens/agent";
import { createServer } from "./index.ts";

const file = (id: string) => ({
  id,
  kind: "file" as const,
  label: id.split("/").pop()!,
  metrics: { loc: 10 },
});
const graph: AtlasGraph = {
  nodes: [file("src/app/main.ts"), file("src/core/lib.ts"), file("src/db/store.ts")],
  edges: [
    { source: "src/app/main.ts", target: "src/core/lib.ts" },
    { source: "src/core/lib.ts", target: "src/db/store.ts" },
  ],
};

type ToolCallResult = { content?: { type: string; text?: string }[]; isError?: boolean };

async function connect() {
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await createServer(indexGraph(graph)).connect(serverTransport);
  const client = new Client({ name: "test", version: "0.0.0" });
  await client.connect(clientTransport);
  const call = (name: string, args: Record<string, unknown> = {}) =>
    client.callTool({ name, arguments: args }) as Promise<ToolCallResult>;
  return { client, call };
}

const textOf = (res: ToolCallResult): string => res.content?.[0]?.text ?? "";

describe("MCP server (in-memory roundtrip)", () => {
  it("lists the agent tools over the protocol", async () => {
    const { client } = await connect();
    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name)).toEqual(
      expect.arrayContaining(["dependencies", "impact", "find", "focus", "get_view"]),
    );
  });

  it("answers a query tool call with data text", async () => {
    const { call } = await connect();
    const text = textOf(await call("impact", { target: "src/db/store.ts" }));
    expect(text).toContain("affects 2");
    expect(text).toContain("src/app/main.ts");
  });

  it("carries view state across navigation calls", async () => {
    const { call } = await connect();
    await call("focus", { target: "src/core/lib.ts" });
    expect(textOf(await call("get_view"))).toContain("src/core/lib.ts");
  });

  it("returns an error result for a bad target", async () => {
    const { call } = await connect();
    const res = await call("describe", { target: "ghost" });
    expect(res.isError).toBe(true);
    expect(textOf(res)).toContain("unknown target");
  });
});
