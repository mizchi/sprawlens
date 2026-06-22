import {
  parseAsArrayOf,
  parseAsBoolean,
  parseAsInteger,
  parseAsStringLiteral,
} from "nuqs";

/**
 * The render-affecting settings, mirrored to the URL query so a view is
 * reproducible and shareable (and a rendering test can pin a state by URL
 * alone). Ephemeral state — camera, zoom, selection, hover — is deliberately
 * excluded; it isn't reproducible. nuqs omits a value equal to its default from
 * the URL, so a bare `/atlas.html` stays clean and means "all defaults".
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
const DISPLAY_LEVELS = [
  "module",
  "directory",
  "class",
  "symbol",
  "ast",
  "cfg",
] as const;
const WEIGHTS = ["loc", "complexity"] as const;

/** Build the parser map. `darkDefault` is the system colour preference, so a
 * URL with no `dark` param follows the OS the way the app always did. */
export function makeUrlParamParsers(darkDefault: boolean) {
  return {
    source: parseAsStringLiteral(DATA_SOURCES).withDefault("sprawlens"),
    layout: parseAsStringLiteral(LAYOUTS).withDefault("treemap"),
    boundaries: parseAsArrayOf(parseAsStringLiteral(BOUNDARIES)).withDefault([
      "module",
      "class",
    ]),
    displayLevels: parseAsArrayOf(parseAsStringLiteral(DISPLAY_LEVELS)).withDefault(
      ["module", "class", "symbol"],
    ),
    weight: parseAsStringLiteral(WEIGHTS).withDefault("loc"),
    showEdges: parseAsBoolean.withDefault(false),
    groupByService: parseAsBoolean.withDefault(false),
    dark: parseAsBoolean.withDefault(darkDefault),
    tilt: parseAsBoolean.withDefault(false),
    seed: parseAsInteger.withDefault(1),
    // dev override for experimental features; the server's --experimental flag
    // also turns them on (App ORs the two)
    experimental: parseAsBoolean.withDefault(false),
  };
}
