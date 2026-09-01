import { describe, expect, it } from "vitest";

import { PayoutStatus } from "@/lib/generated/prisma/enums";
import { payoutNetMinor } from "@/lib/wallet";

describe("payoutNetMinor", () => {
  it("shows a pending request as money out, because the funds are held", () => {
    expect(payoutNetMinor(PayoutStatus.PENDING, 5000)).toBe(-5000);
  });

  it("shows an approved request as money out, because it was sent", () => {
    expect(payoutNetMinor(PayoutStatus.APPROVED, 5000)).toBe(-5000);
  });

  // The reason this function exists: the hold was placed and released, so the
  // balance never moved, and the old -5000 contradicted the figure above it.
  it("shows a rejected request as no movement at all", () => {
    expect(payoutNetMinor(PayoutStatus.REJECTED, 5000)).toBe(0);
  });

  it("nets a rejection to zero at any size", () => {
    for (const amountMinor of [1, 5000, 128450]) {
      expect(payoutNetMinor(PayoutStatus.REJECTED, amountMinor)).toBe(0);
    }
  });
});
