import type { Metadata } from "next";
import { Archivo, Newsreader } from "next/font/google";
import "./globals.css";

const archivo = Archivo({
  variable: "--font-archivo",
  subsets: ["latin"],
  axes: ["wdth"],
});

const newsreader = Newsreader({
  variable: "--font-newsreader",
  subsets: ["latin"],
  axes: ["opsz"],
  style: ["normal", "italic"],
});

export const metadata: Metadata = {
  title: "TRM — The Realty Master",
  description:
    "New-launch homes explained stack by stack: 3D site models, floor plans, prices, payments, schools and investor analysis, presented by TRM — The Realty Master.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en-SG"
      className={`${archivo.variable} ${newsreader.variable} antialiased`}
    >
      <body>{children}</body>
    </html>
  );
}
