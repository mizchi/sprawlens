import { useCallback, useEffect, useMemo, useState } from "preact/hooks";

/**
 * The render-affecting settings, mirrored to the URL query so a view is
 * reproducible and shareable (and a rendering test can pin a state by URL
 * alone). Ephemeral state — camera, zoom, selection, hover — is deliberately
 * excluded; it isn't reproducible. A value equal to its default is omitted from
 * the URL, so a bare `/` stays clean and means "all defaults".
 *
 * This is a tiny preact-native replacement for nuqs. nuqs ran through
 * preact/compat's React shim, whose Context subscription retained the unmounted
 * map subtree on every layout switch (a per-switch detached-<svg> leak). The URL
 * needs here are a handful of scalars/enums, so a `history.replaceState` mirror
 * over preact hooks removes the leak and the dependency at once.
 */
const DATA_SOURCES = [
  "synthetic",
  "sprawlens",
  "sprawlens-history",
  "playwright",
  "served",
] as const;
const LAYOUTS = ["rings", "treemap"] as const;
const BOUNDARIES = ["module", "directory", "file", "class"] as const;
const DISPLAY_LEVELS = ["module", "directory", "class", "symbol", "ast", "cfg"] as const;
const WEIGHTS = ["loc", "complexity"] as const;

type Parser<T> = {
  readonly default: T;
  parse(raw: string | null): T;
  serialize(value: T): string;
  /** Equal-to-default check; an equal value is dropped from the URL. */
  eq(a: T, b: T): boolean;
};

function literal<T extends string>(options: readonly T[], fallback: T): Parser<T> {
  const set = new Set<string>(options);
  return {
    default: fallback,
    parse: (raw) => (raw !== null && set.has(raw) ? (raw as T) : fallback),
    serialize: (v) => v,
    eq: (a, b) => a === b,
  };
}

function literalArray<T extends string>(
  options: readonly T[],
  fallback: readonly T[],
): Parser<T[]> {
  const set = new Set<string>(options);
  return {
    default: [...fallback],
    // comma-separated, matching nuqs' default array delimiter
    parse: (raw) =>
      raw === null ? [...fallback] : (raw.split(",").filter((s) => set.has(s)) as T[]),
    serialize: (v) => v.join(","),
    eq: (a, b) => a.length === b.length && a.every((x, i) => x === b[i]),
  };
}

function boolean(fallback: boolean): Parser<boolean> {
  return {
    default: fallback,
    parse: (raw) => (raw === null ? fallback : raw === "true"),
    serialize: (v) => String(v),
    eq: (a, b) => a === b,
  };
}

function integer(fallback: number): Parser<number> {
  return {
    default: fallback,
    parse: (raw) => {
      if (raw === null) return fallback;
      const n = Number.parseInt(raw, 10);
      return Number.isFinite(n) ? n : fallback;
    },
    serialize: (v) => String(v),
    eq: (a, b) => a === b,
  };
}

/** Build the parser map. `darkDefault` is the system colour preference, so a
 * URL with no `dark` param follows the OS the way the app always did. */
export function makeUrlParamParsers(darkDefault: boolean) {
  return {
    source: literal(DATA_SOURCES, "sprawlens"),
    layout: literal(LAYOUTS, "treemap"),
    boundaries: literalArray(BOUNDARIES, ["module", "class"]),
    displayLevels: literalArray(DISPLAY_LEVELS, ["module", "class", "symbol"]),
    weight: literal(WEIGHTS, "loc"),
    showEdges: boolean(false),
    groupByService: boolean(false),
    dark: boolean(darkDefault),
    tilt: boolean(false),
    seed: integer(1),
    // dev override for experimental features; the server's --experimental flag
    // also turns them on (App ORs the two)
    experimental: boolean(false),
  };
}

// Parser<any>: the map is heterogeneous (each key carries its own value type);
// the Values mapped type below recovers each key's precise type from the parsers.
type ParserMap = Record<string, Parser<any>>;
type Values<P extends ParserMap> = { [K in keyof P]: P[K] extends Parser<infer T> ? T : never };
/** Partial update; `null` resets a key to its default (drops it from the URL). */
type Updates<P extends ParserMap> = Partial<{ [K in keyof P]: Values<P>[K] | null }>;

function readSearch(): URLSearchParams {
  return new URLSearchParams(typeof location === "undefined" ? "" : location.search);
}

/**
 * nuqs-shaped hook: returns parsed values and a partial setter that mirrors
 * changes to the URL via `history.replaceState` (no reload, no popstate emit).
 * Keys whose value equals the parser default are omitted to keep the URL clean.
 */
export function useUrlState<P extends ParserMap>(
  parsers: P,
): [Values<P>, (updates: Updates<P>) => void] {
  const [search, setSearch] = useState(readSearch);

  const values = useMemo(() => {
    const out = {} as Values<P>;
    for (const key in parsers) {
      out[key] = parsers[key]!.parse(search.get(key)) as Values<P>[typeof key];
    }
    return out;
  }, [search, parsers]);

  const setValues = useCallback(
    (updates: Updates<P>) => {
      const next = readSearch();
      for (const key in updates) {
        const parser = parsers[key]!;
        const value = updates[key];
        if (value === undefined) continue;
        if (value === null || parser.eq(value, parser.default)) {
          next.delete(key);
        } else {
          next.set(key, parser.serialize(value));
        }
      }
      const url = new URL(location.href);
      url.search = next.toString();
      history.replaceState(history.state, "", url);
      setSearch(next);
    },
    [parsers],
  );

  useEffect(() => {
    const onPopState = () => setSearch(readSearch());
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  return [values, setValues];
}
