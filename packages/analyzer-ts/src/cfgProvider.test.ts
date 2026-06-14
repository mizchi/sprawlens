import { describe, expect, it } from "vitest";
import { extractCfg } from "./cfgProvider.js";

const adjacency = (graph: { edges: { source: string; target: string }[] }) => {
  const out = new Map<string, string[]>();
  for (const edge of graph.edges) {
    const list = out.get(edge.source);
    if (list) list.push(edge.target);
    else out.set(edge.source, [edge.target]);
  }
  return out;
};

describe("extractCfg", () => {
  it("builds entry → block → exit for a straight-line function", () => {
    const graph = extractCfg(
      ["function f() {", "  const a = 1;", "  const b = 2;", "}"].join("\n"),
      1,
    )!;
    expect(graph).not.toBeNull();
    const entry = graph.nodes.find((n) => n.label === "entry")!;
    const exit = graph.nodes.find((n) => n.label === "exit")!;
    expect(entry).toBeDefined();
    expect(exit).toBeDefined();
    // one simple block absorbing both statements
    const body = graph.nodes.find((n) => n.label !== "entry" && n.label !== "exit")!;
    expect(body.metrics.loc).toBe(2);
    expect(graph.edges).toEqual([
      { source: entry.id, target: body.id, kind: "flow" },
      { source: body.id, target: exit.id, kind: "flow" },
    ]);
    expect(graph.nodes.every((n) => n.kind === "block")).toBe(true);
  });

  it("branches an if/else and reconverges", () => {
    const graph = extractCfg(
      [
        "function f(x: number) {",
        "  if (x > 0) {",
        "    doA();",
        "  } else {",
        "    doB();",
        "  }",
        "  done();",
        "}",
      ].join("\n"),
      1,
    )!;
    const cond = graph.nodes.find((n) => n.label.startsWith("if"))!;
    expect(cond.label).toContain("x > 0");
    const out = adjacency(graph).get(cond.id)!;
    expect(out).toHaveLength(2); // then / else
    // both branches flow into the trailing block
    const trailing = graph.nodes.find((n) => n.label === "done();")
      ?? graph.nodes.find((n) => graph.edges.filter((e) => e.target === n.id).length === 2)!;
    const intoTrailing = graph.edges.filter((e) => e.target === trailing.id);
    expect(intoTrailing).toHaveLength(2);
  });

  it("loops back to the head of a for", () => {
    const graph = extractCfg(
      [
        "function f(items: string[]) {",
        "  for (const item of items) {",
        "    use(item);",
        "  }",
        "  done();",
        "}",
      ].join("\n"),
      1,
    )!;
    const head = graph.nodes.find((n) => n.label.startsWith("for"))!;
    // body → head back edge exists
    const intoHead = graph.edges.filter((e) => e.target === head.id);
    expect(intoHead.length).toBeGreaterThanOrEqual(2); // entry-side + back edge
  });

  it("keeps every return as its own terminal", () => {
    const graph = extractCfg(
      [
        "function f(x: number) {",
        "  if (x < 0) {",
        "    return null;",
        "  }",
        "  work();",
        "  return x;",
        "}",
      ].join("\n"),
      1,
    )!;
    const returns = graph.nodes.filter((n) => n.label.startsWith("return"));
    expect(returns.length).toBe(2);
    // terminals have no outgoing edges; with all paths returning there is
    // no shared exit funnel
    for (const ret of returns) {
      expect(graph.edges.some((e) => e.source === ret.id)).toBe(false);
    }
    expect(graph.nodes.some((n) => n.label === "exit")).toBe(false);
  });

  it("records callee names per block for edge anchoring", () => {
    const graph = extractCfg(
      [
        "function f(items: string[]) {",
        "  prepare();",
        "  for (const item of iterate(items)) {",
        "    if (isReady(item)) {",
        "      use(item);",
        "    }",
        "  }",
        "}",
      ].join("\n"),
      1,
    )!;
    const callsOf = (label: string) =>
      graph.calls![graph.nodes.find((n) => n.label.startsWith(label))!.id] ??
      [];
    expect(callsOf("prepare")).toContain("prepare");
    expect(callsOf("for")).toContain("iterate");
    expect(callsOf("if isReady")).toContain("isReady");
    expect(callsOf("use(item)")).toContain("use");
  });

  it("flags external effects: out-of-scope writes, await, fetch", () => {
    const graph = extractCfg(
      [
        "let total = 0;",
        "async function f(acc: { count: number }, url: string) {",
        "  let local = 0;",
        "  local = 1;",
        "  total += 2;",
        "  acc.count = 3;",
        "  const data = await fetch(url);",
        "  return data;",
        "}",
      ].join("\n"),
      2,
    )!;
    const all = Object.values(graph.effects!).flat();
    expect(all).toContain("assigns total");
    expect(all).toContain("mutates acc");
    expect(all).toContain("await");
    expect(all).toContain("fetch");
    // local rebinding is not an effect
    expect(all).not.toContain("assigns local");
  });

  it("draws recursion as an edge back to the entry", () => {
    const graph = extractCfg(
      [
        "function fib(n: number): number {",
        "  if (n <= 1) {",
        "    return n;",
        "  }",
        "  return fib(n - 1) + fib(n - 2);",
        "}",
      ].join("\n"),
      1,
    )!;
    const recursive = graph.edges.filter((e) => e.target === "b-entry");
    expect(recursive).toHaveLength(1);
    const source = graph.nodes.find((n) => n.id === recursive[0]!.source)!;
    expect(source.label).toContain("fib(n - 1)");
  });

  it("fans a switch out per clause", () => {
    const graph = extractCfg(
      [
        "function f(k: string) {",
        "  switch (k) {",
        "    case 'a':",
        "      a();",
        "      break;",
        "    case 'b':",
        "      b();",
        "      break;",
        "    default:",
        "      c();",
        "  }",
        "}",
      ].join("\n"),
      1,
    )!;
    const head = graph.nodes.find((n) => n.label.startsWith("switch"))!;
    expect(adjacency(graph).get(head.id)!.length).toBe(3);
  });

  it("finds methods and arrow functions by their start line", () => {
    const source = [
      "export const f = (x: number) => {",
      "  return x + 1;",
      "};",
      "class C {",
      "  method() {",
      "    if (this.ok) {",
      "      go();",
      "    }",
      "  }",
      "}",
    ].join("\n");
    expect(extractCfg(source, 1)).not.toBeNull();
    const method = extractCfg(source, 5)!;
    expect(method.nodes.some((n) => n.label.startsWith("if"))).toBe(true);
  });

  it("returns null when no function starts near the line", () => {
    expect(extractCfg("const x = 1;\n", 1)).toBeNull();
  });

  it("is deterministic: ids are stable for the same source", () => {
    const source = "function f() {\n  if (a) { b(); }\n}\n";
    expect(extractCfg(source, 1)).toEqual(extractCfg(source, 1));
  });

  it("emits code-shaped grid hints", () => {
    const graph = extractCfg(
      [
        "function f(items: string[], x: number) {",
        "  if (x > 0) {",
        "    doA();",
        "  } else {",
        "    doB();",
        "  }",
        "  for (const item of items) {",
        "    if (!item) {",
        "      continue;",
        "    }",
        "    use(item);",
        "  }",
        "  return x;",
        "}",
      ].join("\n"),
      1,
    )!;
    const grid = graph.grid!;
    const at = (label: string) =>
      grid[graph.nodes.find((n) => n.label.startsWith(label))!.id]!;
    // main path stays on the spine column
    expect(at("entry").col).toBe(0);
    expect(at("if x > 0").col).toBe(0);
    expect(at("for").col).toBe(0);
    expect(at("return").col).toBe(0);
    // then keeps the column, else moves right
    expect(at("doA").col).toBe(0);
    expect(at("doB").col).toBe(1);
    // loop body indents like the source text
    expect(at("if !item").col).toBe(1);
    expect(at("continue").col).toBe(1);
    // rows advance downward along the main path
    expect(at("if x > 0").row).toBeLessThan(at("for").row);
    expect(at("for").row).toBeLessThan(at("return").row);
  });

  it("routes continue back to the loop head and break out of it", () => {
    const graph = extractCfg(
      [
        "function f(items: string[]) {",
        "  for (const item of items) {",
        "    if (item === 'stop') {",
        "      break;",
        "    }",
        "    if (!item) {",
        "      continue;",
        "    }",
        "    use(item);",
        "  }",
        "  done();",
        "}",
      ].join("\n"),
      1,
    )!;
    const head = graph.nodes.find((n) => n.label.startsWith("for"))!;
    const cont = graph.nodes.find((n) => n.label === "continue")!;
    const brk = graph.nodes.find((n) => n.label === "break")!;
    const done = graph.nodes.find((n) => n.label === "done();")!;
    expect(
      graph.edges.some((e) => e.source === cont.id && e.target === head.id),
    ).toBe(true);
    expect(
      graph.edges.some((e) => e.source === brk.id && e.target === done.id),
    ).toBe(true);
    // break must NOT flow back to the head
    expect(
      graph.edges.some((e) => e.source === brk.id && e.target === head.id),
    ).toBe(false);
  });
});
