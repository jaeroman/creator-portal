// Locale and time zone are pinned rather than left to the environment: these
// strings are produced on the server and shipped as HTML, so a client in
// another zone must not disagree with what was rendered.
const countFormatter = new Intl.NumberFormat("en-US");

const timestampFormatter = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "UTC",
});

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeZone: "UTC",
});

export function formatCount(value: number): string {
  return countFormatter.format(value);
}

// Money never leaves integer arithmetic. Handing Intl a `minor / 100` float
// would derive the cents from a binary fraction; here the cents come from an
// exact modulo, and the dollars from dividing a value already known to be a
// multiple of 100, so neither can round.
export function formatMinor(amountMinor: number): string {
  const negative = amountMinor < 0;
  const absolute = Math.abs(amountMinor);
  const cents = absolute % 100;
  const dollars = (absolute - cents) / 100;

  return `${negative ? "-" : ""}$${countFormatter.format(dollars)}.${String(cents).padStart(2, "0")}`;
}

export function formatTimestamp(value: Date): string {
  return `${timestampFormatter.format(value)} UTC`;
}

export function formatDate(value: Date): string {
  return dateFormatter.format(value);
}
