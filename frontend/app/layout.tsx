import type { Metadata } from "next";
import { Be_Vietnam_Pro } from "next/font/google";
import "./globals.css";

const vietnameseSans = Be_Vietnam_Pro({
  variable: "--font-vietnamese-sans",
  subsets: ["latin", "vietnamese"],
  weight: ["400", "500", "600", "700", "800", "900"],
});

export const metadata: Metadata = {
  title: "Maycha Menu",
  description: "Coffee ordering UI",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="vi"
      className={`${vietnameseSans.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-[#f3f3f3]">{children}</body>
    </html>
  );
}
