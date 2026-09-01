import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Accounts",
};

export default function AccountsPage() {
  return (
    <>
      <h1 className="text-xl font-semibold">Connected accounts</h1>
      <p className="mt-2 text-muted">
        Channel list, connection state, and connect and disconnect actions land
        here in feature 3.
      </p>
    </>
  );
}
