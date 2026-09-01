import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Posts",
};

export default function PostsPage() {
  return (
    <>
      <h1 className="text-xl font-semibold">Recent posts</h1>
      <p className="mt-2 text-muted">
        The unified feed across channels, with its channel filter, lands here in
        feature 4.
      </p>
    </>
  );
}
