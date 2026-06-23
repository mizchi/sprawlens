# Terraform service layer

Status: Phase A + Phase B done (2026-06-18).

Phase B shipped: a "group by service" toggle prepends `serviceGrouping` as the
outermost hierarchy boundary, nesting the module map inside each terraform
service. `serviceFileMap` (schema) matches snapshot files to services by their
`source` globs, served as `ServiceGraph.fileServices`; the viz builds `serviceOf`
from it and feeds the terraform edges in as `nativeEdges["service"]`. Files
matching no service collect in a single `(no service)` bucket. Kept orthogonal to
the boundary/granularity axes (additive, gated behind the toggle).

## Goal

Visualize how services communicate, with Terraform as the top ("upper") layer.
Terraform supplies a set of _services_ and the _communication_ between them;
the existing per-repo module map is later nested inside each service node.

The hierarchy contract already anticipates this: `AtlasNodeKind` includes
`"service"`, `AtlasEdgeKind` includes `"flow"` ("observed/declared communication
link — service RPC, queue"), and `serviceGrouping(serviceOf)` /
`DeriveLevelsOptions.nativeEdges["service"]` exist. What is missing is the data
source (Terraform → services + edges) and the service↔code mapping.

## Scope

- **Phase A (this work): the service layer only.** Parse Terraform, derive
  service nodes and service-to-service edges, render them as a standalone plane.
- **Phase B (later): nest modules inside services.** Swap the standalone plane
  for `serviceGrouping(serviceOf)` as the top hierarchy boundary, placing the
  existing module map inside each service node. The `source` mapping is captured
  now but only rendered in Phase B.

## Data flow

`ServiceGraph` is the infra-layer analysis contract, the counterpart to
`Snapshot` for code. It is produced independently of the code language and
served alongside the snapshot.

```
.tf files ──[analyzer-terraform: hcl2json]──▶ RawResource[]
RawResource[] + LayersConfig ──[schema: resolveServices]──▶ ServiceGraph
ServiceGraph ──[server: /api/services]──▶ viz Services view
```

Terraform analysis is orthogonal to code analysis: it runs whenever `.tf` files
are present, regardless of the repo's programming language.

## Contracts (`@sprawlens/contracts`)

```ts
/** A service: a deployment/communication unit backed by Terraform resources. */
export type ServiceNode = {
  id: string; // service id (config name, or derived tf module/resource)
  label: string;
  kind: "service";
  resources: string[]; // backing terraform resource addresses
  resourceType?: string; // dominant resource type, e.g. aws_lambda_function
  source?: string[]; // mapped code-dir globs (captured; rendered in Phase B)
  metrics: { resources: number; loc?: number };
};

/** A communication/dependency edge between two services. */
export type ServiceEdge = {
  source: string;
  target: string;
  kind: ServiceEdgeKind; // depends | invoke | event | queue | http
  via?: string; // the tf resource/attr that creates the link
  weight?: number;
};

export type ServiceGraph = { services: ServiceNode[]; edges: ServiceEdge[] };
```

`ServiceEdge.kind` maps onto the existing `AtlasEdgeKind` `"flow"` when fed into
`nativeEdges["service"]` in Phase B; the finer `ServiceEdgeKind` is kept for edge
styling/labels.

### Raw resource shape (analyzer → schema boundary)

```ts
export type RawResource = {
  address: string; // "aws_lambda_function.orders_api"
  type: string; // "aws_lambda_function"
  name: string; // "orders_api"
  module?: string; // enclosing terraform module call, if any
  references: string[]; // referenced addresses: "aws_sqs_queue.orders", "module.x"
};
```

## Semantic ruleset (`@sprawlens/schema`, data-driven like `BUILTIN_LAYERS`)

`serviceRules.ts` carries built-in presets, overridable from config:

- **service-like types** — resources that are their own service when not grouped
  by config: `aws_lambda_function`, `aws_ecs_service`, `aws_apprunner_service`,
  `aws_instance`, `google_cloud_run_service`, `google_cloudfunctions*`, …
- **communication patterns → edge kind** — recognized wiring resources/refs:
  - `aws_lambda_event_source_mapping` (event_source_arn → function_name) ⇒ `queue`/`event`
  - `aws_sns_topic_subscription` ⇒ `event`
  - `aws_api_gateway_integration` / `aws_apigatewayv2_integration` ⇒ `http`
  - generic cross-service reference (no recognized pattern) ⇒ `depends`

Both requested sources are handled by one ruleset: the **resource-graph
dependency** (any cross-service reference ⇒ `depends`) and the **communication
semantics** (recognized patterns ⇒ a typed edge that supersedes `depends`).

## `resolveServices(resources, config)` (`@sprawlens/schema`, pure)

Pure function, no IO — the testable core.

1. **Group resources into services.** A resource belongs to the configured
   `[[service]]` whose `terraform` address globs match it; otherwise it falls
   back to its enclosing tf module, else (for service-like types) to a service
   of its own; non-service, ungrouped resources (roles, queues) are infra glue
   attached to whichever service references them.
2. **Derive edges.** For each reference crossing a service boundary, emit a
   `ServiceEdge`. Apply the communication ruleset to type it (`queue`/`event`/
   `http`/`invoke`); unrecognized cross-service references are `depends`. Dedupe
   by `(source, target, kind)`, summing `weight`.

## Config (`sprawlens.toml`)

```toml
[terraform]
root = "infra/"            # where to scan for .tf (default: repo root)

[[service]]
name = "orders-api"
terraform = ["aws_lambda_function.orders*", "module.orders"]  # address globs
source = ["services/orders/**"]   # code dir, captured for Phase B
```

`LayersConfig` gains optional `terraform?: { root?: string }` and
`services?: ServiceMapping[]`. The CLI toml reader normalizes `[terraform]` and
`[[service]]` (snake_case and camelCase both accepted, matching the layer rules).

## analyzer-terraform (`@sprawlens/analyzer-terraform`)

- `matchesTerraform(root, tfRoot)`: any `.tf` under the terraform root.
- Parse each `.tf` with `@cdktf/hcl2json` (HashiCorp cdktf wasm; no terraform CLI
  required) → JSON of the form `{ resource: { <type>: { <name>: [attrs] } },
module: { <name>: [attrs] } }`.
- Walk every attribute value (recursively) collecting `${...}` interpolations;
  extract `<type>.<name>` and `module.<name>` references → `RawResource.references`.
- Returns `RawResource[]`. Grouping and edge semantics live in schema, so the
  analyzer stays a thin, dependency-light parser.

Optional future enrichment (out of scope): `terraform graph` / state when the
CLI is installed — the same optional-detail pattern as LSP.

## CLI / server

- **doctor**: report Terraform detection — `.tf` found under the tf root, the
  resolved service/edge counts.
- **serve**: when `.tf` is present, run the terraform analyzer → `resolveServices`
  → expose the `ServiceGraph` at `GET /api/services` (empty graph when none).
  Re-derive on `.tf` change via the existing `watchDir` mechanism.
- `createAtlasServer` gains an optional `services?: ServiceGraph | (() => …)`.

## viz — Services view (Phase A deliverable)

- A new top-level **Services** view that fetches `/api/services` and renders the
  `ServiceGraph` with the existing `@sprawlens/layout` force layout: node radius
  from `metrics.resources`, edges styled by `ServiceEdge.kind`.
- Standalone for now; structured so Phase B replaces it with
  `serviceGrouping(serviceOf)` as the top hierarchy boundary.

## Testing

- `resolveServices`: grouping precedence (config > tf module > own service),
  edge typing per pattern, `depends` fallback, cross-service dedup/weight. Pure
  unit tests with hand-built `RawResource[]`.
- analyzer-terraform: fixture `.tf` → `RawResource[]` (addresses, module nesting,
  reference extraction incl. nested attributes).
- config reader: `[terraform]` + `[[service]]` normalization.
- No behavior change to existing code paths; the service layer is additive.
