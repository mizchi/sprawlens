import ts from "typescript";
import type { TestAdapter, TestNode } from "@sprawlens/schema";

/**
 * Extract the test-case forest from a TypeScript/JavaScript test file. Covers
 * the call-based frameworks sprawlens cares about — vitest, jest and node:test
 * all spell suites `describe`/`suite`/`context` and cases `it`/`test` — by
 * walking the AST for those calls with a string-literal title and nesting by
 * the suite callback. Frameworks differ only in imports, not in this surface,
 * so one extractor serves them all.
 */

const SUITE_CALLS: ReadonlySet<string> = new Set(["describe", "suite", "context"]);
const CASE_CALLS: ReadonlySet<string> = new Set(["it", "test", "bench"]);

function scriptKindFor(file: string): ts.ScriptKind {
  if (file.endsWith(".tsx")) return ts.ScriptKind.TSX;
  if (file.endsWith(".jsx")) return ts.ScriptKind.JSX;
  if (/\.[cm]?js$/.test(file)) return ts.ScriptKind.JS;
  return ts.ScriptKind.TS;
}

/** The leftmost identifier of a callee, peeling `.skip`/`.only`/`.each(...)`. */
function rootCalleeName(expr: ts.Expression): string | undefined {
  if (ts.isIdentifier(expr)) return expr.text;
  if (ts.isPropertyAccessExpression(expr)) return rootCalleeName(expr.expression);
  if (ts.isElementAccessExpression(expr)) return rootCalleeName(expr.expression);
  if (ts.isCallExpression(expr)) return rootCalleeName(expr.expression);
  if (ts.isParenthesizedExpression(expr)) return rootCalleeName(expr.expression);
  return undefined;
}

/** The literal title of a test, keeping the static parts of a template. */
function titleOf(arg: ts.Expression | undefined): string | undefined {
  if (!arg) return undefined;
  if (ts.isStringLiteralLike(arg)) return arg.text;
  if (ts.isTemplateExpression(arg))
    return (
      arg.head.text +
      arg.templateSpans.map((span) => `\${…}${span.literal.text}`).join("")
    );
  return undefined;
}

function collectFrom(
  container: ts.Node,
  sf: ts.SourceFile,
  file: string,
): TestNode[] {
  const out: TestNode[] = [];
  const visit = (node: ts.Node): void => {
    if (ts.isCallExpression(node)) {
      const name = rootCalleeName(node.expression);
      const kind = name
        ? SUITE_CALLS.has(name)
          ? "suite"
          : CASE_CALLS.has(name)
            ? "case"
            : undefined
        : undefined;
      const title = titleOf(node.arguments[0]);
      if (kind && title !== undefined) {
        const startLine =
          sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1;
        const endLine = sf.getLineAndCharacterOfPosition(node.getEnd()).line + 1;
        const callback = node.arguments.find(
          (a) => ts.isArrowFunction(a) || ts.isFunctionExpression(a),
        );
        out.push({
          id: `test:${file}:${startLine}:${title}`,
          kind,
          name: title,
          file,
          startLine,
          endLine,
          children: callback ? collectFrom(callback, sf, file) : [],
        });
        return; // nested suites/cases handled via the callback, not by descent
      }
    }
    ts.forEachChild(node, visit);
  };
  ts.forEachChild(container, visit);
  return out;
}

/** Suite/case forest for one TS/JS test file (empty when it holds no tests). */
export function extractTsTests(file: string, source: string): TestNode[] {
  const sf = ts.createSourceFile(
    file,
    source,
    ts.ScriptTarget.Latest,
    true,
    scriptKindFor(file),
  );
  return collectFrom(sf, sf, file);
}

/** The TS/JS test adapter (vitest / jest / node:test). */
export const tsTestAdapter: TestAdapter = {
  extractFile(file, source) {
    const nodes = extractTsTests(file, source);
    return nodes.length > 0 ? nodes : null;
  },
};
