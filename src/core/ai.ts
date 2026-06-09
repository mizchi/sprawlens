import type { AIIndicator, CommitAIInfo, CommitMetadataInput } from "./types.js";

const AI_PATTERNS: Array<{ indicator: AIIndicator; pattern: RegExp }> = [
  { indicator: "claude-code", pattern: /\bclaude\s+code\b/i },
  { indicator: "claude-code", pattern: /\bgenerated\s+with\s+claude\b/i },
  { indicator: "claude-code", pattern: /\bco-authored-by:\s*claude\b/i },
  { indicator: "claude-code", pattern: /\bclaude\b/i },
  { indicator: "codex", pattern: /\bcodex\b/i },
  { indicator: "codex", pattern: /\bopenai\b/i },
  { indicator: "copilot", pattern: /\bgithub\s+copilot\b/i },
  { indicator: "copilot", pattern: /\bcopilot\b/i },
  { indicator: "cursor", pattern: /\bcursor\b/i },
  { indicator: "devin", pattern: /\bdevin\b/i },
  { indicator: "aider", pattern: /\baider\b/i },
];

export function detectAIIndicators(commit: CommitMetadataInput): CommitAIInfo {
  const haystack = [commit.authorName, commit.authorEmail ?? "", commit.message].join("\n");
  const indicators = new Set<AIIndicator>();
  const rawMatches: string[] = [];

  for (const { indicator, pattern } of AI_PATTERNS) {
    const match = haystack.match(pattern);
    if (match?.[0]) {
      indicators.add(indicator);
      rawMatches.push(match[0]);
    }
  }

  return {
    likelyAI: indicators.size > 0,
    indicators: [...indicators],
    rawMatches,
  };
}
