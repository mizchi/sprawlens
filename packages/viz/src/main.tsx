/// <reference types="vite/client" />
import { render } from "preact";
import { App } from "./App.tsx";

const root = document.getElementById("root");
if (!root) throw new Error("#root not found");
document.body.style.margin = "0";
render(<App />, root);

// HMR safety: component edits refresh in place via prefresh and never re-run
// this module. But an update to a non-component dependency (shared colours,
// the layer model, …) can bubble here and re-execute the entry; without this
// the fresh render() stacks a SECOND app under #root. Accept the update and
// unmount the previous tree on dispose so exactly one app is ever mounted.
if (import.meta.hot) {
  import.meta.hot.accept();
  import.meta.hot.dispose(() => render(null, root));
}
