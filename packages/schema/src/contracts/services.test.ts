import { describe, expect, it } from "vitest";
import type { RawResource } from "@sprawlens/contracts";
import {
  matchResourceFiles,
  resolveServices,
  serviceFileMap,
} from "./services.js";

/** Terse RawResource builder. */
function res(
  address: string,
  references: Array<[attr: string, address: string]> = [],
  module?: string,
): RawResource {
  const [type, name] = address.split(".");
  return {
    address,
    type: type!,
    name: name ?? "",
    ...(module ? { module } : {}),
    references: references.map(([attr, addr]) => ({ attr, address: addr })),
  };
}

describe("resolveServices", () => {
  it("makes each service-like resource its own service", () => {
    const graph = resolveServices([
      res("aws_lambda_function.a"),
      res("aws_lambda_function.b"),
    ]);
    expect(graph.services.map((s) => s.id).sort()).toEqual([
      "aws_lambda_function.a",
      "aws_lambda_function.b",
    ]);
    for (const s of graph.services) {
      expect(s.kind).toBe("service");
      expect(s.resourceType).toBe("aws_lambda_function");
      expect(s.metrics.resources).toBe(1);
    }
  });

  it("does not turn glue resources (roles, queues) into services", () => {
    const graph = resolveServices([
      res("aws_lambda_function.a", [["role", "aws_iam_role.a"]]),
      res("aws_iam_role.a"),
      res("aws_sqs_queue.q"),
    ]);
    expect(graph.services.map((s) => s.id)).toEqual(["aws_lambda_function.a"]);
    expect(graph.edges).toEqual([]); // role/queue are not services -> no edges
  });

  it("emits a depends edge for a direct cross-service reference", () => {
    const graph = resolveServices([
      res("aws_lambda_function.a", [["env", "aws_lambda_function.b"]]),
      res("aws_lambda_function.b"),
    ]);
    expect(graph.edges).toEqual([
      {
        source: "aws_lambda_function.a",
        target: "aws_lambda_function.b",
        kind: "depends",
        weight: 1,
      },
    ]);
  });

  it("groups resources by config and collapses intra-service references", () => {
    const graph = resolveServices(
      [
        res("aws_lambda_function.orders_api", [["role", "aws_iam_role.orders"]]),
        res("aws_iam_role.orders"),
        res("aws_lambda_function.billing"),
      ],
      {
        services: [
          { name: "orders", terraform: ["aws_lambda_function.orders_api", "aws_iam_role.orders"] },
          { name: "billing", terraform: ["aws_lambda_function.billing"] },
        ],
      },
    );
    const orders = graph.services.find((s) => s.id === "orders");
    expect(orders?.resources.sort()).toEqual([
      "aws_iam_role.orders",
      "aws_lambda_function.orders_api",
    ]);
    expect(orders?.metrics.resources).toBe(2);
    // role is intra-service -> no edge; the two services don't reference each other
    expect(graph.edges).toEqual([]);
  });

  it("derives a typed queue edge through an event source mapping", () => {
    const graph = resolveServices([
      // producer writes to the queue
      res("aws_lambda_function.producer", [["env", "aws_sqs_queue.jobs"]]),
      res("aws_sqs_queue.jobs"),
      // consumer is wired to the queue via the event source mapping
      res("aws_lambda_function.worker"),
      res("aws_lambda_event_source_mapping.m", [
        ["event_source_arn", "aws_sqs_queue.jobs"],
        ["function_name", "aws_lambda_function.worker"],
      ]),
    ]);
    expect(graph.edges).toContainEqual({
      source: "aws_lambda_function.producer",
      target: "aws_lambda_function.worker",
      kind: "queue",
      via: "aws_sqs_queue.jobs",
      weight: 1,
    });
  });

  it("derives an event edge through an sns subscription", () => {
    const graph = resolveServices([
      res("aws_lambda_function.publisher", [["topic", "aws_sns_topic.t"]]),
      res("aws_sns_topic.t"),
      res("aws_lambda_function.subscriber"),
      res("aws_sns_topic_subscription.s", [
        ["topic_arn", "aws_sns_topic.t"],
        ["endpoint", "aws_lambda_function.subscriber"],
      ]),
    ]);
    expect(graph.edges).toContainEqual({
      source: "aws_lambda_function.publisher",
      target: "aws_lambda_function.subscriber",
      kind: "event",
      via: "aws_sns_topic.t",
      weight: 1,
    });
  });

  it("lets a typed communication edge supersede a plain depends edge", () => {
    const graph = resolveServices([
      // producer both references the consumer directly AND via a queue
      res("aws_lambda_function.producer", [
        ["env", "aws_sqs_queue.jobs"],
        ["downstream", "aws_lambda_function.worker"],
      ]),
      res("aws_sqs_queue.jobs"),
      res("aws_lambda_function.worker"),
      res("aws_lambda_event_source_mapping.m", [
        ["event_source_arn", "aws_sqs_queue.jobs"],
        ["function_name", "aws_lambda_function.worker"],
      ]),
    ]);
    const pair = graph.edges.filter(
      (e) =>
        e.source === "aws_lambda_function.producer" &&
        e.target === "aws_lambda_function.worker",
    );
    expect(pair).toHaveLength(1);
    expect(pair[0]!.kind).toBe("queue"); // typed wins over depends
  });

  it("exposes per-resource detail with the code source each resource implements", () => {
    const graph = resolveServices([
      { ...res("aws_lambda_function.orders"), source: "services/orders" },
      res("aws_iam_role.orders_role", [], undefined),
      { ...res("aws_lambda_function.billing"), source: "services/billing" },
    ], {
      services: [
        { name: "orders", terraform: ["aws_lambda_function.orders", "aws_iam_role.orders_role"] },
        { name: "billing", terraform: ["aws_lambda_function.billing"] },
      ],
    });
    const resources = graph.resources ?? [];
    expect(resources.find((r) => r.address === "aws_lambda_function.orders")).toEqual({
      address: "aws_lambda_function.orders",
      type: "aws_lambda_function",
      service: "orders",
      source: "services/orders",
    });
    // a glue resource is listed under its service, with no code source
    expect(resources.find((r) => r.address === "aws_iam_role.orders_role")).toEqual({
      address: "aws_iam_role.orders_role",
      type: "aws_iam_role",
      service: "orders",
    });
  });

  it("matchResourceFiles globs a source dir and a source file", () => {
    const files = [
      "services/orders/handler.ts",
      "services/orders/db/repo.ts",
      "services/billing/index.ts",
      "lib/util.ts",
    ];
    expect(matchResourceFiles(files, "services/orders").sort()).toEqual([
      "services/orders/db/repo.ts",
      "services/orders/handler.ts",
    ]);
    expect(matchResourceFiles(files, "lib/util.ts")).toEqual(["lib/util.ts"]);
  });

  it("maps file paths to services by their source globs (first match wins)", () => {
    const map = serviceFileMap(
      [
        "services/orders/handler.ts",
        "services/billing/index.ts",
        "shared/util.ts",
      ],
      [
        { name: "orders", source: ["services/orders/**"] },
        { name: "billing", source: ["services/billing/**"] },
      ],
    );
    expect(map).toEqual({
      "services/orders/handler.ts": "orders",
      "services/billing/index.ts": "billing",
    });
    // unmapped files are omitted (not forced into a bucket)
    expect(map["shared/util.ts"]).toBeUndefined();
  });

  it("serviceFileMap ignores services without a source mapping", () => {
    const map = serviceFileMap(
      ["a.ts"],
      [{ name: "orders", terraform: ["aws_lambda_function.x"] }],
    );
    expect(map).toEqual({});
  });

  it("shows an external store (S3) referenced by a service as its own node + edge", () => {
    const graph = resolveServices([
      res("aws_lambda_function.api", [["env", "aws_s3_bucket.assets"]]),
      res("aws_s3_bucket.assets"),
    ]);
    // the bucket is a store node, not a service
    expect(graph.services.map((s) => s.id)).toEqual(["aws_lambda_function.api"]);
    expect(graph.stores).toEqual([
      {
        id: "aws_s3_bucket.assets",
        address: "aws_s3_bucket.assets",
        type: "aws_s3_bucket",
        label: "assets",
      },
    ]);
    expect(graph.storeEdges).toEqual([
      {
        service: "aws_lambda_function.api",
        store: "aws_s3_bucket.assets",
        via: "aws_lambda_function.api",
        weight: 1,
      },
    ]);
  });

  it("dedupes store edges from many services to one shared store", () => {
    const graph = resolveServices([
      res("aws_lambda_function.a", [["env", "aws_dynamodb_table.t"]]),
      res("aws_lambda_function.b", [["env", "aws_dynamodb_table.t"]]),
      res("aws_dynamodb_table.t"),
    ]);
    expect(graph.stores?.map((s) => s.id)).toEqual(["aws_dynamodb_table.t"]);
    expect(graph.storeEdges?.map((e) => `${e.service}->${e.store}`).sort()).toEqual([
      "aws_lambda_function.a->aws_dynamodb_table.t",
      "aws_lambda_function.b->aws_dynamodb_table.t",
    ]);
  });

  it("treats a config-grouped store as a service member, not a store node", () => {
    const graph = resolveServices(
      [
        res("aws_lambda_function.api", [["env", "aws_s3_bucket.assets"]]),
        res("aws_s3_bucket.assets"),
      ],
      {
        services: [
          { name: "api", terraform: ["aws_lambda_function.api", "aws_s3_bucket.assets"] },
        ],
      },
    );
    // explicit config grouping wins: the bucket belongs to the service
    expect(graph.stores ?? []).toEqual([]);
    expect(graph.storeEdges ?? []).toEqual([]);
    expect(graph.services.find((s) => s.id === "api")?.resources).toContain(
      "aws_s3_bucket.assets",
    );
  });

  it("resolves module references to a module service", () => {
    const graph = resolveServices([
      res("aws_lambda_function.api", [["queue_url", "module.queue"]]),
      res("module.queue", [], undefined),
    ]);
    const ids = graph.services.map((s) => s.id).sort();
    expect(ids).toEqual(["aws_lambda_function.api", "module.queue"]);
    expect(graph.edges).toContainEqual({
      source: "aws_lambda_function.api",
      target: "module.queue",
      kind: "depends",
      weight: 1,
    });
  });
});
