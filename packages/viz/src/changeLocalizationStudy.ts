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

export type ChangeLocalizationEvent = {
  type: "task-started" | "navigation" | "relevant-symbol-opened" | "answer-submitted";
  monotonicMs: number;
};

export type ChangeLocalizationEventSummary = {
  completionMs: number;
  firstRelevantSymbolMs: number | null;
  navigationCount: number;
};

export function summarizeChangeLocalizationEvents(
  events: readonly ChangeLocalizationEvent[],
): ChangeLocalizationEventSummary {
  for (let index = 0; index < events.length; index++) {
    const event = events[index]!;
    if (!Number.isFinite(event.monotonicMs)) throw new Error("event time must be finite");
    if (index > 0 && event.monotonicMs < events[index - 1]!.monotonicMs) {
      throw new Error("event times must be monotonic");
    }
  }
  const started = events.find((event) => event.type === "task-started");
  if (!started) throw new Error("task-started event is required");
  const submitted = events.find(
    (event) => event.type === "answer-submitted" && event.monotonicMs >= started.monotonicMs,
  );
  if (!submitted) throw new Error("answer-submitted event is required");
  const relevant = events.find(
    (event) =>
      event.type === "relevant-symbol-opened" &&
      event.monotonicMs >= started.monotonicMs &&
      event.monotonicMs <= submitted.monotonicMs,
  );
  return {
    completionMs: submitted.monotonicMs - started.monotonicMs,
    firstRelevantSymbolMs: relevant ? relevant.monotonicMs - started.monotonicMs : null,
    navigationCount: events.filter(
      (event) =>
        event.type === "navigation" &&
        event.monotonicMs >= started.monotonicMs &&
        event.monotonicMs <= submitted.monotonicMs,
    ).length,
  };
}

function modulo(value: number, divisor: number): number {
  return ((value % divisor) + divisor) % divisor;
}
