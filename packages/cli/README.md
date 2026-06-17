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

## Requirements

- Node.js >= 24

## License

MIT
