import type { ExternalLayoutBaselineRequestV1 } from "@sprawlens/schema";
import { runStableVoronoiAdapterRequest } from "../packages/cli/src/stableVoronoiExternalAdapter.ts";

let input = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk: string) => {
  input += chunk;
});
process.stdin.on("end", () => {
  const request = JSON.parse(input) as ExternalLayoutBaselineRequestV1;
  process.stdout.write(JSON.stringify(runStableVoronoiAdapterRequest(request)));
});
