import { createHash } from "node:crypto";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { readFileSync } from "node:fs";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  completeSoloAstDiffAnnotationSession,
  getSoloAstDiffAnnotationProgress,
  startSoloAstDiffAnnotationSession,
  updateSoloAstDiffAnnotationCase,
} from "../packages/viz/src/astDiffSoloAnnotationSession.ts";
import type {
  SoloAstDiffAnnotationSheet,
  SoloAstDiffDecision,
} from "../packages/viz/src/astDiffSoloAnnotation.ts";

const assetDirectory = dirname(fileURLToPath(import.meta.url));
const annotationHtml = readFileSync(
  resolve(assetDirectory, "solo-ast-diff-annotation-ui.html"),
  "utf8",
);
const annotationCss = readFileSync(
  resolve(assetDirectory, "solo-ast-diff-annotation-ui.css"),
  "utf8",
);
const annotationJs = readFileSync(
  resolve(assetDirectory, "solo-ast-diff-annotation-ui.js"),
  "utf8",
);

export type SoloAstDiffAnnotationServerOptions = {
  sheetPath: string;
  packetDirectory: string;
  today?: () => string;
};

type SessionView = {
  revision: string;
  sheet: SoloAstDiffAnnotationSheet;
  progress: ReturnType<typeof getSoloAstDiffAnnotationProgress>;
};

export function createSoloAstDiffAnnotationServer(
  options: SoloAstDiffAnnotationServerOptions,
): Server {
  const store = new AnnotationSheetStore(resolve(options.sheetPath));
  const packetDirectory = resolve(options.packetDirectory);
  const today = options.today ?? utcToday;

  return createServer((request, response) => {
    void handleRequest(request, response).catch((error: unknown) => {
      const status = error instanceof HttpError ? error.status : 500;
      const message = error instanceof Error ? error.message : "unknown server error";
      if (status === 500)
        process.stderr.write(`${error instanceof Error ? error.stack : message}\n`);
      sendJson(response, status, { error: message });
    });
  });

  async function handleRequest(request: IncomingMessage, response: ServerResponse): Promise<void> {
    setSecurityHeaders(response);
    const method = request.method ?? "GET";
    const url = new URL(request.url ?? "/", "http://localhost");

    if (method === "GET" && url.pathname === "/") {
      sendText(response, 200, "text/html; charset=utf-8", annotationHtml);
      return;
    }
    if (method === "GET" && url.pathname === "/app.css") {
      sendText(response, 200, "text/css; charset=utf-8", annotationCss);
      return;
    }
    if (method === "GET" && url.pathname === "/app.js") {
      sendText(response, 200, "text/javascript; charset=utf-8", annotationJs);
      return;
    }
    if (method === "GET" && url.pathname === "/api/session") {
      sendJson(response, 200, await store.read());
      return;
    }
    if (method === "GET" && url.pathname.startsWith("/api/packets/")) {
      const alias = decodePathSegment(url.pathname.slice("/api/packets/".length));
      const { sheet } = await store.read();
      if (!sheet.cases.some((item) => item.alias === alias)) {
        throw new HttpError(404, "unknown packet alias");
      }
      const packet = await readFile(resolve(packetDirectory, `${alias}.md`), "utf8").catch(
        (error: unknown) => {
          if (isMissingFileError(error)) throw new HttpError(404, "annotation packet not found");
          throw error;
        },
      );
      sendText(response, 200, "text/markdown; charset=utf-8", packet);
      return;
    }

    if (method === "POST" && url.pathname === "/api/start") {
      assertSameOrigin(request);
      const body = objectAt(await readJsonBody(request), "start body");
      const view = await store.mutate(stringAt(body.revision, "revision"), (sheet) =>
        startSoloAstDiffAnnotationSession(sheet, {
          annotatorId: stringAt(body.annotatorId, "annotatorId"),
          startedOn: today(),
          predictionsNotInspected: body.predictionsNotInspected === true,
          otherPassNotInspected: body.otherPassNotInspected === true,
        }),
      );
      sendJson(response, 200, view);
      return;
    }

    if (method === "PUT" && url.pathname.startsWith("/api/cases/")) {
      assertSameOrigin(request);
      const alias = decodePathSegment(url.pathname.slice("/api/cases/".length));
      const body = objectAt(await readJsonBody(request), "case body");
      if (!Array.isArray(body.decisions)) throw new HttpError(400, "decisions must be an array");
      const view = await store.mutate(stringAt(body.revision, "revision"), (sheet) =>
        updateSoloAstDiffAnnotationCase(sheet, {
          alias,
          decisions: body.decisions as SoloAstDiffDecision[],
          notes: stringAt(body.notes, "notes", true),
          reviewed: booleanAt(body.reviewed, "reviewed"),
        }),
      );
      sendJson(response, 200, view);
      return;
    }

    if (method === "POST" && url.pathname === "/api/complete") {
      assertSameOrigin(request);
      const body = objectAt(await readJsonBody(request), "complete body");
      const view = await store.mutate(stringAt(body.revision, "revision"), (sheet) =>
        completeSoloAstDiffAnnotationSession(sheet, today()),
      );
      sendJson(response, 200, view);
      return;
    }

    throw new HttpError(404, "not found");
  }
}

class AnnotationSheetStore {
  private mutationQueue: Promise<void> = Promise.resolve();

  constructor(private readonly path: string) {}

  async read(): Promise<SessionView> {
    const raw = await readFile(this.path, "utf8");
    const sheet = JSON.parse(raw) as SoloAstDiffAnnotationSheet;
    return createView(sheet, sha256(raw));
  }

  mutate(
    expectedRevision: string,
    update: (sheet: SoloAstDiffAnnotationSheet) => SoloAstDiffAnnotationSheet,
  ): Promise<SessionView> {
    const operation = this.mutationQueue.then(async () => {
      const current = await this.read();
      if (current.revision !== expectedRevision) {
        throw new HttpError(409, "annotation sheet changed; reload before saving");
      }
      let sheet: SoloAstDiffAnnotationSheet;
      try {
        sheet = update(current.sheet);
      } catch (error) {
        if (error instanceof HttpError) throw error;
        throw new HttpError(
          400,
          error instanceof Error ? error.message : "invalid annotation update",
        );
      }
      const raw = `${JSON.stringify(sheet, null, 2)}\n`;
      await writeAtomic(this.path, raw);
      return createView(sheet, sha256(raw));
    });
    this.mutationQueue = operation.then(
      () => undefined,
      () => undefined,
    );
    return operation;
  }
}

function createView(sheet: SoloAstDiffAnnotationSheet, revision: string): SessionView {
  return {
    revision,
    sheet,
    progress: getSoloAstDiffAnnotationProgress(sheet),
  };
}

async function writeAtomic(path: string, value: string): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  const temporary = `${path}.${process.pid}.tmp`;
  await writeFile(temporary, value);
  await rename(temporary, path);
}

async function readJsonBody(request: IncomingMessage): Promise<unknown> {
  const contentType = request.headers["content-type"] ?? "";
  if (!contentType.toLowerCase().startsWith("application/json")) {
    throw new HttpError(415, "content-type must be application/json");
  }
  const chunks: Buffer[] = [];
  let bytes = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    bytes += buffer.length;
    if (bytes > 64 * 1024) throw new HttpError(413, "request body is too large");
    chunks.push(buffer);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new HttpError(400, "request body must be valid JSON");
  }
}

function assertSameOrigin(request: IncomingMessage): void {
  const origin = request.headers.origin;
  const host = request.headers.host;
  if (!origin) return;
  if (!host || origin !== `http://${host}`)
    throw new HttpError(403, "cross-origin mutation denied");
}

function setSecurityHeaders(response: ServerResponse): void {
  response.setHeader(
    "content-security-policy",
    "default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'none'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'",
  );
  response.setHeader("cache-control", "no-store");
  response.setHeader("x-content-type-options", "nosniff");
  response.setHeader("referrer-policy", "no-referrer");
}

function sendJson(response: ServerResponse, status: number, value: unknown): void {
  if (response.headersSent) return;
  sendText(response, status, "application/json; charset=utf-8", `${JSON.stringify(value)}\n`);
}

function sendText(
  response: ServerResponse,
  status: number,
  contentType: string,
  value: string,
): void {
  if (response.headersSent) return;
  response.writeHead(status, { "content-type": contentType });
  response.end(value);
}

function objectAt(value: unknown, path: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new HttpError(400, `${path} must be an object`);
  }
  return value as Record<string, unknown>;
}

function stringAt(value: unknown, path: string, allowEmpty = false): string {
  if (typeof value !== "string" || (!allowEmpty && value.length === 0)) {
    throw new HttpError(400, `${path} must be ${allowEmpty ? "a string" : "a non-empty string"}`);
  }
  return value;
}

function booleanAt(value: unknown, path: string): boolean {
  if (typeof value !== "boolean") throw new HttpError(400, `${path} must be a boolean`);
  return value;
}

function decodePathSegment(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    throw new HttpError(400, "invalid URL encoding");
  }
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function utcToday(): string {
  return new Date().toISOString().slice(0, 10);
}

function isMissingFileError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error && error.code === "ENOENT";
}

class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}
