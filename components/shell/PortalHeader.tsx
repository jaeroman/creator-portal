import { getCreator } from "@/lib/creator";

export default async function PortalHeader() {
  const creator = await getCreator();

  return (
    <header className="border-b border-border bg-surface">
      <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4 px-6 py-4">
        <span className="text-sm font-semibold tracking-tight">
          Creator Portal
        </span>
        <div className="text-right">
          <div className="text-sm font-medium">{creator.displayName}</div>
          <div className="text-sm text-muted">@{creator.handle}</div>
        </div>
      </div>
    </header>
  );
}
