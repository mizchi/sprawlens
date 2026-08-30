namespace Sprawlens.ExternalSupport

/-- Facts computed from the request and frozen capability manifest before execution. -/
structure RequestFacts where
  validBoundary : Bool
  validGraph : Bool
  boundaryCovered : Bool
  initializationCovered : Bool
  nodeCountCovered : Bool
  deriving Repr, BEq

/-- Expected support is a total, pre-execution decision. -/
def expectedSupported (facts : RequestFacts) : Bool :=
  facts.validBoundary &&
    facts.validGraph &&
    facts.boundaryCovered &&
    facts.initializationCovered &&
    facts.nodeCountCovered

theorem expectedSupported_iff (facts : RequestFacts) :
    expectedSupported facts = true ↔
      facts.validBoundary = true ∧
      facts.validGraph = true ∧
      facts.boundaryCovered = true ∧
      facts.initializationCovered = true ∧
      facts.nodeCountCovered = true := by
  simp only [expectedSupported, Bool.and_eq_true]
  constructor
  · rintro ⟨⟨⟨⟨boundary, graph⟩, boundaryCapability⟩, initialization⟩, nodeCount⟩
    exact ⟨boundary, graph, boundaryCapability, initialization, nodeCount⟩
  · rintro ⟨boundary, graph, boundaryCapability, initialization, nodeCount⟩
    exact ⟨⟨⟨⟨boundary, graph⟩, boundaryCapability⟩, initialization⟩, nodeCount⟩

inductive ResponseStatus where
  | ok
  | unsupported
  | failed
  | executionFailed
  deriving Repr, BEq

inductive ResponseClass where
  | accepted
  | expectedMissingness
  | unexpectedUnsupported
  | capabilityViolation
  | failed
  | executionFailed
  deriving Repr, BEq

/-- Classify every adapter response without dropping unsupported or failed paths. -/
def classifyResponse (expected : Bool) (response : ResponseStatus) : ResponseClass :=
  match response with
  | .ok => if expected then .accepted else .capabilityViolation
  | .unsupported => if expected then .unexpectedUnsupported else .expectedMissingness
  | .failed => .failed
  | .executionFailed => .executionFailed

theorem expected_unsupported_is_unexpected :
    classifyResponse true .unsupported = .unexpectedUnsupported := by
  rfl

theorem unexpected_ok_is_capability_violation :
    classifyResponse false .ok = .capabilityViolation := by
  rfl

theorem expected_missingness_is_retained :
    classifyResponse false .unsupported = .expectedMissingness := by
  rfl

theorem failed_is_retained (expected : Bool) :
    classifyResponse expected .failed = .failed := by
  rfl

theorem execution_failed_is_retained (expected : Bool) :
    classifyResponse expected .executionFailed = .executionFailed := by
  rfl

/-- Post-execution facts required before an effect size may be emitted. -/
structure PathGate where
  responseOk : Bool
  hostValid : Bool
  expectedSupported : Bool
  metadataMatches : Bool
  deriving Repr, BEq

def pathEligibleForEffect (path : PathGate) : Bool :=
  path.responseOk && path.hostValid && path.expectedSupported && path.metadataMatches

/-- A list keeps every registered path; effect size is enabled only if all pass. -/
def canProduceEffect (paths : List PathGate) : Bool :=
  paths.all pathEligibleForEffect

theorem canProduceEffect_iff (paths : List PathGate) :
    canProduceEffect paths = true ↔
      ∀ path, path ∈ paths →
        path.responseOk = true ∧
        path.hostValid = true ∧
        path.expectedSupported = true ∧
        path.metadataMatches = true := by
  simp only [canProduceEffect, List.all_eq_true, pathEligibleForEffect, Bool.and_eq_true]
  constructor
  · intro allEligible path pathMem
    rcases allEligible path pathMem with ⟨⟨⟨response, host⟩, expected⟩, metadata⟩
    exact ⟨response, host, expected, metadata⟩
  · intro allEligible path pathMem
    rcases allEligible path pathMem with ⟨response, host, expected, metadata⟩
    exact ⟨⟨⟨response, host⟩, expected⟩, metadata⟩

theorem canProduceEffect_requires_every_path
    (paths : List PathGate) (canProduce : canProduceEffect paths = true)
    (path : PathGate) (pathMem : path ∈ paths) :
    path.responseOk = true ∧
      path.hostValid = true ∧
      path.expectedSupported = true ∧
      path.metadataMatches = true := by
  exact (canProduceEffect_iff paths).mp canProduce path pathMem

theorem one_failed_path_blocks_effect
    (before after : List PathGate) (failedPath : PathGate)
    (failed : pathEligibleForEffect failedPath = false) :
    canProduceEffect (before ++ failedPath :: after) = false := by
  simp [canProduceEffect, failed]

end Sprawlens.ExternalSupport
