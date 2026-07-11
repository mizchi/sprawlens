import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { parseRepositoryEvaluationManifest } from "../packages/cli/src/repositoryEvaluationManifest.ts";

const path = resolve(process.argv[2] ?? "research/repository-evaluation-manifest.json");
const manifest = parseRepositoryEvaluationManifest(JSON.parse(await readFile(path, "utf8")));
const counts = Object.fromEntries(
  manifest.selectionProtocol.languages.map((language) => [
    language,
    Object.fromEntries(
      ["small", "medium", "large"].map((sizeBand) => [
        sizeBand,
        manifest.repositories.filter(
          (repository) => repository.language === language && repository.sizeBand === sizeBand,
        ).length,
      ]),
    ),
  ]),
);
process.stdout.write(
  `${JSON.stringify(
    {
      status: "valid",
      path,
      frozenAt: manifest.frozenAt,
      repositories: manifest.repositories.length,
      counts,
      benchmark: manifest.selectionProtocol.benchmark,
    },
    null,
    2,
  )}\n`,
);
