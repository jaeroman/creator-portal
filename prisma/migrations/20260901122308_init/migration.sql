-- CreateEnum
CREATE TYPE "Platform" AS ENUM ('INSTAGRAM', 'YOUTUBE', 'TIKTOK', 'X');

-- CreateEnum
CREATE TYPE "ChannelStatus" AS ENUM ('CONNECTED', 'DISCONNECTED');

-- CreateEnum
CREATE TYPE "LedgerEntryType" AS ENUM ('EARNING_PENDING', 'EARNING_CLEARED', 'PAYOUT_HOLD', 'PAYOUT_HOLD_RELEASE', 'PAYOUT', 'ADJUSTMENT');

-- CreateEnum
CREATE TYPE "PayoutStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "Creator" (
    "id" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "handle" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Creator_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChannelAccount" (
    "id" TEXT NOT NULL,
    "creatorId" TEXT NOT NULL,
    "platform" "Platform" NOT NULL,
    "handle" TEXT NOT NULL,
    "status" "ChannelStatus" NOT NULL,
    "followerCount" INTEGER NOT NULL,
    "lastSyncedAt" TIMESTAMP(3),

    CONSTRAINT "ChannelAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Post" (
    "id" TEXT NOT NULL,
    "channelAccountId" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "thumbnailUrl" TEXT,
    "postedAt" TIMESTAMP(3) NOT NULL,
    "viewCount" INTEGER NOT NULL,
    "likeCount" INTEGER NOT NULL,
    "commentCount" INTEGER NOT NULL,

    CONSTRAINT "Post_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LedgerEntry" (
    "id" TEXT NOT NULL,
    "creatorId" TEXT NOT NULL,
    "type" "LedgerEntryType" NOT NULL,
    "amountMinor" INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    "payoutRequestId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LedgerEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayoutRequest" (
    "id" TEXT NOT NULL,
    "creatorId" TEXT NOT NULL,
    "amountMinor" INTEGER NOT NULL,
    "status" "PayoutStatus" NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decidedAt" TIMESTAMP(3),
    "decisionNote" TEXT,

    CONSTRAINT "PayoutRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Creator_handle_key" ON "Creator"("handle");

-- CreateIndex
CREATE UNIQUE INDEX "ChannelAccount_creatorId_platform_key" ON "ChannelAccount"("creatorId", "platform");

-- CreateIndex
CREATE INDEX "Post_channelAccountId_postedAt_idx" ON "Post"("channelAccountId", "postedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Post_channelAccountId_externalId_key" ON "Post"("channelAccountId", "externalId");

-- CreateIndex
CREATE INDEX "LedgerEntry_creatorId_createdAt_idx" ON "LedgerEntry"("creatorId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "PayoutRequest_idempotencyKey_key" ON "PayoutRequest"("idempotencyKey");

-- AddForeignKey
ALTER TABLE "ChannelAccount" ADD CONSTRAINT "ChannelAccount_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "Creator"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Post" ADD CONSTRAINT "Post_channelAccountId_fkey" FOREIGN KEY ("channelAccountId") REFERENCES "ChannelAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LedgerEntry" ADD CONSTRAINT "LedgerEntry_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "Creator"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LedgerEntry" ADD CONSTRAINT "LedgerEntry_payoutRequestId_fkey" FOREIGN KEY ("payoutRequestId") REFERENCES "PayoutRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayoutRequest" ADD CONSTRAINT "PayoutRequest_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "Creator"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
