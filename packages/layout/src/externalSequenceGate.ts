export type ExternalSequenceResponseStatus = "ok" | "unsupported" | "failed" | "execution-failed";

export type ExternalSequenceResponseClass =
  | "accepted"
  | "expected-missingness"
  | "unexpected-unsupported"
  | "capability-violation"
  | "unsupported"
  | "failed"
  | "execution-failed";

/** Total support classification; `null` retains explicitly exploratory runs. */
export function classifyExternalSequenceResponse(
  status: ExternalSequenceResponseStatus,
  expectedSupported: boolean | null,
): ExternalSequenceResponseClass {
  if (status === "ok") {
    return expectedSupported === false ? "capability-violation" : "accepted";
  }
  if (status === "unsupported") {
    if (expectedSupported === true) return "unexpected-unsupported";
    if (expectedSupported === false) return "expected-missingness";
    return "unsupported";
  }
  return status;
}

export type ExternalSequenceEffectPathGate = {
  responseOk: boolean;
  hostValid: boolean;
  expectedSupported: boolean;
  metadataMatches: boolean;
};

/** Confirmatory effects require every registered path to pass every frozen gate. */
export function canProduceExternalSequenceEffect(
  paths: readonly ExternalSequenceEffectPathGate[],
): boolean {
  return paths.every(
    ({ responseOk, hostValid, expectedSupported, metadataMatches }) =>
      responseOk && hostValid && expectedSupported && metadataMatches,
  );
}
