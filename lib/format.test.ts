import { describe, expect, it } from "vitest";

import { formatMinor } from "@/lib/format";

describe("formatMinor", () => {
  it("renders whole dollars with explicit cents", () => {
    expect(formatMinor(128450)).toBe("$1,284.50");
  });

  it("pads a single-digit cents remainder", () => {
    expect(formatMinor(105)).toBe("$1.05");
  });

  it("renders zero", () => {
    expect(formatMinor(0)).toBe("$0.00");
  });

  it("puts the sign ahead of the currency symbol for negative rows", () => {
    expect(formatMinor(-2500)).toBe("-$25.00");
  });
});
