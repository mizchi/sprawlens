import { describe, expect, it } from "vitest";
import type { AtlasGraph } from "@sprawlens/schema";
import {
  runChatTurn,
  type LlmClient,
  type LlmMessage,
  type LlmTool,
  type LlmToolCall,
} from "./chat.ts";
import { indexGraph } from "./graphQuery.ts";
import { initialView } from "./viewState.ts";

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
const idx = indexGraph(graph);

type Turn = { text?: string; toolCalls?: LlmToolCall[] };
class MockLlm implements LlmClient {
  calls: { messages: LlmMessage[]; tools: LlmTool[] }[] = [];
  constructor(private script: Turn[]) {}
  complete(messages: LlmMessage[], tools: LlmTool[]): Promise<Turn> {
    this.calls.push({ messages, tools });
    return Promise.resolve(this.script.shift() ?? { text: "(done)" });
  }
}
const call = (name: string, args: Record<string, unknown>): LlmToolCall => ({
  id: "c1",
  name,
  args,
});

describe("runChatTurn", () => {
  it("runs a query tool then replies, feeding the data back to the model", async () => {
    const llm = new MockLlm([
      { toolCalls: [call("impact", { target: "src/db/store.ts" })] },
      { text: "Two files depend on it." },
    ]);
    const { reply, view, steps } = await runChatTurn(
      idx,
      initialView,
      "what breaks if I change store?",
      llm,
    );
    expect(reply).toBe("Two files depend on it.");
    expect(steps.map((s) => s.tool)).toEqual(["impact"]);
    expect(view).toEqual(initialView); // a query doesn't move the view
    // the model's second call must include the tool result it can read
    const second = llm.calls[1]!.messages;
    expect(second.some((m) => m.role === "tool" && m.content.includes("affects 2"))).toBe(true);
  });

  it("advances the view on a navigation tool", async () => {
    const llm = new MockLlm([
      { toolCalls: [call("focus", { target: "src/core/lib.ts" })] },
      { text: "Focused lib." },
    ]);
    const { view } = await runChatTurn(idx, initialView, "show me lib", llm);
    expect(view.selection).toEqual(["src/core/lib.ts"]);
    expect(view.camera.target).toBe("src/core/lib.ts");
  });

  it("advertises the intent tools to the model", async () => {
    const llm = new MockLlm([{ text: "hi" }]);
    await runChatTurn(idx, initialView, "hello", llm);
    const names = llm.calls[0]!.tools.map((t) => t.name);
    expect(names).toEqual(
      expect.arrayContaining(["dependencies", "impact", "find", "focus", "set_layout"]),
    );
  });

  it("handles an unknown tool name without crashing", async () => {
    const llm = new MockLlm([{ toolCalls: [call("bogus", {})] }, { text: "recovered" }]);
    const { reply } = await runChatTurn(idx, initialView, "do something weird", llm);
    expect(reply).toBe("recovered");
    expect(
      llm.calls[1]!.messages.some((m) => m.role === "tool" && m.content.includes("unknown tool")),
    ).toBe(true);
  });

  it("forces a final answer when the step budget is exhausted", async () => {
    // always asks for a tool; maxSteps=1 means one tool round, then a final no-tool call
    const llm = new MockLlm([
      { toolCalls: [call("find", { query: "lib" })] },
      { text: "Here's my best answer." },
    ]);
    const { reply } = await runChatTurn(idx, initialView, "loop forever", llm, { maxSteps: 1 });
    expect(reply).toBe("Here's my best answer.");
    expect(llm.calls[1]!.tools).toEqual([]); // final call offers no tools
  });
});
