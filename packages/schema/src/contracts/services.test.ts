import { describe, expect, it } from "vitest";
import type { RawResource } from "@sprawlens/contracts";
import { resolveServices, serviceFileMap } from "./services.js";

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
