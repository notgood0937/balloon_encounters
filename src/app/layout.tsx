import type { Metadata, Viewport } from "next";
import "./globals.css";
import Providers from "@/components/Providers";
import ChunkLoadRecovery from "@/components/ChunkLoadRecovery";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://balloon-encounters.app";

export const viewport: Viewport = {
  viewportFit: "cover",
};

export const metadata: Metadata = {
  title: "Balloon Encounters — Interactive Social Drift Map",
  description:
    "Real-time social connection map with floating balloons. Share your stories, dreams, and market signals across the globe.",
  metadataBase: new URL(SITE_URL),
  openGraph: {
    title: "Balloon Encounters — Interactive Social Drift Map",
    description:
      "A real-time world map of human expressions and market signals. Connect through drifting balloons.",
    url: SITE_URL,
    siteName: "Balloon Encounters",
    type: "website",
    locale: "en_US",
    images: [{ url: "/opengraph-image", width: 1200, height: 630, alt: "Balloon Encounters — Interactive Social Map" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Balloon Encounters — Interactive Social Drift Map",
    description:
      "Share your thoughts on a real-time world map with drifting balloons. Discover communities through semantics.",
    images: ["/opengraph-image"],
  },
  robots: {
    index: true,
    follow: true,
  },
  icons: {
    icon: "/icon-192.png",
    apple: "/apple-touch-icon.png",
  },
  other: {
    "color-scheme": "dark",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className="dark"
      style={{ colorScheme: "dark" }}
      suppressHydrationWarning
    >
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Inter+Tight:wght@700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="antialiased">
        <ChunkLoadRecovery />
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
