import { expect, test } from "@playwright/test";

// Read-only on purpose. These run against whatever database DATABASE_URL points
// at, so the smoke path never mutates seeded state.

test("lands on accounts and renders channels from the database", async ({
  page,
}) => {
  await page.goto("/");

  await expect(page).toHaveURL("/accounts");
  await expect(
    page.getByRole("heading", { name: "Connected accounts" }),
  ).toBeVisible();

  // The header and the table are both server-rendered from Prisma, so seeded
  // values appearing here prove a real render rather than a static shell.
  await expect(page.getByRole("banner")).toContainText("Maya Rivera");

  const rows = page.getByRole("table").locator("tbody tr");
  await expect(rows).toHaveCount(4);
  await expect(rows.first()).toContainText("TikTok");
  await expect(rows.first()).toContainText("512,300");
});

test("navigates between portal sections", async ({ page }) => {
  await page.goto("/accounts");

  const nav = page.getByRole("navigation", { name: "Portal" });
  await nav.getByRole("link", { name: "Wallet" }).click();

  await expect(page).toHaveURL("/wallet");
  await expect(
    page.getByRole("heading", { level: 1, name: "Wallet" }),
  ).toBeVisible();
  await expect(nav.getByRole("link", { name: "Wallet" })).toHaveAttribute(
    "aria-current",
    "page",
  );
});
