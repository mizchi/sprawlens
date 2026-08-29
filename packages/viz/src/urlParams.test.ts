import { describe, expect, it } from "vitest";
import { makeUrlParamParsers } from "./urlParams.ts";

describe("makeUrlParamParsers", () => {
  it("keeps the remote repo query as a plain URL value", () => {
    const parsers = makeUrlParamParsers(false);
    expect(parsers.repo.parse("mizchi/sprawlens")).toBe("mizchi/sprawlens");
    expect(parsers.repo.serialize("mizchi/sprawlens")).toBe("mizchi/sprawlens");
    expect(parsers.repo.eq("", parsers.repo.default)).toBe(true);
  });

  it("keeps trace extraction off unless the URL opts in", () => {
    const parsers = makeUrlParamParsers(false);
    expect(parsers.traceExtract.parse(null)).toBe(false);
    expect(parsers.traceExtract.parse("true")).toBe(true);
    expect(parsers.traceExtract.eq(false, parsers.traceExtract.default)).toBe(true);
  });

  it("enables stable history independently from the general experimental flag", () => {
    const parsers = makeUrlParamParsers(false);
    expect(parsers.stableLayout.parse(null)).toBe(true);
    expect(parsers.stableLayout.parse("true")).toBe(true);
    expect(parsers.stableLayout.parse("false")).toBe(false);
    expect(parsers.stableLayout.eq(true, parsers.stableLayout.default)).toBe(true);
  });
});
