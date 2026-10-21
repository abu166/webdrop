import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";

test("two peers exchange encrypted chat and an exact binary file, then disconnect cleanly", async ({
  browser,
}) => {
  const context = await browser.newContext({
    permissions: ["clipboard-read", "clipboard-write"],
    acceptDownloads: true,
  });
  const alice = await context.newPage(),
    bob = await context.newPage();
  const errors = [];
  for (const page of [alice, bob])
    page.on("pageerror", (error) => errors.push(error.message));
  await alice.goto("/");
  await alice.getByLabel("What should we call you?").fill("Alice");
  await alice.getByRole("button", { name: "Generate new" }).click();
  await alice.getByRole("button", { name: "Step into your room" }).click();
  await expect(
    alice.getByText("Signaling connected", { exact: true }),
  ).toBeVisible();
  await bob.goto(alice.url());
  await bob.getByLabel("What should we call you?").fill("Bob");
  await bob.getByRole("button", { name: "Join the room", exact: true }).click();
  await expect(alice.getByText("P2P connected · Encrypted")).toBeVisible();
  await expect(bob.getByText("P2P connected · Encrypted")).toBeVisible();
  await alice
    .getByLabel("Message", { exact: true })
    .fill("Hello **Bob** — private hello 🌍");
  await alice
    .getByRole("button", { name: "Send message", exact: true })
    .click();
  await expect(bob.getByRole("log")).toContainText("private hello 🌍");
  await expect(bob.getByRole("log").locator("strong")).toHaveText("Bob");
  const buffer = Buffer.alloc(1024 * 1024 + 39);
  for (let i = 0; i < buffer.length; i++) buffer[i] = i % 251;
  await alice
    .getByLabel("Choose file to send")
    .setInputFiles({
      name: "binary-proof.bin",
      mimeType: "application/octet-stream",
      buffer,
    });
  await alice.getByRole("button", { name: "Send file", exact: true }).click();
  await bob.getByRole("button", { name: "Accept file", exact: true }).click();
  await expect(bob.getByRole("link", { name: "Download file" })).toBeVisible();
  const downloadPromise = bob.waitForEvent("download");
  await bob.getByRole("link", { name: "Download file" }).click();
  const download = await downloadPromise;
  expect(await readFile(await download.path())).toEqual(buffer);

  await alice
    .getByLabel("Choose file to send")
    .setInputFiles({
      name: "empty.bin",
      mimeType: "application/octet-stream",
      buffer: Buffer.alloc(0),
    });
  await alice.getByRole("button", { name: "Send file", exact: true }).click();
  await bob.getByRole("button", { name: "Accept file", exact: true }).click();
  await expect(bob.getByRole("link", { name: "Download file" })).toHaveCount(2);

  // Exercise the real streaming writer with OPFS in place of an interactive OS picker.
  await bob.evaluate(() => {
    window.showSaveFilePicker = async () => {
      const dir = await navigator.storage.getDirectory();
      return dir.getFileHandle("stream-proof.bin", { create: true });
    };
  });
  await alice
    .getByLabel("Choose file to send")
    .setInputFiles({
      name: "stream-proof.bin",
      mimeType: "application/octet-stream",
      buffer,
    });
  await alice.getByRole("button", { name: "Send file", exact: true }).click();
  await bob.getByRole("button", { name: "Save to disk", exact: true }).click();
  await expect(
    bob.getByText("complete · Saved to disk", { exact: true }),
  ).toBeVisible();
  const diskHash = await bob.evaluate(async () => {
    const dir = await navigator.storage.getDirectory();
    const handle = await dir.getFileHandle("stream-proof.bin");
    const file = await handle.getFile();
    const hash = await crypto.subtle.digest(
      "SHA-256",
      await file.arrayBuffer(),
    );
    return Array.from(new Uint8Array(hash), (n) =>
      n.toString(16).padStart(2, "0"),
    ).join("");
  });
  expect(diskHash).toBe(createHash("sha256").update(buffer).digest("hex"));
  await alice
    .getByLabel("Choose file to send")
    .setInputFiles({
      name: "cancel.bin",
      mimeType: "application/octet-stream",
      buffer: Buffer.alloc(2048),
    });
  await alice.getByRole("button", { name: "Send file", exact: true }).click();
  await expect(
    bob.getByRole("button", { name: "Accept file", exact: true }),
  ).toBeVisible();
  await bob
    .getByRole("button", { name: "Cancel cancel.bin", exact: true })
    .click();
  await expect(alice.getByText("cancelled", { exact: true })).toBeVisible();
  await alice
    .getByLabel("Message", { exact: true })
    .fill("Still connected after cancellation");
  await alice
    .getByRole("button", { name: "Send message", exact: true })
    .click();
  await expect(bob.getByRole("log")).toContainText(
    "Still connected after cancellation",
  );
  await alice.screenshot({
    path: "/tmp/webdrop-workspace.png",
    fullPage: true,
  });
  await bob.getByRole("button", { name: "Leave room", exact: true }).click();
  await expect(alice.getByText("P2P connected · Encrypted")).toHaveCount(0);
  expect(errors).toEqual([]);
  await context.close();
});
test("mobile lobby and workspace fit the viewport", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.screenshot({ path: "/tmp/webdrop-mobile.png", fullPage: true });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.getByLabel("What should we call you?").fill("Mobile");
  await page.getByRole("button", { name: "Generate new" }).click();
  await page.getByRole("button", { name: "Step into your room" }).click();
  await expect(page.getByRole("heading", { name: "Room chat" })).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
