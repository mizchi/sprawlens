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
// Default judge: gemini-2.5-flash discriminates shape, colour AND exact counts
// (15/15 on probes, both real renders pass), is first-party Google (no 429
// like qwen2.5-vl-72b's single Parasail route), fast and cheap. Override with
// VLM_MODEL — e.g. bytedance/ui-tars-1.5-7b is fine for pure layout-shape
// checks (it nails rectangles-vs-rings) but cannot judge colour or exact count.
const DEFAULT_MODEL = "google/gemini-2.5-flash";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

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
    // Free-tier upstream providers rate-limit (429) and hiccup (502/503)
    // transiently; back off and retry so a flake doesn't fail the render gate.
    let lastErr = "";
    for (let attempt = 0; attempt < 4; attempt++) {
      if (attempt > 0) await sleep(1000 * 2 ** (attempt - 1));
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
      if (res.ok) {
        const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
        const content = json.choices?.[0]?.message?.content ?? "";
        if (!content) throw new Error("OpenRouter returned an empty completion");
        return extractVerdict(content);
      }
      lastErr = `OpenRouter ${res.status}: ${(await res.text().catch(() => "")).slice(0, 300)}`;
      if (res.status !== 429 && res.status < 500) break; // client error — don't retry
    }
    throw new Error(lastErr);
  };
}
