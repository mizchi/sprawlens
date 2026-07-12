import { describe, expect, it } from "vitest";
import { renderAstDiffAnnotationPacket } from "./astDiffAnnotationPacket.ts";

describe("renderAstDiffAnnotationPacket", () => {
  it("renders semantic after-symbol candidates without diff predictions", () => {
    const output = renderAstDiffAnnotationPacket(
      {
        id: "service-edit",
        language: "typescript",
        repository: "example/repo",
        beforeRevision: "a".repeat(40),
        afterRevision: "b".repeat(40),
        file: "src/service.ts",
        changeKinds: ["body-edit"],
      },
      [
        {
          id: "symbol:src/service.ts:class:Service:1",
          name: "Service",
          kind: "class",
          startLine: 1,
          endLine: 8,
          loc: 3,
        },
        {
          id: "symbol:src/service.ts:method:Service.run:2",
          name: "run",
          kind: "method",
          startLine: 2,
          endLine: 4,
          loc: 3,
          parentClass: "symbol:src/service.ts:class:Service:1",
        },
      ],
      "@@ -3 +3 @@\n- return 1\n+ return 2\n",
    );

    expect(output).toContain("Blind annotation packet");
    expect(output).toContain('"kind":"method","name":"run","parent"');
    expect(output).toContain("lines 2–4");
    expect(output).toContain("@@ -3 +3 @@");
    expect(output).not.toMatch(/predicted|precision|fingerprint/i);
  });

  it("labels non-blind extraction follow-ups as post-hoc", () => {
    const output = renderAstDiffAnnotationPacket(
      {
        id: "follow-up",
        language: "typescript",
        repository: "example/repo",
        beforeRevision: "a".repeat(40),
        afterRevision: "b".repeat(40),
        file: "src/a.ts",
        changeKinds: ["extraction-v2"],
      },
      [],
      "",
      { predictionBlind: false },
    );
    expect(output).toContain("Post-hoc annotation packet");
    expect(output).not.toContain("Blind annotation packet");
  });
});
