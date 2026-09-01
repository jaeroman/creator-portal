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

test("wallet shows balances derived from the seeded ledger", async ({
  page,
}) => {
  await page.goto("/wallet");

  // The seed sums to these exactly: pending 34000 and available 128450 minor
  // units. Asserting the rendered strings covers the derivation and the
  // integer-only formatter in one go.
  const available = page.getByRole("heading", { name: "Available balance" });
  await expect(available.locator("..")).toContainText("$1,284.50");

  const pending = page.getByRole("heading", { name: "Pending earnings" });
  await expect(pending.locator("..")).toContainText("$340.00");
});

test("wallet history collapses a payout request into one row", async ({
  page,
}) => {
  await page.goto("/wallet");

  const rows = page.getByRole("table").locator("tbody tr");

  // 8 ledger entries with no payout request behind them, plus 1 request.
  await expect(rows).toHaveCount(9);
  await expect(rows.first()).toContainText("$155.00");
  await expect(rows.last()).toContainText("$425.00");

  // The seeded request is backed by three ledger rows. Exactly one row may
  // carry its amount, which is what proves the collapse rather than a filter.
  const payoutRows = rows.filter({ hasText: "Payout request" });
  await expect(payoutRows).toHaveCount(1);
  await expect(payoutRows).toContainText("-$440.00");
  await expect(payoutRows).toContainText("Approved");
});
