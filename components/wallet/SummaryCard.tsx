type SummaryCardProps = {
  label: string;
  value: string;
  note: string;
};

export default function SummaryCard({ label, value, note }: SummaryCardProps) {
  return (
    <div className="rounded border border-border bg-surface px-4 py-4">
      <h2 className="text-sm font-medium text-muted">{label}</h2>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
      <p className="mt-2 text-sm text-muted">{note}</p>
    </div>
  );
}
