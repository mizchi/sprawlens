import { Fragment, h } from "preact";

type ClassicJsxRuntime = {
  createElement: typeof h;
  Fragment: typeof Fragment;
};

type HeadlessGlobal = typeof globalThis & {
  React?: ClassicJsxRuntime;
};

const runtime: ClassicJsxRuntime = { createElement: h, Fragment };

// tsx can compile workspace TSX files as classic JSX when the CLI imports the
// viz package source. Keep that headless-only path on Preact without adding a
// React dependency.
(globalThis as HeadlessGlobal).React ??= runtime;
