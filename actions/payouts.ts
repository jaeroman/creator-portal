"use server";

import { revalidatePath } from "next/cache";
import { getCreator } from "@/lib/creator";
import { formatMinor } from "@/lib/format";
import { createPayoutRequest, parseAmountMinor } from "@/lib/payout";
import { prisma } from "@/lib/prisma";

export type PayoutActionState =
  | { success: true; message: string }
  | { success: false; error: string }
  | null;

export async function requestPayout(
  _prevState: PayoutActionState,
  formData: FormData,
): Promise<PayoutActionState> {
  const idempotencyKey = formData.get("idempotencyKey");

  if (typeof idempotencyKey !== "string" || idempotencyKey.length === 0) {
    return {
      success: false,
      error: "That request could not be identified. Reload and try again.",
    };
  }

  const parsed = parseAmountMinor(formData.get("amountDollars"));

  if (!parsed.ok) {
    return { success: false, error: parsed.error };
  }

  let result;

  try {
    const creator = await getCreator();

    result = await createPayoutRequest(prisma, {
      creatorId: creator.id,
      amountMinor: parsed.amountMinor,
      idempotencyKey,
    });
  } catch (error) {
    console.error("requestPayout failed", error);
    return {
      success: false,
      // Reached when the retries are exhausted, which means the balance kept
      // moving underneath this request rather than anything being broken.
      error: "Your balance changed while we were processing. Try again.",
    };
  }

  if (result.kind === "overdrawn") {
    return { success: false, error: result.error };
  }

  revalidatePath("/wallet");

  // A duplicate is a success: the request the user asked for exists. Saying so
  // is what stops a double click from reading as a failure worth retrying.
  return {
    success: true,
    message:
      result.kind === "duplicate"
        ? `Already submitted. Your ${formatMinor(result.request.amountMinor)} request is pending.`
        : `Requested ${formatMinor(result.request.amountMinor)}. It is pending and the funds are on hold.`,
  };
}
