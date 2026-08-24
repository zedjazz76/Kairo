import { expect, test } from "@playwright/test";

test("desktop stages a capture batch, keeps Copilot visible, opens evidence, and reaches Memory", async ({ page }) => {
  await page.addInitScript(() => {
    const commandTypes: string[] = [];
    (window as Window & {
      __KAIRO_TEST_COMMAND_SENDER__?: unknown;
      __KAIRO_TEST_COMMAND_TYPES__?: string[];
    }).__KAIRO_TEST_COMMAND_TYPES__ = commandTypes;
    (window as Window & {
      __KAIRO_TEST_COMMAND_SENDER__?: unknown;
    }).__KAIRO_TEST_COMMAND_SENDER__ = {
      connectionState: "CONNECTED",
      send: async (command: { type: string }) => {
        commandTypes.push(command.type);
      },
      disconnect: async () => {},
    };
  });

  await page.goto("/");

  await expect(page.getByTestId("capture-workspace")).toBeVisible();
  await page.getByLabel("Add files").setInputFiles([
    {
      name: "AbbaDox-routing-notes.docx",
      mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      buffer: Buffer.from("synthetic meeting notes"),
    },
    {
      name: "routing-workflow.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from("synthetic workflow"),
    },
  ]);
  await expect(page.getByText("AbbaDox-routing-notes.docx")).toBeVisible();
  await expect(page.getByText("routing-workflow.pdf")).toBeVisible();

  await page.getByRole("button", { name: "Analyze together" }).click();
  await expect(page.getByTestId("copilot-workspace")).toBeVisible();

  await page.getByLabel("Ask Kairo").fill("What is the AbbaDox routing plan?");
  await page.getByRole("button", { name: "Deep Analyze" }).click();
  await page.getByRole("button", { name: "Open evidence" }).click();
  await expect(page.getByTestId("evidence-pane")).toBeVisible();
  await expect(page.getByTestId("copilot-workspace")).toBeVisible();

  await page.getByRole("button", { name: "Memory" }).click();
  await expect(page.getByTestId("memory-inbox")).toBeVisible();

  await expect.poll(() => page.evaluate(() =>
    (window as Window & { __KAIRO_TEST_COMMAND_TYPES__?: string[] })
      .__KAIRO_TEST_COMMAND_TYPES__,
  )).toEqual([
    "CaptureSource",
    "CaptureSource",
    "DeepAnalyze",
    "OpenEvidence",
  ]);
});
