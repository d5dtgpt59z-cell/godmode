import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "GODMODE — A small world. Its own ideas.",
  description: "A living pixel town of 24 individual inhabitants. Change a condition, follow a consequence, rewind and compare another afternoon.",
  icons: {
    icon: "/favicon-godmode.svg",
    shortcut: "/favicon-godmode.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
