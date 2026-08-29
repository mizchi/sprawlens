# File identity continuity

`matchFileContinuity` is the language-neutral contract for relating a file before and after a path change. It lives in `@sprawlens/schema`; analyzers supply evidence and layout code consumes only accepted one-to-one mappings.

## Matching contract

The candidate universe is the Cartesian relation between paths removed from the before snapshot and paths added to the after snapshot. Files whose path survives are already continuous and do not enter this relation.

Evidence is evaluated in two tiers:

1. an exact multiset of `(symbol kind, fingerprint)` when every symbol has a fingerprint;
2. an exact multiset of `(symbol kind, name)` for still-unmatched files.

Both tiers require at least two symbols by default. A signature is accepted only when it occurs exactly once on each side. Duplicate signatures are returned in `ambiguous`, and the matcher abstains. The result also returns unmatched paths so downstream code never needs to infer whether absence means stability, insufficient evidence, or rejection.

The invariant is deliberately stronger than a similarity score: every accepted before path and after path appears in at most one pair. Tests exhaust the 0–3 candidate duplicate-signature state space and cover tier ordering, order independence, stable paths, thresholding, and ambiguity.

## Integration boundary

This module defines identity evidence; it does not rewrite snapshot IDs or layout anchors. A false anchor can preserve the wrong cell more convincingly than a visible delete/add transition, so layout integration is gated on a frozen human-annotated rename/move corpus. Split and merge relations require a separate many-to-many contract and must not be coerced into this one-to-one API.

The current repository scan is generated with:

```bash
just scan-file-identity-silver
```

Git rename detection is used only as a silver comparison. Git's default 50% similarity threshold is a content-based heuristic, while this matcher uses analyzer structure; agreement is useful corroboration but is not human-ground-truth precision or recall.
