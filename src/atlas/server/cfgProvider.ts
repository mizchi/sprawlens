import ts from "typescript";
import type { DetailGraph } from "../contracts/detail.js";
import type { AtlasEdge, AtlasNode } from "../contracts/graph.js";

/**
 * Structured CFG extraction for one function: basic blocks for the
 * branching statements (if / for / while / do / switch / return / throw /
 * continue / break), with grid hints shaped like the code itself — the
 * main path runs straight down column 0, an else branch sits one column
 * to the right of its then branch, loop bodies indent one column like the
 * source text, and merges return to the parent column. This is a *visual*
 * CFG — exceptions and case fallthrough are approximated because the goal
 * is reading the branch shape inside a symbol cell, not data-flow
 * analysis.
 */

const LABEL_MAX = 24;

function truncate(text: string): string {
  const flat = text.replace(/\s+/g, " ").trim();
  return flat.length > LABEL_MAX ? `${flat.slice(0, LABEL_MAX - 1)}…` : flat;
}

type FunctionLike =
  | ts.FunctionDeclaration
  | ts.FunctionExpression
  | ts.ArrowFunction
  | ts.MethodDeclaration
  | ts.ConstructorDeclaration
  | ts.GetAccessorDeclaration
  | ts.SetAccessorDeclaration;

function isFunctionLike(node: ts.Node): node is FunctionLike {
  return (
    ts.isFunctionDeclaration(node) ||
    ts.isFunctionExpression(node) ||
    ts.isArrowFunction(node) ||
    ts.isMethodDeclaration(node) ||
    ts.isConstructorDeclaration(node) ||
    ts.isGetAccessorDeclaration(node) ||
    ts.isSetAccessorDeclaration(node)
  );
}

/** Smallest function-like body whose declaration starts on `line`
 * (1-based; ±1 tolerance for decorator/modifier offsets). */
function functionAt(
  sourceFile: ts.SourceFile,
  line: number,
): FunctionLike | null {
  let best: FunctionLike | null = null;
  const visit = (node: ts.Node) => {
    if (isFunctionLike(node) && node.body) {
      const start =
        sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile))
          .line + 1;
      if (Math.abs(start - line) <= 1) best = node;
      // a declaration's initializer arrow shares the statement's line; the
      // statement start also counts
      const parentStart =
        sourceFile.getLineAndCharacterOfPosition(
          node.parent?.getStart(sourceFile) ?? node.getStart(sourceFile),
        ).line + 1;
      if (best === null && Math.abs(parentStart - line) <= 1) best = node;
    }
    if (!best) ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return best;
}

type ChainResult = { exits: string[]; row: number; maxCol: number };

/** All identifiers bound by a (possibly destructuring) binding name. */
function collectBindingNames(name: ts.BindingName, into: Set<string>): void {
  if (ts.isIdentifier(name)) {
    into.add(name.text);
    return;
  }
  for (const element of name.elements) {
    if (ts.isBindingElement(element)) {
      collectBindingNames(element.name, into);
    }
  }
}

class CfgBuilder {
  nodes: AtlasNode[] = [];
  edges: AtlasEdge[] = [];
  grid = new Map<string, { row: number; col: number }>();
  readonly entryId = "b-entry";
  readonly exitId = "b-exit";
  private counter = 0;
  /** break/continue targets, innermost last. */
  private breakables: { kind: "loop" | "switch"; headId: string; breaks: string[] }[] =
    [];
  /** blocks that already point back to the entry (recursive calls). */
  private recursiveBlocks = new Set<string>();
  /** block id → callee names, for anchoring outgoing reference edges. */
  calls = new Map<string, Set<string>>();
  /** block id → source text behind the block (hover detail). */
  code = new Map<string, string>();
  /** block id → externally observable effects (await/fetch/mutations). */
  effects = new Map<string, Set<string>>();
  /** Bindings declared in the function body (let/const/var/function). */
  bodyLocals = new Set<string>();
  /** bodyLocals plus parameters (rebinding a param stays local). */
  locals = new Set<string>();

  constructor(
    private sourceFile: ts.SourceFile,
    private fnName: string | null,
  ) {}

  /** Whether the subtree contains a self-call (recursion). */
  private callsSelf(node: ts.Node): boolean {
    if (!this.fnName) return false;
    let found = false;
    const visit = (n: ts.Node) => {
      if (found) return;
      if (
        ts.isCallExpression(n) &&
        n.expression.getText(this.sourceFile) === this.fnName
      ) {
        found = true;
        return;
      }
      ts.forEachChild(n, visit);
    };
    visit(node);
    return found;
  }

  /** Leftmost identifier of a property/element access chain. */
  private rootOf(node: ts.Expression): ts.Expression {
    let current: ts.Expression = node;
    while (
      ts.isPropertyAccessExpression(current) ||
      ts.isElementAccessExpression(current) ||
      ts.isNonNullExpression(current) ||
      ts.isParenthesizedExpression(current)
    ) {
      current = current.expression;
    }
    return current;
  }

  /** Record awaits, fetches, and out-of-scope writes in the subtree. */
  addEffects(blockId: string, node: ts.Node): void {
    const add = (effect: string) => {
      let set = this.effects.get(blockId);
      if (!set) {
        set = new Set();
        this.effects.set(blockId, set);
      }
      set.add(effect);
    };
    const writeTarget = (target: ts.Expression) => {
      if (ts.isIdentifier(target)) {
        // rebinding a local (incl. params) is invisible to the caller
        if (!this.locals.has(target.text)) add(`assigns ${target.text}`);
        return;
      }
      const root = this.rootOf(target);
      if (root.kind === ts.SyntaxKind.ThisKeyword) {
        add("mutates this");
        return;
      }
      // property/element writes leak when the object is a parameter or
      // anything not created inside the body
      if (ts.isIdentifier(root) && !this.bodyLocals.has(root.text)) {
        add(`mutates ${root.text}`);
      }
    };
    const visit = (n: ts.Node) => {
      if (ts.isAwaitExpression(n)) add("await");
      if (
        ts.isCallExpression(n) &&
        ts.isIdentifier(n.expression) &&
        n.expression.text === "fetch"
      ) {
        add("fetch");
      }
      if (
        ts.isBinaryExpression(n) &&
        n.operatorToken.kind >= ts.SyntaxKind.FirstAssignment &&
        n.operatorToken.kind <= ts.SyntaxKind.LastAssignment
      ) {
        writeTarget(n.left);
      }
      if (
        ts.isPrefixUnaryExpression(n) || ts.isPostfixUnaryExpression(n)
      ) {
        if (
          n.operator === ts.SyntaxKind.PlusPlusToken ||
          n.operator === ts.SyntaxKind.MinusMinusToken
        ) {
          writeTarget(n.operand as ts.Expression);
        }
      }
      ts.forEachChild(n, visit);
    };
    visit(node);
  }

  /** Attach (or append) the source text a block stands for. */
  addCode(blockId: string, node: ts.Node): void {
    const text = node.getText(this.sourceFile);
    const existing = this.code.get(blockId);
    const joined = existing ? `${existing}\n${text}` : text;
    this.code.set(
      blockId,
      joined.length > 600 ? `${joined.slice(0, 599)}…` : joined,
    );
  }

  /** Record every callee name appearing in the subtree. */
  collectCalls(blockId: string, node: ts.Node): void {
    const visit = (n: ts.Node) => {
      if (ts.isCallExpression(n)) {
        const callee = n.expression;
        const name = ts.isIdentifier(callee)
          ? callee.text
          : ts.isPropertyAccessExpression(callee)
            ? callee.name.text
            : null;
        if (name) {
          let set = this.calls.get(blockId);
          if (!set) {
            set = new Set();
            this.calls.set(blockId, set);
          }
          set.add(name);
        }
      }
      ts.forEachChild(n, visit);
    };
    visit(node);
  }

  /** Recursion edge: the call site loops back to the function entry. */
  markRecursion(blockId: string, node: ts.Node): void {
    if (this.recursiveBlocks.has(blockId) || !this.callsSelf(node)) return;
    this.recursiveBlocks.add(blockId);
    this.edges.push({ source: blockId, target: this.entryId, kind: "flow" });
  }

  block(label: string, row: number, col: number, loc = 1): string {
    const node: AtlasNode = {
      id: `b${this.counter++}`,
      kind: "block",
      label,
      metrics: { loc },
    };
    this.nodes.push(node);
    this.grid.set(node.id, { row, col });
    return node.id;
  }

  link(sources: readonly string[], target: string): void {
    for (const source of sources) {
      this.edges.push({ source, target, kind: "flow" });
    }
  }

  private text(node: ts.Node): string {
    return truncate(node.getText(this.sourceFile));
  }

  private body(statement: ts.Statement): readonly ts.Statement[] {
    return ts.isBlock(statement) ? statement.statements : [statement];
  }

  /** Routes `statements` from `preds`, starting at grid (row, col). */
  chain(
    statements: readonly ts.Statement[],
    preds: string[],
    row: number,
    col: number,
  ): ChainResult {
    let current = [...preds];
    let r = row;
    let maxCol = col;
    let open: AtlasNode | null = null;
    const flush = () => {
      open = null;
    };
    for (const statement of statements) {
      if (ts.isBlock(statement)) {
        flush();
        const res = this.chain(statement.statements, current, r, col);
        current = res.exits;
        r = res.row;
        maxCol = Math.max(maxCol, res.maxCol);
        continue;
      }
      if (ts.isIfStatement(statement)) {
        flush();
        const cond = this.block(`if ${this.text(statement.expression)}`, r, col);
        this.link(current, cond);
        this.markRecursion(cond, statement.expression);
        this.collectCalls(cond, statement.expression);
        this.addCode(cond, statement.expression);
        this.addEffects(cond, statement.expression);
        const thenRes = this.chain(
          this.body(statement.thenStatement),
          [cond],
          r + 1,
          col,
        );
        maxCol = Math.max(maxCol, thenRes.maxCol);
        let elseExits: string[] = [cond];
        let elseRow = r + 1;
        if (statement.elseStatement) {
          const elseRes = this.chain(
            this.body(statement.elseStatement),
            [cond],
            r + 1,
            thenRes.maxCol + 1,
          );
          maxCol = Math.max(maxCol, elseRes.maxCol);
          elseExits = elseRes.exits;
          elseRow = elseRes.row;
        }
        current = [...thenRes.exits, ...elseExits];
        r = Math.max(thenRes.row, elseRow);
        continue;
      }
      if (
        ts.isForStatement(statement) ||
        ts.isForOfStatement(statement) ||
        ts.isForInStatement(statement) ||
        ts.isWhileStatement(statement)
      ) {
        flush();
        const keyword = ts.isWhileStatement(statement) ? "while" : "for";
        const detail = ts.isWhileStatement(statement)
          ? this.text(statement.expression)
          : ts.isForOfStatement(statement) || ts.isForInStatement(statement)
            ? this.text(statement.initializer)
            : truncate(statement.condition?.getText(this.sourceFile) ?? "");
        const head = this.block(`${keyword} ${detail}`.trim(), r, col);
        this.link(current, head);
        // head calls live in the loop's own clauses, never its body
        if (ts.isWhileStatement(statement)) {
          this.collectCalls(head, statement.expression);
          this.addCode(head, statement.expression);
          this.addEffects(head, statement.expression);
        } else if (
          ts.isForOfStatement(statement) ||
          ts.isForInStatement(statement)
        ) {
          this.collectCalls(head, statement.expression);
          if (statement.initializer) {
            this.collectCalls(head, statement.initializer);
            this.addCode(head, statement.initializer);
          }
          this.addCode(head, statement.expression);
          this.addEffects(head, statement.expression);
        } else {
          for (const part of [
            statement.initializer,
            statement.condition,
            statement.incrementor,
          ]) {
            if (part) {
              this.collectCalls(head, part);
              this.addCode(head, part);
              this.addEffects(head, part);
            }
          }
        }
        this.markRecursion(
          head,
          ts.isWhileStatement(statement) ? statement.expression : statement,
        );
        this.breakables.push({ kind: "loop", headId: head, breaks: [] });
        const bodyRes = this.chain(
          this.body(statement.statement),
          [head],
          r + 1,
          col + 1,
        );
        const ctx = this.breakables.pop()!;
        this.link(bodyRes.exits, head); // loop back edge
        maxCol = Math.max(maxCol, bodyRes.maxCol);
        current = [head, ...ctx.breaks];
        r = bodyRes.row;
        continue;
      }
      if (ts.isDoStatement(statement)) {
        flush();
        const head = this.block("do", r, col);
        this.link(current, head);
        this.breakables.push({ kind: "loop", headId: head, breaks: [] });
        const bodyRes = this.chain(
          this.body(statement.statement),
          [head],
          r + 1,
          col + 1,
        );
        const ctx = this.breakables.pop()!;
        const cond = this.block(
          `while ${this.text(statement.expression)}`,
          bodyRes.row,
          col,
        );
        this.addCode(cond, statement.expression);
        this.addEffects(cond, statement.expression);
        this.link(bodyRes.exits, cond);
        this.link([cond], head); // loop back edge
        maxCol = Math.max(maxCol, bodyRes.maxCol);
        current = [cond, ...ctx.breaks];
        r = bodyRes.row + 1;
        continue;
      }
      if (ts.isSwitchStatement(statement)) {
        flush();
        const head = this.block(
          `switch ${this.text(statement.expression)}`,
          r,
          col,
        );
        this.link(current, head);
        this.addCode(head, statement.expression);
        this.addEffects(head, statement.expression);
        this.breakables.push({ kind: "switch", headId: head, breaks: [] });
        const exits: string[] = [];
        let clauseCol = col;
        let maxRow = r + 1;
        let hasDefault = false;
        for (const clause of statement.caseBlock.clauses) {
          if (ts.isDefaultClause(clause)) hasDefault = true;
          const clauseRes = this.chain(
            clause.statements,
            [head],
            r + 1,
            clauseCol,
          );
          exits.push(...clauseRes.exits);
          maxRow = Math.max(maxRow, clauseRes.row);
          clauseCol = clauseRes.maxCol + 1;
          maxCol = Math.max(maxCol, clauseRes.maxCol);
        }
        const ctx = this.breakables.pop()!;
        exits.push(...ctx.breaks);
        if (!hasDefault) exits.push(head);
        current = exits;
        r = maxRow;
        continue;
      }
      if (ts.isTryStatement(statement)) {
        flush();
        const tryRes = this.chain(statement.tryBlock.statements, current, r, col);
        maxCol = Math.max(maxCol, tryRes.maxCol);
        let exits = [...tryRes.exits];
        let maxRow = tryRes.row;
        if (statement.catchClause) {
          const catchRes = this.chain(
            statement.catchClause.block.statements,
            current,
            r,
            tryRes.maxCol + 1,
          );
          maxCol = Math.max(maxCol, catchRes.maxCol);
          exits = [...exits, ...catchRes.exits];
          maxRow = Math.max(maxRow, catchRes.row);
        }
        current = exits;
        r = maxRow;
        if (statement.finallyBlock) {
          const finRes = this.chain(statement.finallyBlock.statements, current, r, col);
          maxCol = Math.max(maxCol, finRes.maxCol);
          current = finRes.exits;
          r = finRes.row;
        }
        continue;
      }
      if (ts.isReturnStatement(statement) || ts.isThrowStatement(statement)) {
        flush();
        const keyword = ts.isReturnStatement(statement) ? "return" : "throw";
        const detail = statement.expression
          ? ` ${this.text(statement.expression)}`
          : "";
        // every return is its own terminal — no shared exit funnel
        const ret = this.block(truncate(`${keyword}${detail}`), r, col);
        this.link(current, ret);
        this.markRecursion(ret, statement);
        this.collectCalls(ret, statement);
        this.addCode(ret, statement);
        this.addEffects(ret, statement);
        current = [];
        r += 1;
        continue;
      }
      if (ts.isContinueStatement(statement)) {
        flush();
        const loop = [...this.breakables].reverse().find((b) => b.kind === "loop");
        const node = this.block("continue", r, col);
        this.link(current, node);
        if (loop) this.link([node], loop.headId); // classified as back edge
        current = [];
        r += 1;
        continue;
      }
      if (ts.isBreakStatement(statement)) {
        flush();
        const target = this.breakables[this.breakables.length - 1];
        const node = this.block("break", r, col);
        this.link(current, node);
        if (target) target.breaks.push(node);
        current = [];
        r += 1;
        continue;
      }
      // plain statement: absorb into the open simple block
      if (
        open &&
        current.length === 1 &&
        current[0] === (open as AtlasNode).id
      ) {
        (open as AtlasNode).metrics.loc += 1;
        this.markRecursion((open as AtlasNode).id, statement);
        this.collectCalls((open as AtlasNode).id, statement);
        this.addCode((open as AtlasNode).id, statement);
        this.addEffects((open as AtlasNode).id, statement);
        continue;
      }
      const id = this.block(this.text(statement), r, col);
      open = this.nodes[this.nodes.length - 1]!;
      this.link(current, id);
      this.markRecursion(id, statement);
      this.collectCalls(id, statement);
      this.addCode(id, statement);
      this.addEffects(id, statement);
      current = [id];
      r += 1;
    }
    return { exits: current, row: r, maxCol };
  }
}

export function extractCfg(source: string, line: number): DetailGraph | null {
  const sourceFile = ts.createSourceFile(
    "input.ts",
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  const fn = functionAt(sourceFile, line);
  if (!fn || !fn.body) return null;

  // self-call detection: declaration/method name, or the variable an
  // arrow/function expression is assigned to
  const fnNode = fn as FunctionLike;
  const fnName =
    fnNode.name?.getText(sourceFile) ??
    (fnNode.parent && ts.isVariableDeclaration(fnNode.parent)
      ? fnNode.parent.name.getText(sourceFile)
      : null);
  const builder = new CfgBuilder(sourceFile, fnName);
  // scope approximation for effect analysis: parameters and every binding
  // declared anywhere in the body count as local (over-approximate — a
  // nested closure's locals are included — so external writes are only
  // ever under-reported, never invented)
  for (const param of fn.parameters) {
    collectBindingNames(param.name, builder.locals);
  }
  const collectDeclarations = (n: ts.Node) => {
    if (ts.isVariableDeclaration(n)) {
      collectBindingNames(n.name, builder.bodyLocals);
    }
    if (
      (ts.isFunctionDeclaration(n) || ts.isClassDeclaration(n)) &&
      n.name
    ) {
      builder.bodyLocals.add(n.name.text);
    }
    ts.forEachChild(n, collectDeclarations);
  };
  collectDeclarations(fn.body);
  for (const name of builder.bodyLocals) builder.locals.add(name);
  const entry: AtlasNode = {
    id: "b-entry",
    kind: "block",
    label: "entry",
    metrics: { loc: 1 },
  };
  builder.nodes.unshift(entry);
  builder.grid.set(entry.id, { row: 0, col: 0 });
  // hovering the entry shows the signature line
  const header = fn.getText(sourceFile).split("\n")[0] ?? "";
  builder.code.set(entry.id, header);

  let finalRow = 1;
  let exits: string[] = [];
  if (ts.isBlock(fn.body)) {
    const res = builder.chain(fn.body.statements, [entry.id], 1, 0);
    exits = res.exits;
    finalRow = res.row;
  } else {
    // expression-bodied arrow: a single implicit return terminal
    const ret = builder.block("return", 1, 0);
    builder.link([entry.id], ret);
    builder.markRecursion(ret, fn.body);
  }

  // a shared exit only exists when some path falls through; with returns
  // everywhere, the return nodes themselves are the terminals
  if (exits.length > 0) {
    const exit: AtlasNode = {
      id: builder.exitId,
      kind: "block",
      label: "exit",
      metrics: { loc: 1 },
    };
    builder.nodes.push(exit);
    builder.grid.set(exit.id, { row: finalRow, col: 0 });
    builder.link(exits, exit.id);
  }

  return {
    nodes: builder.nodes,
    edges: builder.edges,
    grid: Object.fromEntries(builder.grid),
    calls: Object.fromEntries(
      [...builder.calls].map(([id, names]) => [id, [...names]]),
    ),
    code: Object.fromEntries(builder.code),
    effects: Object.fromEntries(
      [...builder.effects].map(([id, set]) => [id, [...set]]),
    ),
  };
}
