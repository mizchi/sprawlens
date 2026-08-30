import type { ExternalLayoutSequenceRequestV2 } from "@sprawlens/schema";
import {
  gitAuthorJavaRuntime,
  runGitAuthorSequenceAdapterRequest,
} from "../packages/cli/src/gitAuthorExternalAdapter.ts";

const upstreamRoot = process.argv[2];
const javaHome = process.argv[3] || undefined;
const classesRoot = process.argv[4] || undefined;
const xvfbRunBin = process.argv[5] || undefined;

let input = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk: string) => {
  input += chunk;
});
process.stdin.on("end", async () => {
  const request = JSON.parse(input) as ExternalLayoutSequenceRequestV2;
  const response = upstreamRoot
    ? await runGitAuthorSequenceAdapterRequest(
        request,
        gitAuthorJavaRuntime({
          upstreamRoot,
          ...(javaHome
            ? {
                javaBin: `${javaHome}/bin/java`,
                javacBin: `${javaHome}/bin/javac`,
              }
            : {}),
          ...(classesRoot ? { classesRoot } : {}),
          ...(xvfbRunBin ? { xvfbRunBin } : {}),
        }),
      )
    : {
        schemaVersion: 2 as const,
        requestId: request.requestId,
        status: "failed" as const,
        implementation: (await import("../packages/cli/src/gitAuthorExternalAdapter.ts"))
          .GIT_AUTHOR_SEQUENCE_IMPLEMENTATION,
        reason: {
          code: "configuration",
          message: "upstream root argument is required",
        },
      };
  process.stdout.write(JSON.stringify(response));
});
