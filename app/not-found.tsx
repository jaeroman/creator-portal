import Link from "next/link";

export default function NotFound() {
  return (
    <>
      <h1 className="text-xl font-semibold">Page not found</h1>
      <p className="mt-2 text-muted">
        That route is not part of the portal.
      </p>
      <Link
        href="/accounts"
        className="mt-4 inline-block text-sm text-accent underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        Go to connected accounts
      </Link>
    </>
  );
}
