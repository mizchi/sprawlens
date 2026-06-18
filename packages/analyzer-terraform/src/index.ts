// @sprawlens/analyzer-terraform — parse .tf into raw resources for the service
// layer. Backed by @cdktf/hcl2json (wasm; no terraform CLI). Grouping and edge
// semantics live in @sprawlens/schema's resolveServices.
export * from "./extract.js";
export * from "./analyze.js";
