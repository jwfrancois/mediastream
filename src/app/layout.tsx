import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";

const inter = Inter({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "MediaStream — Your Media, Everywhere",
  description: "A self-hosted media streaming platform for movies, TV shows, music, podcasts, and audiobooks. Scan your libraries and stream anywhere.",
  keywords: ["media streaming", "plex", "jellyfin", "netflix", "spotify", "audible", "self-hosted"],
  authors: [{ name: "MediaStream" }],
  icons: {
    icon: "/logo.svg",
  },
  openGraph: {
    title: "MediaStream",
    description: "Your media, everywhere. Movies, TV, music, podcasts, audiobooks.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning className="dark">
      <body
        className={`${inter.variable} antialiased bg-background text-foreground`}
        suppressHydrationWarning
      >
        {children}
        <Toaster />
        <Sonner position="bottom-right" theme="dark" />
      </body>
    </html>
  );
}
