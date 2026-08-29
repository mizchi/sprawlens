# Feasible-envelope selector contract

## Scope

[`feasibleEnvelope.ts`](../packages/layout/src/feasibleEnvelope.ts) is the
solver-independent policy kernel of the stable neighborhood update. Layout
generation, convergence, adjacency measurement, and displacement measurement
remain outside this module. The selector receives their already measured
candidate records.

For a declared baseline candidate `b`, constraint score `R`, selection cost
`D`, validity predicate `V`, and absolute tolerance `epsilon`, it selects

```text
arg min D(c)
  c in candidates
  V(c)
  R(c) >= R(b) - epsilon
```

Ties prefer the larger constraint score, then a caller-provided deterministic
ordering. In Sprawlens, `R` is dependency-edge realization and `D` is temporal
site displacement.

## Normative invariants

- The finite candidate set includes the declared baseline by identity.
- Tolerance and every measured score are finite; tolerance is non-negative.
- Every normally selected candidate passes the validity predicate and the
  baseline-relative constraint floor.
- No eligible candidate has a lower selection cost than the selected one.
- Selection does not mutate or generate candidates.
- If the eligible set is empty, the result explicitly reports fallback and
  returns the declared baseline. This preserves the previous total-function
  behavior without claiming that the fallback passed validity.
- Candidate input order is the final deterministic tie-break.

These properties are checked over boundary examples and all subsets of a small
finite candidate universe in
[`feasibleEnvelope.test.ts`](../packages/layout/src/feasibleEnvelope.test.ts).

## Integration boundary

[`stableNeighborhood.ts`](../packages/layout/src/stableNeighborhood.ts) owns
NPVT-style and anchor-aware candidate generation. Both the proposed method and
the compute-matched current-only control call the same selector and differ only
in how candidates are generated and in their final metadata tie-break.

The public `@sprawlens/layout` entry point exports the generic selector. It can
therefore be tested or reused without constructing Voronoi cells, while the
paper-specific candidate generator remains in the layout package.

## Claim boundary

The extracted module establishes the stated finite-set selection contract; it
does not establish that the chosen constraint or cost represents user task
performance. It also does not make candidate generation, NPVT, temporal
regularization, or change-faithfulness metrics novel.
