import { expect, test } from "@playwright/test";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { createSoloAstDiffAnnotationPasses } from "../packages/viz/src/astDiffSoloAnnotation.ts";
import { createSoloAstDiffAnnotationServer } from "../tools/solo-ast-diff-annotation-server.ts";

test("completes a blinded pass through the keyboard-friendly annotation UI", async ({ page }) => {
  const fixture = await startFixture();
  try {
    await page.goto(fixture.baseUrl);
    await expect(page.getByRole("heading", { name: "Start the blinded pass" })).toBeVisible();
    await page.getByLabel("Annotator ID").fill("solo-author");
    await page
      .getByLabel("I have not inspected evaluated AST diff predictions for these cases.")
      .check();
    await page
      .getByLabel("I have not inspected the other annotation pass or either alias key.")
      .check();
    await page.getByRole("button", { name: "Begin Pass A" }).click();

    await expect(page.locator("#pass-badge")).toHaveText("Pass A");
    await expect(page.locator("#progress-label")).toHaveText("0 / 2 cases reviewed");
    await expect(page.locator("#packet")).toContainText("Source patch");

    const firstDecision = page.locator(".decision-row").first();
    await firstDecision.getByRole("button", { name: "Modified" }).click();
    await expect(page.locator("#save-status")).toHaveText("Unsaved");
    await page.getByRole("button", { name: "Save draft" }).click();
    await expect(page.locator("#save-status")).toHaveText("Saved");
    await page.getByRole("button", { name: "Mark reviewed & next" }).click();
    await expect(page.locator("#progress-label")).toHaveText("1 / 2 cases reviewed");

    await page.getByRole("button", { name: "Mark reviewed & next" }).click();
    await expect(page.locator("#progress-label")).toHaveText("2 / 2 cases reviewed");
    await expect(page.getByRole("button", { name: "Complete pass" })).toBeEnabled();
    page.once("dialog", (dialog) => dialog.accept());
    await page.getByRole("button", { name: "Complete pass" }).click();
    await expect(
      page.getByRole("heading", { name: "Pass completed and sealed in the working sheet" }),
    ).toBeVisible();

    const persisted = JSON.parse(await readFile(fixture.sheetPath, "utf8"));
    expect(persisted.annotation).toMatchObject({
      annotatorId: "solo-author",
      startedOn: "2026-07-13",
      completedOn: "2026-07-13",
      predictionsInspected: false,
      otherPassInspectedDuringAnnotation: false,
    });
    expect(persisted.cases.every((item: { reviewed: boolean }) => item.reviewed)).toBe(true);
  } finally {
    await fixture.close();
  }
});

async function startFixture() {
  const root = await mkdtemp(resolve(tmpdir(), "sprawlens-annotation-e2e-"));
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
    await writeFile(
      resolve(packetDirectory, `${item.alias}.md`),
      `# Blind packet: ${item.alias}\n\n## Source patch\n\n\`\`\`diff\n+export const changed = true\n\`\`\`\n\n## After-revision symbol candidates\n\n- [ ] \`added\` / \`modified\` / none — \`{"kind":"function","name":"changed"}\` (lines 1–1)\n`,
    );
  }
  const server = createSoloAstDiffAnnotationServer({
    sheetPath,
    packetDirectory,
    today: () => "2026-07-13",
  });
  await new Promise<void>((resolveListen) => server.listen(0, "127.0.0.1", resolveListen));
  const address = server.address() as AddressInfo;
  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    sheetPath,
    close: async () => {
      await new Promise<void>((resolveClose, reject) =>
        server.close((error) => (error ? reject(error) : resolveClose())),
      );
      await rm(root, { recursive: true, force: true });
    },
  };
}
