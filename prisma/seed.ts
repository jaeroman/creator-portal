import {
  ChannelStatus,
  LedgerEntryType,
  PayoutStatus,
  Platform,
} from "@/lib/generated/prisma/enums";
import { prisma } from "@/lib/prisma";

const CREATOR = {
  displayName: "Maya Rivera",
  handle: "mayarivera",
};

const CHANNELS = [
  {
    platform: Platform.YOUTUBE,
    handle: "@mayariveratv",
    status: ChannelStatus.CONNECTED,
    followerCount: 342_000,
    lastSyncedAt: new Date("2026-08-31T06:12:00Z"),
  },
  {
    platform: Platform.TIKTOK,
    handle: "@maya.rivera",
    status: ChannelStatus.CONNECTED,
    followerCount: 512_300,
    lastSyncedAt: new Date("2026-08-31T06:14:00Z"),
  },
  {
    platform: Platform.INSTAGRAM,
    handle: "@mayarivera",
    status: ChannelStatus.CONNECTED,
    followerCount: 128_400,
    lastSyncedAt: new Date("2026-08-29T21:40:00Z"),
  },
  {
    // Never connected, so it has no sync time and no posts.
    platform: Platform.X,
    handle: "@mayarivera",
    status: ChannelStatus.DISCONNECTED,
    followerCount: 41_200,
    lastSyncedAt: null,
  },
];

const THUMBNAILS: Record<Platform, string> = {
  [Platform.YOUTUBE]: "/thumbnails/youtube.svg",
  [Platform.TIKTOK]: "/thumbnails/tiktok.svg",
  [Platform.INSTAGRAM]: "/thumbnails/instagram.svg",
  [Platform.X]: "/thumbnails/x.svg",
};

type SeedPost = {
  platform: Platform;
  externalId: string;
  title: string;
  postedAt: string;
  viewCount: number;
  likeCount: number;
  commentCount: number;
  /// Left out so the nullable thumbnail path is exercised.
  noThumbnail?: true;
};

const POSTS: SeedPost[] = [
  {
    platform: Platform.YOUTUBE,
    externalId: "yt_7Hq2LbW",
    title: "I rebuilt my whole studio for under $2,000",
    postedAt: "2026-08-28T16:00:00Z",
    viewCount: 412_880,
    likeCount: 31_204,
    commentCount: 1_842,
  },
  {
    platform: Platform.YOUTUBE,
    externalId: "yt_3Kd9Rmp",
    title: "Answering the questions you keep asking about sponsorships",
    postedAt: "2026-08-14T17:30:00Z",
    viewCount: 188_402,
    likeCount: 14_907,
    commentCount: 2_311,
  },
  {
    platform: Platform.YOUTUBE,
    externalId: "yt_1Zc4Nvx",
    title: "A week of shooting on one lens",
    postedAt: "2026-07-31T15:15:00Z",
    viewCount: 96_540,
    likeCount: 8_113,
    commentCount: 604,
  },
  {
    platform: Platform.YOUTUBE,
    externalId: "yt_8Tf6Qba",
    title: "The editing habit that saved me ten hours a week",
    postedAt: "2026-07-09T18:45:00Z",
    viewCount: 271_009,
    likeCount: 22_486,
    commentCount: 1_197,
    noThumbnail: true,
  },
  {
    platform: Platform.TIKTOK,
    externalId: "tt_902114558",
    title: "Three lighting mistakes I made for two years",
    postedAt: "2026-08-30T12:05:00Z",
    viewCount: 1_204_330,
    likeCount: 187_902,
    commentCount: 3_408,
  },
  {
    platform: Platform.TIKTOK,
    externalId: "tt_902110447",
    title: "Reading my worst brand pitch out loud",
    postedAt: "2026-08-22T19:20:00Z",
    viewCount: 862_115,
    likeCount: 121_440,
    commentCount: 5_902,
  },
  {
    platform: Platform.TIKTOK,
    externalId: "tt_902104219",
    title: "What a rate card actually looks like",
    postedAt: "2026-08-11T13:40:00Z",
    viewCount: 448_207,
    likeCount: 63_118,
    commentCount: 1_744,
  },
  {
    platform: Platform.TIKTOK,
    externalId: "tt_902098766",
    title: "Packing one bag for a four day shoot",
    postedAt: "2026-07-24T11:10:00Z",
    viewCount: 233_806,
    likeCount: 29_450,
    commentCount: 812,
  },
  {
    platform: Platform.TIKTOK,
    externalId: "tt_902090133",
    title: "Storyboarding on a napkin, seriously",
    postedAt: "2026-06-30T14:55:00Z",
    viewCount: 155_902,
    likeCount: 18_733,
    commentCount: 501,
    noThumbnail: true,
  },
  {
    platform: Platform.INSTAGRAM,
    externalId: "ig_C9xLm2QpR",
    title: "Behind the scenes from the studio rebuild",
    postedAt: "2026-08-27T09:25:00Z",
    viewCount: 74_318,
    likeCount: 9_902,
    commentCount: 288,
  },
  {
    platform: Platform.INSTAGRAM,
    externalId: "ig_C8vKp1NdT",
    title: "Carousel: my five favourite frames this month",
    postedAt: "2026-08-06T08:00:00Z",
    viewCount: 51_774,
    likeCount: 6_431,
    commentCount: 173,
  },
  {
    platform: Platform.INSTAGRAM,
    externalId: "ig_C7tJn0MbS",
    title: "Sunrise shoot, no alarm needed",
    postedAt: "2026-07-18T07:15:00Z",
    viewCount: 38_209,
    likeCount: 4_887,
    commentCount: 96,
  },
];

// One decided request, so the wallet has real history before feature 6 adds a
// live one. Its three ledger rows net to the negative payout.
const HISTORIC_PAYOUT = {
  amountMinor: 44_000,
  status: PayoutStatus.APPROVED,
  idempotencyKey: "seed-2026-07-payout",
  createdAt: new Date("2026-07-15T10:00:00Z"),
  decidedAt: new Date("2026-07-17T14:30:00Z"),
  decisionNote: "Approved by agency finance.",
};

type SeedLedgerEntry = {
  type: LedgerEntryType;
  amountMinor: number;
  description: string;
  createdAt: string;
};

// Cleared and pending earnings, plus the one ADJUSTMENT row that keeps the enum
// honest. Summed with the payout triple below these give the fixed totals the
// spec locks: pending 34000, available 128450.
const EARNINGS: SeedLedgerEntry[] = [
  {
    type: LedgerEntryType.EARNING_CLEARED,
    amountMinor: 42_500,
    description: "Brand deal: Aurora Optics, video integration",
    createdAt: "2026-06-05T09:00:00Z",
  },
  {
    type: LedgerEntryType.EARNING_CLEARED,
    amountMinor: 38_900,
    description: "Platform revenue share, May",
    createdAt: "2026-06-12T09:00:00Z",
  },
  {
    type: LedgerEntryType.EARNING_CLEARED,
    amountMinor: 51_200,
    description: "Brand deal: Halden Coffee, three post series",
    createdAt: "2026-07-02T09:00:00Z",
  },
  {
    type: LedgerEntryType.EARNING_CLEARED,
    amountMinor: 29_750,
    description: "Platform revenue share, June",
    createdAt: "2026-07-12T09:00:00Z",
  },
  {
    type: LedgerEntryType.EARNING_CLEARED,
    amountMinor: 8_600,
    description: "Affiliate payout, July",
    createdAt: "2026-08-04T09:00:00Z",
  },
  {
    type: LedgerEntryType.ADJUSTMENT,
    amountMinor: 1_500,
    description: "Correction: under-reported affiliate clicks, July",
    createdAt: "2026-08-06T11:20:00Z",
  },
  {
    type: LedgerEntryType.EARNING_PENDING,
    amountMinor: 18_500,
    description: "Brand deal: Northbound Bags, pending 30 day hold",
    createdAt: "2026-08-18T09:00:00Z",
  },
  {
    type: LedgerEntryType.EARNING_PENDING,
    amountMinor: 15_500,
    description: "Platform revenue share, August, not yet cleared",
    createdAt: "2026-08-29T09:00:00Z",
  },
];

async function reset() {
  // FK-safe order: ledger references payout requests, posts reference channels,
  // and everything references the creator.
  await prisma.ledgerEntry.deleteMany();
  await prisma.payoutRequest.deleteMany();
  await prisma.post.deleteMany();
  await prisma.channelAccount.deleteMany();
  await prisma.creator.deleteMany();
}

async function main() {
  await reset();

  const creator = await prisma.creator.create({ data: CREATOR });

  const channelIdByPlatform = new Map<Platform, string>();
  for (const channel of CHANNELS) {
    const created = await prisma.channelAccount.create({
      data: { ...channel, creatorId: creator.id },
    });
    channelIdByPlatform.set(created.platform, created.id);
  }

  await prisma.post.createMany({
    data: POSTS.map((post) => {
      const channelAccountId = channelIdByPlatform.get(post.platform);
      if (!channelAccountId) {
        throw new Error(`Seed post ${post.externalId} has no seeded channel.`);
      }
      return {
        channelAccountId,
        externalId: post.externalId,
        title: post.title,
        thumbnailUrl: post.noThumbnail ? null : THUMBNAILS[post.platform],
        postedAt: new Date(post.postedAt),
        viewCount: post.viewCount,
        likeCount: post.likeCount,
        commentCount: post.commentCount,
      };
    }),
  });

  await seedLedger(creator.id);

  console.log(
    `Seeded ${await prisma.creator.count()} creator, ` +
      `${await prisma.channelAccount.count()} channels, ` +
      `${await prisma.post.count()} posts, ` +
      `${await prisma.ledgerEntry.count()} ledger entries.`,
  );
  await printBalances();
}

async function seedLedger(creatorId: string) {
  const payout = await prisma.payoutRequest.create({
    data: { ...HISTORIC_PAYOUT, creatorId },
  });

  await prisma.ledgerEntry.createMany({
    data: [
      ...EARNINGS.map((entry) => ({
        creatorId,
        type: entry.type,
        amountMinor: entry.amountMinor,
        description: entry.description,
        createdAt: new Date(entry.createdAt),
      })),
      {
        creatorId,
        payoutRequestId: payout.id,
        type: LedgerEntryType.PAYOUT_HOLD,
        amountMinor: -payout.amountMinor,
        description: "Held for payout request",
        createdAt: payout.createdAt,
      },
      {
        creatorId,
        payoutRequestId: payout.id,
        type: LedgerEntryType.PAYOUT_HOLD_RELEASE,
        amountMinor: payout.amountMinor,
        description: "Hold released on approval",
        createdAt: HISTORIC_PAYOUT.decidedAt,
      },
      {
        creatorId,
        payoutRequestId: payout.id,
        type: LedgerEntryType.PAYOUT,
        amountMinor: -payout.amountMinor,
        description: "Payout sent to bank account ending 4417",
        createdAt: HISTORIC_PAYOUT.decidedAt,
      },
    ],
  });
}

async function printBalances() {
  const pending = await prisma.ledgerEntry.aggregate({
    where: { type: LedgerEntryType.EARNING_PENDING },
    _sum: { amountMinor: true },
  });
  const available = await prisma.ledgerEntry.aggregate({
    where: { type: { not: LedgerEntryType.EARNING_PENDING } },
    _sum: { amountMinor: true },
  });

  console.log(`pendingEarnings:  ${pending._sum.amountMinor}`);
  console.log(`availableBalance: ${available._sum.amountMinor}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
