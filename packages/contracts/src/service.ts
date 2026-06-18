/**
 * Service-layer contract: the infrastructure counterpart to the code `Snapshot`.
 * A `ServiceGraph` describes deployment/communication units (services) and the
 * communication between them, derived from Terraform. It is produced
 * independently of the repo's programming language and rendered as the top
 * ("upper") layer above the module map.
 *
 * Producer boundary: a terraform analyzer emits `RawResource[]` (a thin parse of
 * the .tf files); `resolveServices` (in @sprawlens/schema) groups those into a
 * `ServiceGraph` using the configured mapping and the semantic ruleset.
 */

/**
 * A communication/dependency edge between services. `depends` is a plain
 * cross-service reference (the projected resource graph); the others are typed
 * communication patterns recognized from the wiring resources. Maps onto the
 * AtlasEdge `"flow"` kind when fed into the hierarchy in Phase B.
 */
export type ServiceEdgeKind = "depends" | "invoke" | "event" | "queue" | "http";

/** A service: a deployment/communication unit backed by Terraform resources. */
export type ServiceNode = {
  /** Service id — the config name, or a derived tf module / resource address. */
  id: string;
  label: string;
  kind: "service";
  /** Backing terraform resource addresses (e.g. "aws_lambda_function.api"). */
  resources: string[];
  /** Dominant backing resource type, for an icon (e.g. "aws_lambda_function"). */
  resourceType?: string;
  /** Mapped code-dir globs — captured now, rendered when modules nest (Phase B). */
  source?: string[];
  metrics: { resources: number; loc?: number };
};

/** A communication/dependency edge between two services. */
export type ServiceEdge = {
  source: string;
  target: string;
  kind: ServiceEdgeKind;
  /** The terraform resource/attribute that creates the link, for a tooltip. */
  via?: string;
  weight?: number;
};

export type ServiceGraph = { services: ServiceNode[]; edges: ServiceEdge[] };

/**
 * The analyzer→schema boundary: one parsed Terraform resource (or module call),
 * with the addresses it references. `resolveServices` consumes these; the
 * analyzer does no grouping or semantics of its own.
 */
export type ResourceRef = {
  /** The attribute the reference was found under (top-level name or dotted
   * path), e.g. "event_source_arn" — used to tell apart the endpoints of a
   * wiring resource. */
  attr: string;
  /** The referenced address, e.g. "aws_sqs_queue.orders" or "module.x". */
  address: string;
};

export type RawResource = {
  /** Full address, e.g. "aws_lambda_function.orders_api". */
  address: string;
  /** Resource type, e.g. "aws_lambda_function"; "module" for a module call. */
  type: string;
  /** Local name, e.g. "orders_api". */
  name: string;
  /** Enclosing terraform module call ("orders"), if this resource is nested. */
  module?: string;
  /** Referenced addresses found in attribute interpolations. */
  references: ResourceRef[];
};
