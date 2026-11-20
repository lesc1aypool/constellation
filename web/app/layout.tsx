import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
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
  title: "Constellation",
  description: "Explore music as a galaxy: every artist is a star, similar artists cluster together.",
};

export const viewport: Viewport = {
  themeColor: "#05060d",
  width: "device-width",
  initialScale: 1,
  // The galaxy handles pinch-zoom itself; stop the page from zooming too.
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
