import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Executive Intelligence Briefing | ARLP",
  description: "AI-powered materiality analysis for executive leadership",
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
