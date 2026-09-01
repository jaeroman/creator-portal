import { cache } from "react";
import type { Creator } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/prisma";

// The portal has exactly one creator and no auth, so every surface resolves it
// here on the server. Nothing takes a creator id from the client.
export const getCreator = cache(async (): Promise<Creator> => {
  const creator = await prisma.creator.findFirst({
    orderBy: { createdAt: "asc" },
  });

  if (!creator) {
    throw new Error(
      "No creator found. Run `npm run db:seed` to populate the portal.",
    );
  }

  return creator;
});
