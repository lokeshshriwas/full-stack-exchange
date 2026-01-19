import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Appbar } from "./components/Appbar";
import { Providers } from "./Provider";
import { Toaster } from "react-hot-toast";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: {
    default: "Exchange Platform | Trade Crypto with Confidence",
    template: "%s | Exchange Platform",
  },
  description:
    "A modern cryptocurrency exchange platform for trading digital assets. Trade BTC, ETH, SOL and more with real-time orderbook, advanced charting, and secure wallet management.",
  keywords: [
    "cryptocurrency exchange",
    "crypto trading",
    "bitcoin",
    "ethereum",
    "solana",
    "orderbook",
    "trading platform",
    "digital assets",
    "USDC",
    "spot trading",
  ],
  authors: [{ name: "Lokesh Shriwas" }],
  creator: "Lokesh Shriwas",
  metadataBase: new URL("https://exchange.bylokesh.in"),
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://exchange.bylokesh.in",
    siteName: "Exchange Platform",
    title: "Exchange Platform | Trade Crypto with Confidence",
    description:
      "A modern cryptocurrency exchange platform for trading digital assets with real-time orderbook and advanced charting.",
    images: [
      {
        url: "/logo-dark.png",
        width: 1200,
        height: 630,
        alt: "Exchange Platform",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Exchange Platform | Trade Crypto with Confidence",
    description:
      "A modern cryptocurrency exchange platform for trading digital assets.",
    images: ["/logo-dark.png"],
  },
  robots: {
    index: true,
    follow: true,
  },
  icons: {
    icon: "/favicon.ico",
    apple: "/logo-dark.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.className} overflow-x-hidden`}>
        <Providers>
          <div className="pb-2">
            <Appbar />
          </div>
          <div className="mt-2">
            {children}
            <Toaster position="top-center" />
          </div>
        </Providers>
      </body>
    </html>
  );
}
