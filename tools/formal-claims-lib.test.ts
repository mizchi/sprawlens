import { describe, expect, it } from "vitest";
import {
  buildLeanAuditSource,
  findUnsafeProofPlaceholders,
  parseLeanModules,
  resolveClaimTheorems,
  validateClaimsLedger,
} from "./formal-claims-lib.mjs";

describe("formal claims ledger", () => {
  it("parses one or more Lean modules from the ledger notation", () => {
    expect(parseLeanModules("Sprawlens.ConvexClipArea")).toEqual(["Sprawlens.ConvexClipArea"]);
    expect(
      parseLeanModules(
        "Sprawlens.OrderedTriples, Sprawlens.HalfPlaneClipFold, Sprawlens.CyclicClosure, and Sprawlens.HalfPlaneClipRing",
      ),
    ).toEqual([
      "Sprawlens.OrderedTriples",
      "Sprawlens.HalfPlaneClipFold",
      "Sprawlens.CyclicClosure",
      "Sprawlens.HalfPlaneClipRing",
    ]);
  });

  it("rejects duplicate claim identifiers", () => {
    expect(() =>
      validateClaimsLedger({
        schemaVersion: 1,
        claims: [
          { id: "duplicate", leanModule: "Sprawlens.One", theorems: ["first"] },
          { id: "duplicate", leanModule: "Sprawlens.Two", theorems: ["second"] },
        ],
      }),
    ).toThrow(/duplicate claim id: duplicate/);
  });

  it("resolves each theorem to exactly one declared module", () => {
    const resolved = resolveClaimTheorems(
      {
        claims: [
          {
            id: "sample",
            leanModule: "Sprawlens.One and Sprawlens.Two",
            theorems: ["plain", "Nested.fact"],
          },
        ],
      },
      new Map([
        ["Sprawlens.One", "namespace Sprawlens.One\ntheorem plain : True := by trivial\n"],
        ["Sprawlens.Two", "namespace Sprawlens.Two\ntheorem Nested.fact : True := by trivial\n"],
      ]),
    );

    expect(resolved).toEqual(["Sprawlens.One.plain", "Sprawlens.Two.Nested.fact"]);
    expect(buildLeanAuditSource(resolved)).toMatch(/#check Sprawlens\.Two\.Nested\.fact/);
  });

  it("rejects missing and ambiguous theorem declarations", () => {
    const ledger = {
      claims: [
        {
          id: "sample",
          leanModule: "Sprawlens.One and Sprawlens.Two",
          theorems: ["fact"],
        },
      ],
    };
    expect(() =>
      resolveClaimTheorems(
        ledger,
        new Map([
          ["Sprawlens.One", "namespace Sprawlens.One\n"],
          ["Sprawlens.Two", "namespace Sprawlens.Two\n"],
        ]),
      ),
    ).toThrow(/theorem not declared.*fact/);
    expect(() =>
      resolveClaimTheorems(
        ledger,
        new Map([
          ["Sprawlens.One", "theorem fact : True := by trivial\n"],
          ["Sprawlens.Two", "theorem fact : True := by trivial\n"],
        ]),
      ),
    ).toThrow(/theorem is ambiguous.*fact/);
  });

  it("finds sorry, admit, and axiom placeholders outside line comments", () => {
    expect(
      findUnsafeProofPlaceholders(
        new Map([
          [
            "Sprawlens.Sample",
            [
              "-- sorry in an explanation is harmless",
              "theorem unfinished : True := by sorry",
              "theorem alsoUnfinished : True := by admit",
              "axiom assumed : True",
            ].join("\n"),
          ],
        ]),
      ),
    ).toEqual([
      "Sprawlens.Sample:2: sorry",
      "Sprawlens.Sample:3: admit",
      "Sprawlens.Sample:4: axiom",
    ]);
  });
});
