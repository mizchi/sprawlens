import type {
  ExternalLayoutBaselineRequestV1,
  ExternalLayoutSequenceRequestV2,
} from "@sprawlens/schema";
import {
  runStableVoronoiAdapterRequest,
  runStableVoronoiSequenceAdapterRequest,
} from "../packages/cli/src/stableVoronoiExternalAdapter.ts";

let input = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk: string) => {
  input += chunk;
});
process.stdin.on("end", () => {
  const request = JSON.parse(input) as
    | ExternalLayoutBaselineRequestV1
    | ExternalLayoutSequenceRequestV2;
  const response =
    request.schemaVersion === 2
      ? runStableVoronoiSequenceAdapterRequest(request)
      : runStableVoronoiAdapterRequest(request);
  process.stdout.write(JSON.stringify(response));
});
