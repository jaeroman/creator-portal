import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Wallet",
};

export default function WalletPage() {
  return (
    <>
      <h1 className="text-xl font-semibold">Wallet</h1>
      <p className="mt-2 text-muted">
        Balances and transaction history land here in feature 5, the payout
        request flow in feature 6.
      </p>
    </>
  );
}
