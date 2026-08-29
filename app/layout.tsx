import type { Metadata, Viewport } from "next";
import { Space_Grotesk } from "next/font/google";

import { dealership } from "@/lib/content";
import { CLIP_ORIGIN } from "@/lib/shots";
import "./globals.css";

const geometric = Space_Grotesk({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-geometric",
  display: "swap",
});

export const metadata: Metadata = {
  title: `${dealership.name} — ${dealership.brandStatement}`,
  description: dealership.about.body,
  openGraph: {
    title: dealership.name,
    description: dealership.brandStatement,
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#040507",
  colorScheme: "dark",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={geometric.variable}>
      <head>
        {/*
          Open the connection to the clip host while the HTML is still being
          parsed. The film cannot ask for a clip until React has hydrated and
          mounted the video layer, and the DNS, TCP and TLS round trips it
          would then pay for are pure latency in front of the first frame.
        */}
        {CLIP_ORIGIN && (
          <>
            <link rel="preconnect" href={CLIP_ORIGIN} />
            <link rel="dns-prefetch" href={CLIP_ORIGIN} />
          </>
        )}
        {/*
          Without JavaScript the film never mounts, and the catalogue — which
          CSS now hides by default — would be the only content on the page and
          would be invisible. This puts it back.

          A <noscript> rather than a script that adds a class to <html>: that
          approach works, but React then sees the className it rendered and the
          one it finds as a hydration mismatch it "won't patch up", and
          suppressHydrationWarning does not cover it on <html> in App Router.
          Nothing here mutates anything React owns.
        */}
        <noscript>
          <style>{`.catalogue{position:static;width:auto;height:auto;margin:0;overflow:visible;clip:auto;white-space:normal}`}</style>
        </noscript>
      </head>
      <body>{children}</body>
    </html>
  );
}
