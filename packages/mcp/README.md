# @sprawlens/mcp

An MCP server that exposes sprawlens' headless agent core (`@sprawlens/agent`)
as tools, so an AI agent can query and navigate a codebase's structure map.

It analyzes the target repo's current working tree, builds the AtlasGraph, and
serves tools over stdio:

- **Queries** (read the graph): `structure`, `dependencies`, `dependents`,
  `impact`, `lens`, `find`, `cycles`, `path`, `describe`.
- **Render** (return SVG images): `render` for the current headless view, and
  `see_repo` for a compact Agent Lens around one target.
- **Navigation** (advance a headless view): `focus`, `get_view`.

All tools run through the same `applyIntent` the in-app chat will use, so the
agent's answers match what the map shows. Edge convention: `source → target`
means _source depends on target_.

## Run

```sh
# from anywhere; analyzes the given repo (defaults to the cwd)
pnpm --filter @sprawlens/mcp start /path/to/repo
# or directly
tsx packages/mcp/src/bin.ts /path/to/repo
```

## Wire into Claude Code

```jsonc
{
  "mcpServers": {
    "sprawlens": {
      "command": "tsx",
      "args": ["/abs/path/to/sprawlens/packages/mcp/src/bin.ts", "/path/to/your/repo"],
    },
  },
}
```

(`tsx` is used because the analyzer relies on TypeScript syntax Node's strip-only
mode can't run; a bundled `dist` bin can replace it later.)
