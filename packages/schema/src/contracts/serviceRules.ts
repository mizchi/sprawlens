import type { ServiceEdgeKind } from "@sprawlens/contracts";

/**
 * The semantic ruleset that turns Terraform resources into a service graph.
 * Data-driven like the layer presets: built-in defaults that
 * `sprawlens.toml`'s `[terraform]` can extend.
 *
 * - `serviceTypes`: resource types that are a service of their own (a
 *   deployment/communication unit) when not grouped by config.
 * - `wiring`: resources that connect two services. A "direct" rule names both
 *   endpoints' attributes; a "channel" rule routes producers of a channel
 *   (queue/topic) to the consumer wired onto it.
 */
export type WiringRule =
  | {
      type: string;
      shape: "direct";
      /** Attribute referencing the source-side service. */
      fromAttr: string;
      /** Attribute referencing the target-side service. */
      toAttr: string;
      kind: ServiceEdgeKind;
    }
  | {
      type: string;
      shape: "channel";
      /** Attribute referencing the channel (queue/topic) resource. */
      channelAttr: string;
      /** Attribute referencing the consuming service. */
      consumerAttr: string;
      kind: ServiceEdgeKind;
    };

export type ServiceRules = {
  serviceTypes: string[];
  wiring: WiringRule[];
};

/** Built-in rules covering the common AWS / GCP / Azure compute + wiring. */
export const DEFAULT_SERVICE_RULES: ServiceRules = {
  serviceTypes: [
    // AWS
    "aws_lambda_function",
    "aws_ecs_service",
    "aws_apprunner_service",
    "aws_instance",
    // GCP
    "google_cloud_run_service",
    "google_cloud_run_v2_service",
    "google_cloudfunctions_function",
    "google_cloudfunctions2_function",
    // Azure
    "azurerm_function_app",
    "azurerm_linux_function_app",
    "azurerm_container_app",
  ],
  wiring: [
    {
      type: "aws_lambda_event_source_mapping",
      shape: "channel",
      channelAttr: "event_source_arn",
      consumerAttr: "function_name",
      kind: "queue",
    },
    {
      type: "aws_sns_topic_subscription",
      shape: "channel",
      channelAttr: "topic_arn",
      consumerAttr: "endpoint",
      kind: "event",
    },
    {
      type: "aws_api_gateway_integration",
      shape: "direct",
      fromAttr: "rest_api_id",
      toAttr: "uri",
      kind: "http",
    },
    {
      type: "aws_apigatewayv2_integration",
      shape: "direct",
      fromAttr: "api_id",
      toAttr: "integration_uri",
      kind: "http",
    },
  ],
};
