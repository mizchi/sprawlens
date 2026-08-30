import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { promisify } from "node:util";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import {
  GIT_PAPER_ASPECT_RATIO_ABSOLUTE_TOLERANCE,
  assessGitPaperAspectRatio,
  meanGitRectangleAspectRatio,
  meanOfGitRevisionAspectRatioMeans,
  publishedGitAspectRatio,
} from "../packages/cli/src/gitPaperAspectRatio.ts";
import {
  GIT_AUTHOR_REVISION,
  prepareGitAuthorJavaClasses,
} from "../packages/cli/src/gitAuthorExternalAdapter.ts";

const SUPPLEMENT_REVISION = "3c9dd8ffb84dd8227bf6bbe87b0d950d308d5491";
const DATASET = "standard";
const CANVAS_SIZE = 1_000;
const EXPECTED_REVISION_COUNT = 29;
const EXPECTED_OBSERVATION_COUNT = 203;
const PAPER_DOI = "10.1109/SIBGRAPI.2018.00027";
const execFileAsync = promisify(execFile);

const authorRoot = process.argv[2];
const supplementRoot = process.argv[3];
if (!authorRoot || !supplementRoot) {
  throw new Error(
    "usage: reproduce-git-paper-aspect-ratio.ts <author-root> <supplement-root> [java-home] [xvfb-run] [output]",
  );
}
const javaHome = process.argv[4] ?? "";
const xvfbRun = process.argv[5] ?? "";
const outputPath = process.argv[6] ?? "";

const sha256 = (value: string | Buffer): string => createHash("sha256").update(value).digest("hex");

async function assertFixedCheckout(root: string, expectedRevision: string): Promise<void> {
  const { stdout: revision } = await execFileAsync("git", ["rev-parse", "HEAD"], { cwd: root });
  if (revision.trim() !== expectedRevision) {
    throw new Error(`checkout revision ${revision.trim()} does not match ${expectedRevision}`);
  }
  const { stdout: status } = await execFileAsync(
    "git",
    ["status", "--porcelain", "--untracked-files=no"],
    { cwd: root },
  );
  if (status.trim().length > 0)
    throw new Error(`fixed checkout has modified tracked files: ${root}`);
}

function orderedDatasetFiles(datasetRoot: string): string[] {
  return readdirSync(datasetRoot)
    .filter((name) => statSync(join(datasetRoot, name)).isFile())
    .sort(
      (left, right) => left.length - right.length || (left < right ? -1 : left > right ? 1 : 0),
    );
}

await assertFixedCheckout(supplementRoot, SUPPLEMENT_REVISION);
const datasetRoot = join(supplementRoot, "datasets", DATASET);
const tablePath = join(supplementRoot, "figures", "Tables", "aspectratio.csv");
const tableContents = readFileSync(tablePath, "utf8");
const expected = publishedGitAspectRatio(tableContents, DATASET);
const datasetFiles = orderedDatasetFiles(datasetRoot);
if (datasetFiles.length === 0) throw new Error(`paper dataset is empty: ${DATASET}`);

const workRoot = mkdtempSync(join(tmpdir(), "sprawlens-git-paper-ar-"));
const classesRoot = join(workRoot, "classes");
const rectangleRoot = join(workRoot, "rectangles");
mkdirSync(rectangleRoot);
let rectangleOutputs: string[];
let javaVersion = "";
try {
  await prepareGitAuthorJavaClasses({
    upstreamRoot: authorRoot,
    classesRoot,
    ...(javaHome ? { javacBin: join(javaHome, "bin", "javac") } : {}),
  });
  const javaBin = javaHome ? join(javaHome, "bin", "java") : "java";
  const version = await execFileAsync(javaBin, ["-version"]);
  javaVersion = `${version.stdout}${version.stderr}`.trim();
  const javaArgs = [
    "-cp",
    classesRoot,
    "com.eduardovernier.Main",
    datasetRoot,
    String(CANVAS_SIZE),
    String(CANVAS_SIZE),
    rectangleRoot,
  ];
  if (xvfbRun) await execFileAsync(xvfbRun, ["-a", javaBin, ...javaArgs], { cwd: authorRoot });
  else await execFileAsync(javaBin, javaArgs, { cwd: authorRoot });
  rectangleOutputs = Array.from({ length: datasetFiles.length }, (_, index) =>
    readFileSync(join(rectangleRoot, `t${index}.rect`), "utf8"),
  );
} finally {
  if (!rectangleOutputs!) rmSync(workRoot, { recursive: true, force: true });
}

const observed = meanGitRectangleAspectRatio(rectangleOutputs);
const assessment = assessGitPaperAspectRatio(
  observed.meanAspectRatio,
  expected,
  GIT_PAPER_ASPECT_RATIO_ABSOLUTE_TOLERANCE,
);
const inputCountsMatch =
  observed.revisionCount === EXPECTED_REVISION_COUNT &&
  observed.observationCount === EXPECTED_OBSERVATION_COUNT;
const result = {
  schemaVersion: 1,
  gate: {
    metric: "AR=min(width,height)/max(width,height)",
    aggregation: "arithmetic mean over pooled active leaf-revision observations",
    absoluteTolerance: GIT_PAPER_ASPECT_RATIO_ABSOLUTE_TOLERANCE,
    dataset: DATASET,
    expectedRevisionCount: EXPECTED_REVISION_COUNT,
    expectedObservationCount: EXPECTED_OBSERVATION_COUNT,
    canvas: { width: CANVAS_SIZE, height: CANVAS_SIZE },
    fixedBeforeAuthorExecution: true,
  },
  provenance: {
    paperDoi: PAPER_DOI,
    authorRevision: GIT_AUTHOR_REVISION,
    supplementRevision: SUPPLEMENT_REVISION,
    supplementUrl: "https://github.com/sibgrapi18/treemaps",
    sourceModified: false,
    javaVersion,
    tableSha256: sha256(tableContents),
    datasetSha256: sha256(
      datasetFiles
        .map((name) => `${name}\0${readFileSync(join(datasetRoot, name), "utf8")}`)
        .join("\0"),
    ),
    authorRectanglesSha256: sha256(rectangleOutputs.join("\0")),
  },
  observed,
  diagnostics: {
    equalRevisionMean: meanOfGitRevisionAspectRatioMeans(rectangleOutputs),
    equalRevisionMeanIsPostHoc: true,
  },
  assessment: {
    ...assessment,
    inputCountsMatch,
    passed: assessment.passed && inputCountsMatch,
  },
};

const output = `${JSON.stringify(result, null, 2)}\n`;
if (outputPath) {
  mkdirSync(dirname(resolve(outputPath)), { recursive: true });
  writeFileSync(resolve(outputPath), output, "utf8");
}
rmSync(workRoot, { recursive: true, force: true });
process.stdout.write(output);
if (!assessment.passed || !inputCountsMatch) process.exitCode = 1;
