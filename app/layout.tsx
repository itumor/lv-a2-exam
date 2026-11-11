import type { Metadata, Viewport } from "next";
import { Nunito } from "next/font/google";
import { PRODUCT_NAME } from "@/lib/config";
import "./globals.css";

// latin-ext is required for Latvian: ā č ē ģ ī ķ ļ ņ š ū ž
const nunito = Nunito({
  subsets: ["latin", "latin-ext"],
  weight: ["500", "700", "800", "900"],
  variable: "--font-nunito",
});

export const metadata: Metadata = {
  title: PRODUCT_NAME,
  description: "Latvian A2 exam practice. Independent from VIAA; scores are AI practice estimates.",
};

export const viewport: Viewport = { themeColor: "#5A3FD6" };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${nunito.variable} h-full antialiased`}>
      <body className="flex min-h-dvh flex-col font-sans">{children}</body>
    </html>
  );
}
