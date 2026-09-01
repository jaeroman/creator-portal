"use server";

import { revalidatePath } from "next/cache";
import { getCreator } from "@/lib/creator";
import { formatMinor } from "@/lib/format";
import { PayoutStatus } from "@/lib/generated/prisma/enums";
import {
  createPayoutRequest,
  decidePayoutRequest,
  parseAmountMinor,
  parseDecision,
} from "@/lib/payout";
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

export async function decidePayout(
  _prevState: PayoutActionState,
  formData: FormData,
): Promise<PayoutActionState> {
  const payoutRequestId = formData.get("payoutRequestId");

  if (typeof payoutRequestId !== "string" || payoutRequestId.length === 0) {
    return {
      success: false,
      error: "That request could not be identified. Reload and try again.",
    };
  }

  const decision = parseDecision(formData.get("decision"));

  if (!decision) {
    return { success: false, error: "That decision is not supported." };
  }

  let result;

  try {
    const creator = await getCreator();

    result = await decidePayoutRequest(prisma, {
      creatorId: creator.id,
      payoutRequestId,
      decision,
    });
  } catch (error) {
    console.error("decidePayout failed", error);
    return {
      success: false,
      error: "Something went wrong recording that decision. Try again.",
    };
  }

  if (result.kind === "not-found") {
    return { success: false, error: "That request could not be found." };
  }

  // Deliberately does not name the status it found. The words for a status live
  // in one labels map on the wallet page, and a second copy here to fill in one
  // sentence would be the kind of duplication that drifts.
  if (result.kind === "already-decided") {
    return {
      success: false,
      error:
        "That request was already decided. Reload to see its current state.",
    };
  }

  revalidatePath("/wallet");

  return {
    success: true,
    message:
      result.decision === PayoutStatus.APPROVED
        ? `Approved ${formatMinor(result.amountMinor)}. The hold is released and the payout is recorded.`
        : `Rejected ${formatMinor(result.amountMinor)}. The funds are back in the available balance.`,
  };
}
