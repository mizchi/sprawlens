import { describe, expect, it } from "vitest";
import { encodeMessage, JsonRpcReader } from "./jsonRpc.js";

describe("encodeMessage", () => {
  it("frames a message with a Content-Length header", () => {
    const buffer = encodeMessage({ jsonrpc: "2.0", id: 1, method: "x" });
    const text = buffer.toString("utf8");
    const body = JSON.stringify({ jsonrpc: "2.0", id: 1, method: "x" });
    expect(text).toBe(`Content-Length: ${Buffer.byteLength(body)}\r\n\r\n${body}`);
  });

  it("counts bytes, not code units, for multibyte payloads", () => {
    const buffer = encodeMessage({ jsonrpc: "2.0", method: "メソッド" });
    const headerEnd = buffer.indexOf("\r\n\r\n");
    const declared = Number(
      buffer
        .subarray(0, headerEnd)
        .toString()
        .match(/Content-Length: (\d+)/)![1],
    );
    expect(declared).toBe(buffer.length - headerEnd - 4);
  });
});

describe("JsonRpcReader", () => {
  it("parses a single framed message", () => {
    const messages: unknown[] = [];
    const reader = new JsonRpcReader((m) => messages.push(m));
    reader.push(encodeMessage({ jsonrpc: "2.0", id: 1, result: 42 }));
    expect(messages).toEqual([{ jsonrpc: "2.0", id: 1, result: 42 }]);
  });

  it("handles messages split across chunks and concatenated together", () => {
    const messages: unknown[] = [];
    const reader = new JsonRpcReader((m) => messages.push(m));
    const a = encodeMessage({ jsonrpc: "2.0", id: 1, result: "a" });
    const b = encodeMessage({ jsonrpc: "2.0", id: 2, result: "b" });
    const joined = Buffer.concat([a, b]);
    // feed in awkward chunk sizes
    reader.push(joined.subarray(0, 10));
    reader.push(joined.subarray(10, a.length + 5));
    reader.push(joined.subarray(a.length + 5));
    expect(messages).toEqual([
      { jsonrpc: "2.0", id: 1, result: "a" },
      { jsonrpc: "2.0", id: 2, result: "b" },
    ]);
  });

  it("survives multibyte content split mid-character", () => {
    const messages: unknown[] = [];
    const reader = new JsonRpcReader((m) => messages.push(m));
    const framed = encodeMessage({ jsonrpc: "2.0", result: "日本語テスト" });
    const mid = framed.length - 8; // inside the multibyte tail
    reader.push(framed.subarray(0, mid));
    reader.push(framed.subarray(mid));
    expect(messages).toEqual([{ jsonrpc: "2.0", result: "日本語テスト" }]);
  });
});
