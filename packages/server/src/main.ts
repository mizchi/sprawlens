import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { tsDetail } from "@sprawlens/analyzer-ts";
import { createAtlasServer } from "./serve.js";

// usage: tsx src/main.ts [--port N] name=path [name=path...]
const args = process.argv.slice(2);
let port = 4710;
const repos = new Map<string, string>();
for (let i = 0; i < args.length; i++) {
  if (args[i] === "--port") {
    port = Number(args[++i]);
    continue;
  }
  const eq = args[i]!.indexOf("=");
  if (eq > 0) {
    const name = args[i]!.slice(0, eq);
    const path = resolve(args[i]!.slice(eq + 1));
    if (!existsSync(path)) {
      console.error(`repo path not found: ${name}=${path}`);
      process.exit(1);
    }
    repos.set(name, path);
  }
}
if (repos.size === 0) {
  console.error("usage: atlas-server [--port N] name=path [name=path...]");
  process.exit(1);
}

createAtlasServer({ repos, detail: tsDetail }).listen(port, "127.0.0.1", () => {
  console.log(
    `atlas server: http://127.0.0.1:${port} (${[...repos.keys()].join(", ")})`,
  );
});
