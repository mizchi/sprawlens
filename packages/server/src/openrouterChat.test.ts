import { describe, expect, it } from "vitest";
import { fromResponse, toApiMessage, toRequest } from "./openrouterChat.ts";

describe("toApiMessage", () => {
  it("passes system/user through", () => {
    expect(toApiMessage({ role: "user", content: "hi" })).toEqual({ role: "user", content: "hi" });
  });

  it("serializes assistant tool calls to OpenAI function form", () => {
    const m = toApiMessage({
      role: "assistant",
      content: "",
      toolCalls: [{ id: "c1", name: "impact", args: { target: "a.ts" } }],
    });
    expect(m).toEqual({
      role: "assistant",
      content: "",
      tool_calls: [
        {
          id: "c1",
          type: "function",
          function: { name: "impact", arguments: '{"target":"a.ts"}' },
        },
      ],
    });
  });

  it("maps a tool result to tool_call_id", () => {
    expect(toApiMessage({ role: "tool", toolCallId: "c1", name: "impact", content: "2" })).toEqual({
      role: "tool",
      tool_call_id: "c1",
      content: "2",
    });
  });
});

describe("toRequest", () => {
  it("includes tools and tool_choice when tools are given", () => {
    const body = toRequest(
      "m",
      [{ role: "user", content: "hi" }],
      [{ name: "find", description: "d", parameters: { type: "object", properties: {} } }],
    ) as { tools?: unknown[]; tool_choice?: string };
    expect(body.tools).toHaveLength(1);
    expect(body.tool_choice).toBe("auto");
  });

  it("omits tools on the final no-tool call", () => {
    const body = toRequest("m", [{ role: "user", content: "hi" }], []) as { tools?: unknown };
    expect(body.tools).toBeUndefined();
  });
});

describe("fromResponse", () => {
  it("extracts plain text", () => {
    expect(fromResponse({ choices: [{ message: { content: "hello" } }] })).toEqual({
      text: "hello",
      toolCalls: undefined,
    });
  });

  it("parses tool calls with JSON arguments", () => {
    const r = fromResponse({
      choices: [
        {
          message: {
            content: "",
            tool_calls: [{ id: "c1", function: { name: "find", arguments: '{"query":"lib"}' } }],
          },
        },
      ],
    });
    expect(r.toolCalls).toEqual([{ id: "c1", name: "find", args: { query: "lib" } }]);
  });

  it("falls back to empty args on malformed JSON", () => {
    const r = fromResponse({
      choices: [
        { message: { tool_calls: [{ id: "c1", function: { name: "x", arguments: "{bad" } }] } },
      ],
    });
    expect(r.toolCalls?.[0]?.args).toEqual({});
  });
});
