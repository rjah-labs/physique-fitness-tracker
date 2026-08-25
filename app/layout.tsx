import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Physique — Fitness Tracker",
  description: "A focused, private fitness tracker for body measurements, workouts and goals.",
  manifest: "./manifest.webmanifest",
  icons: {
    icon: "./favicon.svg",
    shortcut: "./favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en"><head><meta name="theme-color" content="#151714"/><meta name="apple-mobile-web-app-capable" content="yes"/><meta name="apple-mobile-web-app-status-bar-style" content="black-translucent"/><link rel="apple-touch-icon" href="./icon-192.png"/></head>
      <body>{children}</body>
    </html>
  );
}
