// @sprawlens/schema — neutral computation over the contracts (L1). Re-exports
// the @sprawlens/contracts shapes so existing `@sprawlens/schema` imports keep
// resolving, and adds the language-neutral operations: metrics, diff, the
// snapshot→graph adapter, and the hierarchy / layer / module / overlay / delta
// derivations.
export * from "@sprawlens/contracts";
export * from "./contracts/delta.js";
export * from "./contracts/hierarchy.js";
export * from "./contracts/layers.js";
export * from "./contracts/layersConfig.js";
export * from "./contracts/modules.js";
export * from "./contracts/overlay.js";
export * from "./contracts/serviceRules.js";
export * from "./contracts/services.js";
export * from "./core/ai.js";
export * from "./core/diff.js";
export * from "./core/metrics.js";
export * from "./core/symbolRefs.js";
export * from "./core/testTree.js";
export * from "./core/packageImports.js";
export * from "./core/callHierarchy.js";
export * from "./adapter.js";
