/**
 * The in-app chat agent loop: an LLM drives the intent tools to answer a
 * question and/or steer the map, then replies in words. LLM-agnostic — the
 * caller injects an `LlmClient` (the server backs it with OpenRouter; tests use
 * a scripted mock). Query tool calls feed their data back to the model; the
 * navigation calls advance a ViewState the caller applies to the live map.
 */
import { applyIntent } from "./applyIntent.ts";
import type { GraphIndex } from "./graphQuery.ts";
import { INTENT_TOOLS, type JsonSchema } from "./toolSpecs.ts";
import type { ViewState } from "./viewState.ts";

export type LlmTool = { name: string; description: string; parameters: JsonSchema };
export type LlmToolCall = { id: string; name: string; args: Record<string, unknown> };
export type LlmMessage =
  | { role: "system" | "user"; content: string }
  | { role: "assistant"; content: string; toolCalls?: LlmToolCall[] }
  | { role: "tool"; toolCallId: string; name: string; content: string };

export interface LlmClient {
  complete(
    messages: LlmMessage[],
    tools: LlmTool[],
  ): Promise<{ text?: string; toolCalls?: LlmToolCall[] }>;
}

type ChatStep = { tool: string; args: unknown; summary: string };
export type ChatResult = { view: ViewState; reply: string; steps: ChatStep[] };

const SYSTEM_PROMPT = `You operate a code-structure map ("sprawlens"). Use the tools to query the dependency graph and to steer what the map shows, then answer the user concisely.

Node ids: a file is its path (e.g. "src/app/main.ts"); a symbol is "symbol:<path>:<kind>:<name>:<line>"; a module is a package/dir id (e.g. "packages/cli"). Edge direction: source depends on (imports) target — "dependencies" go forward, "dependents" backward.

Resolve a name to an id with find() before querying it. When the user wants to look at or go to something, also call a navigation tool (focus / set_layout / set_granularity / home) so the map follows along.`;

const viewSummary = (v: ViewState): string =>
  `layout=${v.layout}, granularity=${v.granularity}, selection=[${v.selection.join(", ")}], camera=${v.camera.target ?? "(all)"}`;

/**
 * Run one chat turn. Loops the model over the intent tools up to `maxSteps`
 * times; each round runs the requested tools through `applyIntent` (queries
 * answer, navigation advances the view) and feeds results back, until the model
 * replies without tool calls (or the step budget forces a final answer).
 */
export async function runChatTurn(
  idx: GraphIndex,
  view: ViewState,
  userMessage: string,
  llm: LlmClient,
  opts: { maxSteps?: number } = {},
): Promise<ChatResult> {
  const maxSteps = opts.maxSteps ?? 6;
  const tools: LlmTool[] = INTENT_TOOLS.map((t) => ({
    name: t.name,
    description: t.description,
    parameters: t.inputSchema,
  }));
  const byName = new Map(INTENT_TOOLS.map((t) => [t.name, t]));
  const messages: LlmMessage[] = [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: `Current view: ${viewSummary(view)}\n\n${userMessage}` },
  ];

  let v = view;
  const steps: ChatStep[] = [];
  for (let i = 0; i < maxSteps; i++) {
    const res = await llm.complete(messages, tools);
    if (!res.toolCalls?.length) return { view: v, reply: res.text ?? "", steps };

    messages.push({ role: "assistant", content: res.text ?? "", toolCalls: res.toolCalls });
    for (const call of res.toolCalls) {
      const spec = byName.get(call.name);
      if (!spec) {
        messages.push({
          role: "tool",
          toolCallId: call.id,
          name: call.name,
          content: `unknown tool: ${call.name}`,
        });
        continue;
      }
      const { view: nextView, result } = applyIntent(idx, v, spec.toIntent(call.args));
      v = nextView;
      const summary = result.kind === "error" ? result.message : result.summary;
      steps.push({ tool: call.name, args: call.args, summary });
      const content =
        result.kind === "data" ? `${result.summary}\n${JSON.stringify(result.data)}` : summary;
      messages.push({ role: "tool", toolCallId: call.id, name: call.name, content });
    }
  }

  // step budget spent — ask for a final answer with no further tools
  const final = await llm.complete(
    [...messages, { role: "user", content: "Answer now without using more tools." }],
    [],
  );
  return { view: v, reply: final.text ?? "(no reply)", steps };
}
