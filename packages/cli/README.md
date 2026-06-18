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

# report language detection, LSP availability, and detail features
npx @sprawlens/cli doctor <path-to-repo>
```

`repo` defaults to the current directory.

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

## Requirements

- Node.js >= 24

## License

MIT
