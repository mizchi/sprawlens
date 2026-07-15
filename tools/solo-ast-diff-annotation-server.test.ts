import type { AddressInfo } from "node:net";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createSoloAstDiffAnnotationPasses } from "../packages/viz/src/astDiffSoloAnnotation.ts";
import { createSoloAstDiffAnnotationServer } from "./solo-ast-diff-annotation-server.ts";

const cleanups: Array<() => Promise<void>> = [];

afterEach(async () => {
  await Promise.all(cleanups.splice(0).map((cleanup) => cleanup()));
});

describe("solo AST diff annotation server", () => {
  it("serves only the active pass sheet and its aliased packets", async () => {
    const fixture = await startFixture();

    const page = await fetch(fixture.baseUrl);
    const html = await page.text();
    expect(page.status).toBe(200);
    expect(page.headers.get("content-security-policy")).toContain("default-src 'self'");
    expect(html).toContain("AST diff blind annotation");
    expect(html).not.toContain("/pass-b/");
    expect(html).not.toContain("-key.json");

    const session = await getSession(fixture.baseUrl);
    expect(session.sheet.passId).toBe("A");
    expect(session.progress).toMatchObject({ cases: 2, reviewedCases: 0, symbols: 3 });
    expect(JSON.stringify(session)).not.toContain("source-alpha");

    const packet = await fetch(`${fixture.baseUrl}/api/packets/${session.sheet.cases[0]!.alias}`);
    expect(packet.status).toBe(200);
    expect(await packet.text()).toContain("Blind packet");
    expect((await fetch(`${fixture.baseUrl}/api/packets/not-an-alias`)).status).toBe(404);
  });

  it("starts and atomically updates a case with optimistic revision checks", async () => {
    const fixture = await startFixture();
    const initial = await getSession(fixture.baseUrl);
    const startedResponse = await postJson(`${fixture.baseUrl}/api/start`, {
      revision: initial.revision,
      annotatorId: "solo-author",
      predictionsNotInspected: true,
      otherPassNotInspected: true,
    });
    expect(startedResponse.status).toBe(200);
    const started = await startedResponse.json();
    expect(started.sheet.annotation).toMatchObject({
      annotatorId: "solo-author",
      startedOn: "2026-07-13",
      predictionsInspected: false,
      otherPassInspectedDuringAnnotation: false,
    });

    const target = started.sheet.cases[0];
    const decisions = target.decisions.map((_: unknown, index: number) =>
      index === 0 ? "modified" : "none",
    );
    const stale = await putJson(`${fixture.baseUrl}/api/cases/${target.alias}`, {
      revision: initial.revision,
      decisions,
      notes: "",
      reviewed: true,
    });
    expect(stale.status).toBe(409);

    const savedResponse = await putJson(`${fixture.baseUrl}/api/cases/${target.alias}`, {
      revision: started.revision,
      decisions,
      notes: "Signature changed.",
      reviewed: true,
    });
    expect(savedResponse.status).toBe(200);
    const saved = await savedResponse.json();
    expect(saved.progress.reviewedCases).toBe(1);
    expect(saved.sheet.cases[0]).toMatchObject({
      reviewed: true,
      notes: "Signature changed.",
    });

    const persisted = JSON.parse(await readFile(fixture.sheetPath, "utf8"));
    expect(persisted).toEqual(saved.sheet);
  });

  it("refuses completion until all cases have been explicitly reviewed", async () => {
    const fixture = await startFixture();
    let session = await getSession(fixture.baseUrl);
    session = await json(
      await postJson(`${fixture.baseUrl}/api/start`, {
        revision: session.revision,
        annotatorId: "solo-author",
        predictionsNotInspected: true,
        otherPassNotInspected: true,
      }),
    );

    const incomplete = await postJson(`${fixture.baseUrl}/api/complete`, {
      revision: session.revision,
    });
    expect(incomplete.status).toBe(400);
    expect(await incomplete.json()).toMatchObject({ error: expect.stringMatching(/unreviewed/i) });

    for (const item of session.sheet.cases) {
      session = await json(
        await putJson(`${fixture.baseUrl}/api/cases/${item.alias}`, {
          revision: session.revision,
          decisions: item.decisions.map(() => "none"),
          notes: "No visible AST symbol change.",
          reviewed: true,
        }),
      );
    }
    const completed = await json(
      await postJson(`${fixture.baseUrl}/api/complete`, { revision: session.revision }),
    );
    expect(completed.progress.complete).toBe(true);
    expect(completed.sheet.annotation.completedOn).toBe("2026-07-13");
  });
});

async function startFixture() {
  const root = await mkdtemp(resolve(tmpdir(), "sprawlens-annotation-"));
  const packetDirectory = resolve(root, "packets");
  const sheetPath = resolve(root, "pass-a.json");
  await mkdir(packetDirectory);
  const sheet = createSoloAstDiffAnnotationPasses(
    [
      {
        id: "source-alpha",
        candidates: [
          { kind: "function", name: "alpha" },
          { kind: "function", name: "beta" },
        ],
      },
      { id: "source-beta", candidates: [{ kind: "class", name: "Gamma" }] },
    ],
    {
      datasetId: "holdout",
      passASeed: 1729,
      passBSeed: 2027,
      minimumWashoutDays: 7,
    },
  ).passA.sheet;
  await writeFile(sheetPath, `${JSON.stringify(sheet, null, 2)}\n`);
  for (const item of sheet.cases) {
    await writeFile(resolve(packetDirectory, `${item.alias}.md`), `# Blind packet ${item.alias}\n`);
  }

  const server = createSoloAstDiffAnnotationServer({
    sheetPath,
    packetDirectory,
    today: () => "2026-07-13",
  });
  await new Promise<void>((resolveListen) => server.listen(0, "127.0.0.1", resolveListen));
  const address = server.address() as AddressInfo;
  cleanups.push(
    () =>
      new Promise<void>((resolveClose, reject) =>
        server.close((error) => (error ? reject(error) : resolveClose())),
      ),
    () => rm(root, { recursive: true, force: true }),
  );
  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    sheetPath,
  };
}

async function getSession(baseUrl: string) {
  return json(await fetch(`${baseUrl}/api/session`));
}

function postJson(url: string, body: unknown) {
  return fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function putJson(url: string, body: unknown) {
  return fetch(url, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function json(response: Response) {
  expect(response.status).toBe(200);
  return response.json();
}
