/**
 * Layer 2 reviewer: judge a rendered screenshot against a natural-language
 * expectation with a vision model on OpenRouter (default ui-tars).
 *
 * This is the pluggable backend for `@mizchi/vlmkit`'s `nlAssert` — it takes a
 * PNG plus an assertion and returns a structured verdict. Credentials come from
 * the env only (`OPENROUTER_API_KEY` + optional `VLM_MODEL`), injected by
 * `dotenvx run --`; the value is never read or logged here. When the key is
 * absent the whole Layer 2 spec is skipped so Layer 1 always runs.
 */

const ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";
const DEFAULT_MODEL = "bytedance/ui-tars-1.5-7b";

export function hasVlmKey(): boolean {
  return !!process.env.OPENROUTER_API_KEY;
}

export function vlmModel(): string {
  return process.env.VLM_MODEL || DEFAULT_MODEL;
}

type NlImage = Buffer | Uint8Array | string;

type Verdict = {
  pass: boolean;
  reasoning: string;
  confidence?: number;
};

function toDataUrl(image: NlImage): string {
  if (typeof image === "string") {
    // already a data URL or bare base64
    return image.startsWith("data:") ? image : `data:image/png;base64,${image}`;
  }
  const base64 = Buffer.from(image).toString("base64");
  return `data:image/png;base64,${base64}`;
}

/** Pull the first JSON object out of a possibly-chatty model reply. */
function extractVerdict(content: string): Verdict {
  const fenced = content.replace(/```(?:json)?/gi, "");
  const start = fenced.indexOf("{");
  const end = fenced.lastIndexOf("}");
  if (start !== -1 && end > start) {
    try {
      const obj = JSON.parse(fenced.slice(start, end + 1)) as Partial<Verdict>;
      if (typeof obj.pass === "boolean") {
        return { pass: obj.pass, reasoning: obj.reasoning ?? "", confidence: obj.confidence };
      }
    } catch {
      // fall through to heuristic
    }
  }
  // last-resort heuristic: a clear yes/no in prose
  const lowered = content.toLowerCase();
  const pass = /\b(pass|yes|true|correct)\b/.test(lowered) && !/\b(fail|no|false|incorrect)\b/.test(lowered);
  return { pass, reasoning: content.trim().slice(0, 400) };
}

export type Reviewer = (request: {
  assertion: string;
  image: NlImage;
  metadata?: Record<string, unknown>;
}) => Promise<Verdict>;

export function openRouterReviewer(): Reviewer {
  return async ({ assertion, image }) => {
    const key = process.env.OPENROUTER_API_KEY;
    if (!key) throw new Error("OPENROUTER_API_KEY is not set");
    const body = {
      model: vlmModel(),
      temperature: 0,
      max_tokens: 600,
      messages: [
        {
          role: "system",
          content:
            "You are a strict visual QA judge. You are given a screenshot of a data-visualisation and a single expectation. " +
            "Decide whether the screenshot satisfies the expectation. " +
            'Reply with ONLY a JSON object: {"pass": boolean, "reasoning": string, "confidence": number between 0 and 1}. ' +
            "Judge only what is visible; do not assume facts not shown.",
        },
        {
          role: "user",
          content: [
            { type: "text", text: `Expectation: ${assertion}` },
            { type: "image_url", image_url: { url: toDataUrl(image) } },
          ],
        },
      ],
    };
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://github.com/mizchi/sprawlens",
        "X-Title": "sprawlens render eval",
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`OpenRouter ${res.status}: ${text.slice(0, 300)}`);
    }
    const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const content = json.choices?.[0]?.message?.content ?? "";
    if (!content) throw new Error("OpenRouter returned an empty completion");
    return extractVerdict(content);
  };
}
