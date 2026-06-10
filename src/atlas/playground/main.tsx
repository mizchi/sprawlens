import { render } from "preact";
import { App } from "./App.tsx";

const root = document.getElementById("root");
if (!root) throw new Error("#root not found");
document.body.style.margin = "0";
render(<App />, root);
