import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { assignChangeLocalizationTasks } from "../packages/viz/src/changeLocalizationStudy.ts";

function option(name: string, fallback: string): string {
  const index = process.argv.indexOf(name);
  return index >= 0 ? (process.argv[index + 1] ?? fallback) : fallback;
}

const casesPath = resolve(option("--cases", "research/ast-diff-confirmatory-v2-candidates.json"));
const outputPath = resolve(
  option("--output", "research/change-localization-study-assignment-preview.json"),
);
const participantSlots = Number.parseInt(option("--participants", "6"), 10);
const tasksPerCondition = Number.parseInt(option("--tasks-per-condition", "2"), 10);
if (!Number.isInteger(participantSlots) || participantSlots < 1) {
  throw new Error("participants must be a positive integer");
}
const candidates = JSON.parse(await readFile(casesPath, "utf8")) as {
  datasetId: string;
  cases: Array<{ id: string }>;
};
const caseIds = candidates.cases.map((item) => item.id);
const assignments = Array.from({ length: participantSlots }, (_, participantIndex) => ({
  participantSlot: participantIndex,
  tasks: assignChangeLocalizationTasks(caseIds, participantIndex, { tasksPerCondition }),
}));
await writeAtomic(
  outputPath,
  `${JSON.stringify(
    {
      schemaVersion: 1,
      status: "assignment preview only; no participants recruited and no study preregistered",
      datasetId: candidates.datasetId,
      participantSlots,
      tasksPerCondition,
      assignments,
    },
    null,
    2,
  )}\n`,
);
process.stdout.write(`generated ${participantSlots} counterbalanced participant slots\n`);

async function writeAtomic(path: string, value: string): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  const temporary = `${path}.tmp`;
  await writeFile(temporary, value);
  await rename(temporary, path);
}
