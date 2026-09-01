import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Posts",
};

export default function PostsPage() {
  return (
    <>
      <h1 className="text-xl font-semibold">Recent posts</h1>
    </>
  );
}
