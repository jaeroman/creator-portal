import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import PortalHeader from "@/components/shell/PortalHeader";
import PortalNav from "@/components/shell/PortalNav";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Creator Portal",
    template: "%s - Creator Portal",
  },
  description:
    "Connected channels, recent posts, and wallet for a creator signed to a talent agency.",
};

// Every surface reads live portal data, and feature 6 will mutate it, so the
// shell renders per request instead of baking the database into the build.
export const dynamic = "force-dynamic";

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <PortalHeader />
        <PortalNav />
        <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-8">
          {children}
        </main>
      </body>
    </html>
  );
}
