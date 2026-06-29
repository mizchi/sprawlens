/**
 * An `LlmClient` (the agent's chat abstraction) backed by OpenRouter's
 * OpenAI-compatible chat/completions API with function-calling. The request /
 * response mapping is pure and tested; only `complete` touches the network.
 * Reads `OPENROUTER_API_KEY` (load it with dotenvx) and `SPRAWLENS_CHAT_MODEL`.
 */
import type { LlmClient, LlmMessage, LlmTool, LlmToolCall } from "@sprawlens/agent";

const ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";
const DEFAULT_MODEL = "google/gemini-2.5-flash";

type OpenAiMessage =
  | { role: "system" | "user"; content: string }
  | {
      role: "assistant";
      content: string;
      tool_calls?: {
        id: string;
        type: "function";
        function: { name: string; arguments: string };
      }[];
    }
  | { role: "tool"; tool_call_id: string; content: string };

/** agent message → OpenAI/OpenRouter message. */
export function toApiMessage(m: LlmMessage): OpenAiMessage {
  if (m.role === "tool") return { role: "tool", tool_call_id: m.toolCallId, content: m.content };
  if (m.role === "assistant") {
    return {
      role: "assistant",
      content: m.content,
      ...(m.toolCalls?.length
        ? {
            tool_calls: m.toolCalls.map((c) => ({
              id: c.id,
              type: "function" as const,
              function: { name: c.name, arguments: JSON.stringify(c.args) },
            })),
          }
        : {}),
    };
  }
  return { role: m.role, content: m.content };
}

/** Build the request body for one completion. */
export function toRequest(model: string, messages: LlmMessage[], tools: LlmTool[]): unknown {
  return {
    model,
    temperature: 0,
    messages: messages.map(toApiMessage),
    ...(tools.length
      ? {
          tools: tools.map((t) => ({
            type: "function",
            function: { name: t.name, description: t.description, parameters: t.parameters },
          })),
          tool_choice: "auto",
        }
      : {}),
  };
}

type ApiResponse = {
  choices?: {
    message?: {
      content?: string | null;
      tool_calls?: { id: string; function: { name: string; arguments: string } }[];
    };
  }[];
  error?: { message?: string };
};

/** Parse a completion response into the agent's shape. Malformed tool-call
 * arguments fall back to an empty object rather than throwing the turn. */
export function fromResponse(json: ApiResponse): { text?: string; toolCalls?: LlmToolCall[] } {
  const message = json.choices?.[0]?.message;
  const toolCalls: LlmToolCall[] = (message?.tool_calls ?? []).map((c) => {
    let args: Record<string, unknown> = {};
    try {
      args = JSON.parse(c.function.arguments || "{}") as Record<string, unknown>;
    } catch {
      args = {};
    }
    return { id: c.id, name: c.function.name, args };
  });
  return {
    text: message?.content ?? undefined,
    toolCalls: toolCalls.length ? toolCalls : undefined,
  };
}

/** Construct the network-backed client. Throws if the API key is missing only
 * when actually called, so the server boots without it. */
export function openRouterClient(opts: { apiKey?: string; model?: string } = {}): LlmClient {
  const model = opts.model ?? process.env.SPRAWLENS_CHAT_MODEL ?? DEFAULT_MODEL;
  return {
    async complete(messages, tools) {
      const key = opts.apiKey ?? process.env.OPENROUTER_API_KEY;
      if (!key) throw new Error("OPENROUTER_API_KEY is not set (load it with dotenvx)");
      const res = await fetch(ENDPOINT, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://github.com/mizchi/sprawlens",
          "X-Title": "sprawlens chat",
        },
        body: JSON.stringify(toRequest(model, messages, tools)),
      });
      if (!res.ok) throw new Error(`OpenRouter ${res.status}: ${await res.text()}`);
      return fromResponse((await res.json()) as ApiResponse);
    },
  };
}
