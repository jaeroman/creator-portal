"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [
  { href: "/accounts", label: "Accounts" },
  { href: "/posts", label: "Posts" },
  { href: "/wallet", label: "Wallet" },
] as const;

export default function PortalNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Portal" className="border-b border-border bg-surface">
      <ul className="mx-auto flex w-full max-w-5xl gap-1 px-6">
        {ITEMS.map((item) => {
          const isActive = pathname === item.href;

          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={isActive ? "page" : undefined}
                // Weight and the bottom rule carry the active state, so it
                // survives without color.
                className={`-mb-px inline-block border-b-2 px-3 py-3 text-sm focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-accent ${
                  isActive
                    ? "border-accent font-semibold text-foreground"
                    : "border-transparent font-normal text-muted hover:text-foreground"
                }`}
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
