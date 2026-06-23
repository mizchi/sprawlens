import { describe, expect, it } from "vitest";
import { parseTerraform } from "./extract.js";

const SAMPLE = `
module "orders" {
  source = "./modules/orders"
  queue  = aws_sqs_queue.orders.arn
}

resource "aws_sqs_queue" "orders" {
  name = "orders-queue"
}

resource "aws_lambda_function" "orders_api" {
  function_name = "orders-api"
  role          = aws_iam_role.orders.arn
  environment {
    variables = {
      QUEUE_URL = aws_sqs_queue.orders.url
    }
  }
}

resource "aws_lambda_event_source_mapping" "orders" {
  event_source_arn = aws_sqs_queue.orders.arn
  function_name    = aws_lambda_function.orders_api.arn
}

resource "aws_iam_role" "orders" {
  name = "orders"
}
`;

describe("parseTerraform", () => {
  it("extracts resources and module calls by address", async () => {
    const resources = await parseTerraform("sample.tf", SAMPLE);
    const byAddress = new Map(resources.map((r) => [r.address, r]));
    expect([...byAddress.keys()].sort()).toEqual([
      "aws_iam_role.orders",
      "aws_lambda_event_source_mapping.orders",
      "aws_lambda_function.orders_api",
      "aws_sqs_queue.orders",
      "module.orders",
    ]);
    expect(byAddress.get("aws_lambda_function.orders_api")?.type).toBe("aws_lambda_function");
    expect(byAddress.get("module.orders")?.type).toBe("module");
  });

  it("captures references with their attribute path", async () => {
    const resources = await parseTerraform("sample.tf", SAMPLE);
    const lambda = resources.find((r) => r.address === "aws_lambda_function.orders_api")!;
    // top-level role reference
    expect(lambda.references).toContainEqual({
      attr: "role",
      address: "aws_iam_role.orders",
    });
    // nested block reference keeps the dotted attr path
    expect(lambda.references).toContainEqual({
      attr: "environment.variables.QUEUE_URL",
      address: "aws_sqs_queue.orders",
    });
  });

  it("keeps wiring-resource endpoints as distinct attributes", async () => {
    const resources = await parseTerraform("sample.tf", SAMPLE);
    const mapping = resources.find((r) => r.address === "aws_lambda_event_source_mapping.orders")!;
    expect(mapping.references).toContainEqual({
      attr: "event_source_arn",
      address: "aws_sqs_queue.orders",
    });
    expect(mapping.references).toContainEqual({
      attr: "function_name",
      address: "aws_lambda_function.orders_api",
    });
  });

  it("extracts a code source path from terraform attributes", async () => {
    const resources = await parseTerraform(
      "s.tf",
      `module "orders" {
         source = "./services/orders"
       }
       resource "aws_lambda_function" "billing" {
         function_name = "billing"
         source_dir    = "./services/billing"
       }
       module "lambda" {
         source      = "terraform-aws-modules/lambda/aws"
         source_path = "./services/worker"
       }`,
    );
    const by = new Map(resources.map((r) => [r.address, r]));
    expect(by.get("module.orders")?.source).toBe("./services/orders");
    expect(by.get("aws_lambda_function.billing")?.source).toBe("./services/billing");
    // a registry module source is not local code, but source_path is
    expect(by.get("module.lambda")?.source).toBe("./services/worker");
  });

  it("ignores non-local / zip source attributes", async () => {
    const resources = await parseTerraform(
      "z.tf",
      `module "registry" { source = "terraform-aws-modules/vpc/aws" }
       resource "aws_lambda_function" "z" {
         function_name = "z"
         filename      = "dist/z.zip"
       }`,
    );
    const by = new Map(resources.map((r) => [r.address, r]));
    expect(by.get("module.registry")?.source).toBeUndefined();
    expect(by.get("aws_lambda_function.z")?.source).toBeUndefined();
  });

  it("ignores var/local/data references", async () => {
    const resources = await parseTerraform(
      "v.tf",
      `resource "aws_lambda_function" "a" {
         name   = var.name
         tags   = local.tags
         vpc_id = data.aws_vpc.main.id
         peer   = aws_lambda_function.b.arn
       }`,
    );
    const a = resources.find((r) => r.address === "aws_lambda_function.a")!;
    expect(a.references.map((r) => r.address)).toEqual(["aws_lambda_function.b"]);
  });
});
