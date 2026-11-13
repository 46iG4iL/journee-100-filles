
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Journée 100% filles",
  description: "Vote pour élire la joueuse du match !",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
