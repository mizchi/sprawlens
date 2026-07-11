import { runDeltaLayoutBenchmark } from "../packages/layout/src/index.ts";
import {
  benchmarkBatchToCsv,
  benchmarkResultToCsv,
  loadCodesprawlBenchmarkCases,
  parseBenchmarkArgs,
  runRepositoryBenchmarkBatch,
} from "../packages/cli/src/deltaBenchmarkDataset.ts";

const HELP = `Usage: benchmark-delta-layout [options]

  --codesprawl <repo-or-dir>  load snapshots; repeat for a repository-level batch
  --seeds <n,n,...>           paired deterministic seeds (default: 3,7,11,17,29)
  --stable-swap-passes <n,..> exploratory swap budgets, must include 8
  --format <json|csv>         output format (default: json)
  --grouping <kind>           module, directory, or repository (default: module)
  --directory-depth <n>       directory grouping depth (default: 2)
  --min-nodes <n>             smallest grouping case (default: 3)
  --max-nodes <n>             largest grouping case (default: 80)
`;

async function main(): Promise<void> {
  const options = parseBenchmarkArgs(process.argv.slice(2));
  if (options.help) {
    process.stdout.write(HELP);
    return;
  }
  const datasets = await Promise.all(
    options.codesprawl.map((path) => loadCodesprawlBenchmarkCases(path, options)),
  );
  if (datasets.length > 0) {
    const batch = runRepositoryBenchmarkBatch(datasets, {
      ...(options.seeds ? { seeds: options.seeds } : {}),
      ...(options.stableSwapPasses ? { stableSwapPasses: options.stableSwapPasses } : {}),
    });
    process.stdout.write(
      options.format === "csv" ? benchmarkBatchToCsv(batch) : `${JSON.stringify(batch, null, 2)}\n`,
    );
    return;
  }
  const result = runDeltaLayoutBenchmark({
    ...(options.seeds ? { seeds: options.seeds } : {}),
    ...(options.stableSwapPasses ? { stableSwapPasses: options.stableSwapPasses } : {}),
  });
  process.stdout.write(
    options.format === "csv"
      ? benchmarkResultToCsv(result)
      : `${JSON.stringify(result, null, 2)}\n`,
  );
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
