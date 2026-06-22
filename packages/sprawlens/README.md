# sprawlens

Visualize the structure of any **TypeScript / JavaScript, Go, Rust, or MoonBit**
repository as a stacked, zoomable map.

This is a thin wrapper that re-exposes the [`@sprawlens/cli`](https://www.npmjs.com/package/@sprawlens/cli)
binary under the bare `sprawlens` name, so you can run it without the scope:

```bash
# analyze a repo and open the structure map in the browser
npx sprawlens serve <path-to-repo>

# print the treemap in the terminal (diff-tinted)
npx sprawlens tui <path-to-repo>

# report language detection, LSP availability, and detail features
npx sprawlens doctor <path-to-repo>
```

See [`@sprawlens/cli`](https://www.npmjs.com/package/@sprawlens/cli) for the full
documentation. The two packages always share a version.
