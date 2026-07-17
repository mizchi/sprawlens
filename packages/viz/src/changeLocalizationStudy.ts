export const CHANGE_LOCALIZATION_CONDITIONS = [
  "file-level",
  "range-overlap",
  "parent-aware",
] as const;

export type ChangeLocalizationCondition = (typeof CHANGE_LOCALIZATION_CONDITIONS)[number];

export type ChangeLocalizationAssignment = {
  ordinal: number;
  taskId: string;
  caseId: string;
  condition: ChangeLocalizationCondition;
};

const CONDITION_ORDERS: readonly (readonly ChangeLocalizationCondition[])[] = [
  ["file-level", "range-overlap", "parent-aware"],
  ["file-level", "parent-aware", "range-overlap"],
  ["range-overlap", "file-level", "parent-aware"],
  ["range-overlap", "parent-aware", "file-level"],
  ["parent-aware", "file-level", "range-overlap"],
  ["parent-aware", "range-overlap", "file-level"],
];

export function assignChangeLocalizationTasks(
  caseIds: readonly string[],
  participantIndex: number,
  options: { tasksPerCondition?: number } = {},
): ChangeLocalizationAssignment[] {
  const tasksPerCondition = options.tasksPerCondition ?? 1;
  if (!Number.isInteger(participantIndex)) throw new Error("participantIndex must be an integer");
  if (!Number.isInteger(tasksPerCondition) || tasksPerCondition < 1) {
    throw new Error("tasksPerCondition must be a positive integer");
  }
  const taskCount = CHANGE_LOCALIZATION_CONDITIONS.length * tasksPerCondition;
  if (caseIds.length < taskCount) throw new Error(`at least ${taskCount} cases are required`);
  if (new Set(caseIds).size !== caseIds.length) throw new Error("case ids must be unique");

  const normalizedParticipant = modulo(participantIndex, CONDITION_ORDERS.length);
  const order = CONDITION_ORDERS[normalizedParticipant]!;
  const offset = modulo(participantIndex * tasksPerCondition, caseIds.length);
  const assignments: ChangeLocalizationAssignment[] = [];
  for (let block = 0; block < tasksPerCondition; block++) {
    for (const condition of order) {
      const ordinal = assignments.length;
      assignments.push({
        ordinal,
        taskId: `p${participantIndex}-t${ordinal}`,
        caseId: caseIds[(offset + ordinal) % caseIds.length]!,
        condition,
      });
    }
  }
  return assignments;
}

type TimedChangeLocalizationEvent<T extends string> = {
  type: T;
  monotonicMs: number;
};

const SIMPLE_CHANGE_LOCALIZATION_EVENT_TYPES = [
  "task-started",
  "navigation",
  "relevant-symbol-opened",
  "core-change-opened",
  "dependent-symbol-opened",
  "answer-submitted",
] as const;

type SimpleChangeLocalizationEventType = (typeof SIMPLE_CHANGE_LOCALIZATION_EVENT_TYPES)[number];

export type ChangeLocalizationEvent =
  | TimedChangeLocalizationEvent<SimpleChangeLocalizationEventType>
  | (TimedChangeLocalizationEvent<"context-source-opened"> & {
      /** Session-local identifier. It must not encode a path, symbol name, or source text. */
      contextSourceOrdinal: number;
    });

export type ChangeLocalizationEventSummary = {
  completionMs: number;
  firstRelevantSymbolMs: number | null;
  firstCoreChangeMs: number | null;
  firstDependentSymbolMs: number | null;
  distinctContextSourceCount: number;
  navigationCount: number;
};

export function summarizeChangeLocalizationEvents(
  events: readonly ChangeLocalizationEvent[],
): ChangeLocalizationEventSummary {
  const validatedEvents = events.map(validateChangeLocalizationEvent);
  for (let index = 1; index < validatedEvents.length; index++) {
    if (validatedEvents[index]!.monotonicMs < validatedEvents[index - 1]!.monotonicMs) {
      throw new Error("event times must be monotonic");
    }
  }
  const started = validatedEvents.find((event) => event.type === "task-started");
  if (!started) throw new Error("task-started event is required");
  const submitted = validatedEvents.find(
    (event) => event.type === "answer-submitted" && event.monotonicMs >= started.monotonicMs,
  );
  if (!submitted) throw new Error("answer-submitted event is required");
  const taskEvents = validatedEvents.filter(
    (event) =>
      event.monotonicMs >= started.monotonicMs && event.monotonicMs <= submitted.monotonicMs,
  );
  return {
    completionMs: submitted.monotonicMs - started.monotonicMs,
    firstRelevantSymbolMs: firstEventElapsedMs(
      taskEvents,
      "relevant-symbol-opened",
      started.monotonicMs,
    ),
    firstCoreChangeMs: firstEventElapsedMs(taskEvents, "core-change-opened", started.monotonicMs),
    firstDependentSymbolMs: firstEventElapsedMs(
      taskEvents,
      "dependent-symbol-opened",
      started.monotonicMs,
    ),
    distinctContextSourceCount: new Set(
      taskEvents
        .filter((event) => event.type === "context-source-opened")
        .map((event) => event.contextSourceOrdinal),
    ).size,
    navigationCount: taskEvents.filter((event) => event.type === "navigation").length,
  };
}

function validateChangeLocalizationEvent(event: unknown): ChangeLocalizationEvent {
  if (!isRecord(event)) throw new Error("event must be an object");
  const type = event.type;
  if (
    typeof type !== "string" ||
    (type !== "context-source-opened" &&
      !SIMPLE_CHANGE_LOCALIZATION_EVENT_TYPES.includes(type as SimpleChangeLocalizationEventType))
  ) {
    throw new Error("event type is not recognized");
  }
  if (!Number.isFinite(event.monotonicMs)) throw new Error("event time must be finite");
  const monotonicMs = event.monotonicMs as number;
  if (type === "context-source-opened") {
    if (!hasExactKeys(event, ["type", "monotonicMs", "contextSourceOrdinal"])) {
      throw new Error("context-source-opened event fields are invalid");
    }
    if (
      !Number.isInteger(event.contextSourceOrdinal) ||
      (event.contextSourceOrdinal as number) < 0
    ) {
      throw new Error("context source ordinal must be a non-negative integer");
    }
    return { type, monotonicMs, contextSourceOrdinal: event.contextSourceOrdinal as number };
  }
  if (!hasExactKeys(event, ["type", "monotonicMs"])) {
    throw new Error(`${type} event fields are invalid`);
  }
  return { type: type as SimpleChangeLocalizationEventType, monotonicMs };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasExactKeys(record: Record<string, unknown>, expected: readonly string[]): boolean {
  const keys = Object.keys(record);
  return keys.length === expected.length && expected.every((key) => Object.hasOwn(record, key));
}

function firstEventElapsedMs(
  events: readonly ChangeLocalizationEvent[],
  type: ChangeLocalizationEvent["type"],
  startedAtMs: number,
): number | null {
  const event = events.find((candidate) => candidate.type === type);
  return event ? event.monotonicMs - startedAtMs : null;
}

function modulo(value: number, divisor: number): number {
  return ((value % divisor) + divisor) % divisor;
}
