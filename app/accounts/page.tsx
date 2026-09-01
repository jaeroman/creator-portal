import type { Metadata } from "next";
import ChannelActionButton from "@/components/accounts/ChannelActionButton";
import { ChannelStatus } from "@/lib/generated/prisma/enums";
import { getCreator } from "@/lib/creator";
import { formatCount, formatTimestamp } from "@/lib/format";
import { platformLabel } from "@/lib/platforms";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = {
  title: "Accounts",
};

const CELL = "border-t border-border px-4 py-3 align-top";

export default async function AccountsPage() {
  const creator = await getCreator();
  const channels = await prisma.channelAccount.findMany({
    where: { creatorId: creator.id },
    orderBy: { followerCount: "desc" },
  });

  return (
    <>
      <h1 className="text-xl font-semibold">Connected accounts</h1>
      <p className="mt-2 text-muted">
        The channels linked to this portal, and what each one last reported.
      </p>

      {channels.length === 0 ? (
        <p className="mt-6 rounded border border-border bg-surface px-4 py-6 text-muted">
          No channels are linked to this account yet.
        </p>
      ) : (
        <div className="mt-6 overflow-x-auto rounded border border-border bg-surface">
          <table className="w-full border-collapse text-left text-sm">
            <caption className="sr-only">
              Linked channels, ordered by follower count
            </caption>
            <thead>
              <tr className="text-muted">
                <th scope="col" className="px-4 py-3 font-medium">
                  Channel
                </th>
                <th scope="col" className="px-4 py-3 font-medium">
                  Followers
                </th>
                <th scope="col" className="px-4 py-3 font-medium">
                  Status
                </th>
                <th scope="col" className="px-4 py-3 font-medium">
                  Last synced
                </th>
                <th scope="col" className="px-4 py-3 font-medium">
                  Action
                </th>
              </tr>
            </thead>
            <tbody>
              {channels.map((channel) => (
                <tr key={channel.id}>
                  <th scope="row" className={`${CELL} font-medium`}>
                    {platformLabel(channel.platform)}
                    <span className="block font-normal text-muted">
                      {channel.handle}
                    </span>
                  </th>
                  <td className={`${CELL} tabular-nums`}>
                    {formatCount(channel.followerCount)}
                  </td>
                  <td className={CELL}>
                    {channel.status === ChannelStatus.CONNECTED
                      ? "Connected"
                      : "Disconnected"}
                  </td>
                  <td className={`${CELL} whitespace-nowrap`}>
                    {channel.lastSyncedAt ? (
                      <time dateTime={channel.lastSyncedAt.toISOString()}>
                        {formatTimestamp(channel.lastSyncedAt)}
                      </time>
                    ) : (
                      <span className="text-muted">Never</span>
                    )}
                  </td>
                  <td className={CELL}>
                    <ChannelActionButton
                      channelId={channel.id}
                      channelLabel={platformLabel(channel.platform)}
                      isConnected={channel.status === ChannelStatus.CONNECTED}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="mt-4 text-muted">
        Connect and disconnect stand in for a real platform authorization. They
        update this portal&rsquo;s stored connection state and sync time; no
        account is contacted.
      </p>
    </>
  );
}
