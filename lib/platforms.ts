import { Platform } from "@/lib/generated/prisma/enums";

// The enum values are storage identifiers, not labels. Feature 4's posts feed
// and channel filter read the same map, so labels are defined once here.
const PLATFORM_LABELS: Record<Platform, string> = {
  [Platform.YOUTUBE]: "YouTube",
  [Platform.TIKTOK]: "TikTok",
  [Platform.INSTAGRAM]: "Instagram",
  [Platform.X]: "X",
};

export function platformLabel(platform: Platform): string {
  return PLATFORM_LABELS[platform];
}
