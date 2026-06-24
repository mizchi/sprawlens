import { describe, expect, it } from "vitest";
import type { TraceMeta } from "@sprawlens/schema";
import { mergeTraceMeta } from "./traceRecent.ts";

const meta = (id: string): TraceMeta => ({
  id,
  capturedAt: 0,
  label: `${id}.cpuprofile`,
  stepCount: 1,
  planes: [],
});

describe("mergeTraceMeta", () => {
  it("prepends a new capture (newest first)", () => {
    const out = mergeTraceMeta([meta("a")], meta("b"));
    expect(out.map((m) => m.id)).toEqual(["b", "a"]);
  });

  it("replaces an existing id in place at the front (no duplicate)", () => {
    const out = mergeTraceMeta([meta("b"), meta("a")], meta("a"));
    expect(out.map((m) => m.id)).toEqual(["a", "b"]);
  });

  it("caps the list at max, dropping the oldest", () => {
    const list = [meta("c"), meta("b"), meta("a")];
    const out = mergeTraceMeta(list, meta("d"), 3);
    expect(out.map((m) => m.id)).toEqual(["d", "c", "b"]);
  });
});
