# @sprawlens/cli

Visualize the structure of any **TypeScript / JavaScript, Go, Rust, or MoonBit**
repository as a stacked, zoomable map — modules as concentric dependency rings
(or a bundled treemap), subdivided down to files and symbols with
capacity-constrained power diagrams, and linked by their real import / call
graph.

## Usage

```bash
# analyze a repo and open the structure map in the browser
npx @sprawlens/cli serve <path-to-repo>

# print the treemap in the terminal (diff-tinted)
npx @sprawlens/cli tui <path-to-repo>

# render the structure map straight to an SVG file (no browser)
npx @sprawlens/cli render <path-to-repo> --layout treemap -o map.svg

# report language detection, LSP availability, and detail features
npx @sprawlens/cli doctor <path-to-repo>
```

`repo` defaults to the current directory.

## Rendering an SVG

`render` runs the same layout and drawing the browser does, headless in Node,
and writes a standalone SVG — useful for a CI artifact that shows a change's
macro shape at a glance.

```bash
npx @sprawlens/cli render . --layout treemap          # writes <repo>-treemap.svg
npx @sprawlens/cli render . --layout rings --edges     # concentric modules + dep mesh
npx @sprawlens/cli render . --level module -o map.svg  # modules only (no file cells)
npx @sprawlens/cli render . -o - > map.svg             # stream to stdout
```

`--layout` is `rings` or `treemap` (default), `--level` is `module` or `file`
(default). The map is deterministic for a given `--seed` (default 1).

## PR diff visualization (GitHub Actions)

`render --diff` tints files changed vs a base ref and embeds a legend, so you can
attach a structure-map of a PR's blast radius as an artifact:

```yaml
- run: git fetch origin ${{ github.base_ref }} --depth=1
- run: npx sprawlens render . --diff origin/${{ github.base_ref }} -o sprawlens-diff.svg
- uses: actions/upload-artifact@v4
  with:
    name: sprawlens-diff
    path: sprawlens-diff.svg
```

- `--diff <base>` colors added files green and modified files orange against the base ref.
- `--diff` with no base highlights uncommitted working-tree changes instead.
- Removed files cannot appear on the map; they are reported as a count in the legend.

### Inline in a PR comment (no upload) — `--format mermaid`

GitHub strips inline `<svg>` and blocks `data:` images, so an SVG always needs to
be uploaded somewhere. To show a diff *inside* a PR comment with no upload, emit
a GitHub-native Mermaid graph instead:

```bash
npx sprawlens render . --diff origin/main --format mermaid --level module
```

This prints a fenced ` ```mermaid ` block (to stdout by default) showing the
**changed subgraph** — changed files plus their direct (1-hop) dependency
neighbors — with added nodes green and modified nodes orange. Paste it into a
comment, or post it from CI:

```yaml
- run: git fetch origin ${{ github.base_ref }} --depth=1
- run: |
    npx sprawlens render . \
      --diff origin/${{ github.base_ref }} \
      --format mermaid --level module >> "$GITHUB_STEP_SUMMARY"
```

- `--format mermaid` requires `--diff`; it renders the diff subgraph, not the
  whole repo.
- `--level module` (recommended for large repos) aggregates files into modules
  and graphs cross-module imports — far fewer nodes. `--level file` (default)
  graphs individual files.
- Mermaid is a node+edge graph, so this is a dependency view of the blast radius,
  not the voronoi/treemap macro shape `--format svg` produces.
- Output is capped at 50 nodes (changed nodes kept first); the overflow count is
  noted below the graph.

## Deep detail via LSP

When a language server is installed, sprawlens wires it up automatically for
hover and call-hierarchy detail (TypeScript also gets a compiler control-flow
graph). Without one, it falls back to a tree-sitter baseline and a
source-declaration preview.

| language | server |
| --- | --- |
| TypeScript / JavaScript | `typescript-language-server` (bundled) |
| Rust | `rust-analyzer` |
| Go | `gopls` |
| MoonBit | `moonbit-lsp` |

Run `npx @sprawlens/cli doctor` to see what's detected in a given repo.

## Terraform service layer

When a repo has `.tf` files, sprawlens parses them (via `@cdktf/hcl2json`, no
`terraform` CLI needed) into a **service graph** — the upper layer above the code
modules. Service-like resources (`aws_lambda_function`, `aws_ecs_service`,
`google_cloud_run_service`, …) become nodes; their wiring becomes edges, typed by
communication kind: queue (`aws_lambda_event_source_mapping`), event
(`aws_sns_topic_subscription`), http (API Gateway integrations), and plain
`depends` for any other cross-service reference. Toggle the **services** plane at
the top of the map.

Map terraform resources to services (and, later, to their code dirs) in
`sprawlens.toml`:

```toml
[terraform]
root = "infra/"            # where to scan for .tf (default: repo root)

[[service]]
name = "orders-api"
terraform = ["aws_lambda_function.orders*", "module.orders"]
source = ["services/orders/**"]   # code dir backing the service
```

Without any `[[service]]` rules, each service-like resource is its own service.

With a `source` mapping, toggle **group by service** to nest the module map
inside each service node — services become the outer containers, the code lives
inside, and the service-to-service links ride on top. Files outside every
service's `source` collect in a `(no service)` bucket.

## Requirements

- Node.js >= 24

## License

MIT
