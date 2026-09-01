// Locale and time zone are pinned rather than left to the environment: these
// strings are produced on the server and shipped as HTML, so a client in
// another zone must not disagree with what was rendered.
const countFormatter = new Intl.NumberFormat("en-US");

const timestampFormatter = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "UTC",
});

export function formatCount(value: number): string {
  return countFormatter.format(value);
}

export function formatTimestamp(value: Date): string {
  return `${timestampFormatter.format(value)} UTC`;
}
