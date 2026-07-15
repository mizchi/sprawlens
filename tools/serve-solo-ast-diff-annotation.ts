import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { SoloAstDiffAnnotationSheet } from "../packages/viz/src/astDiffSoloAnnotation.ts";
import { createSoloAstDiffAnnotationServer } from "./solo-ast-diff-annotation-server.ts";

const passId = passOption("--pass", "A");
const port = integerOption("--port", 4317);
const host = "127.0.0.1";
const sheetPath = resolve(
  option("--sheet", `research/ast-diff-confirmatory-v2-solo-pass-${passId.toLowerCase()}.json`),
);
const packetDirectory = resolve(
  option(
    "--packets",
    `research/annotation-packets/ast-diff-confirmatory-v2-solo/pass-${passId.toLowerCase()}`,
  ),
);
const sheet = JSON.parse(await readFile(sheetPath, "utf8")) as SoloAstDiffAnnotationSheet;
if (sheet.passId !== passId) {
  throw new Error(`requested pass ${passId}, but working sheet contains pass ${sheet.passId}`);
}

const server = createSoloAstDiffAnnotationServer({ sheetPath, packetDirectory });
server.listen(port, host, () => {
  process.stdout.write(
    `AST diff blind annotation Pass ${passId}: http://${host}:${port}\n` +
      `Working sheet: ${sheetPath}\n` +
      "Press Ctrl+C to stop.\n",
  );
});

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.once(signal, () => {
    server.close((error) => {
      if (error) {
        process.stderr.write(`${error.stack ?? error.message}\n`);
        process.exitCode = 1;
      }
    });
  });
}

function option(name: string, fallback: string): string {
  const index = process.argv.indexOf(name);
  return index === -1 ? fallback : (process.argv[index + 1] ?? fallback);
}

function integerOption(name: string, fallback: number): number {
  const value = Number.parseInt(option(name, String(fallback)), 10);
  if (!Number.isInteger(value) || value < 1 || value > 65_535) {
    throw new Error(`${name} must be an integer between 1 and 65535`);
  }
  return value;
}

function passOption(name: string, fallback: "A" | "B"): "A" | "B" {
  const value = option(name, fallback).toUpperCase();
  if (value !== "A" && value !== "B") throw new Error(`${name} must be A or B`);
  return value;
}
