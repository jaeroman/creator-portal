"use server";

import { revalidatePath } from "next/cache";
import { ChannelStatus } from "@/lib/generated/prisma/enums";
import { getCreator } from "@/lib/creator";
import { prisma } from "@/lib/prisma";

export type ChannelActionState =
  | { success: true }
  | { success: false; error: string }
  | null;

const INTENTS = ["connect", "disconnect"] as const;
type Intent = (typeof INTENTS)[number];

function isIntent(value: unknown): value is Intent {
  return typeof value === "string" && INTENTS.includes(value as Intent);
}

// Connecting and disconnecting are stand-ins for a real OAuth handshake: they
// flip stored state and, on connect, stamp a sync time. See project-plan
// section 9.
export async function setChannelConnection(
  _prevState: ChannelActionState,
  formData: FormData,
): Promise<ChannelActionState> {
  const channelId = formData.get("channelId");
  const intent = formData.get("intent");

  if (typeof channelId !== "string" || channelId.length === 0) {
    return { success: false, error: "That channel could not be identified." };
  }

  if (!isIntent(intent)) {
    return { success: false, error: "That action is not supported." };
  }

  const connecting = intent === "connect";

  try {
    const creator = await getCreator();

    // The expected current status is part of the where clause, so a double
    // submit updates one row and the loser reports a conflict instead of
    // silently restamping lastSyncedAt.
    const { count } = await prisma.channelAccount.updateMany({
      where: {
        id: channelId,
        creatorId: creator.id,
        status: connecting
          ? ChannelStatus.DISCONNECTED
          : ChannelStatus.CONNECTED,
      },
      data: connecting
        ? { status: ChannelStatus.CONNECTED, lastSyncedAt: new Date() }
        : { status: ChannelStatus.DISCONNECTED },
    });

    if (count === 0) {
      // Zero rows means either a stale page or an id this creator does not own,
      // and the two deserve different messages. Only the failure path pays for
      // the extra read.
      const exists = await prisma.channelAccount.findFirst({
        where: { id: channelId, creatorId: creator.id },
        select: { id: true },
      });

      if (!exists) {
        return { success: false, error: "That channel could not be found." };
      }

      return {
        success: false,
        error: connecting
          ? "That channel is already connected. Reload to see its current state."
          : "That channel is already disconnected. Reload to see its current state.",
      };
    }
  } catch (error) {
    console.error("setChannelConnection failed", error);
    return {
      success: false,
      error: "Something went wrong updating that channel. Try again.",
    };
  }

  revalidatePath("/accounts");
  return { success: true };
}
