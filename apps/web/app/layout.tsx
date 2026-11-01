import type { Metadata, Viewport } from "next";
import { Be_Vietnam_Pro, Bricolage_Grotesque } from "next/font/google";
import "./globals.css";
import { CartProvider } from "../lib/cart";

const vietnameseSans = Be_Vietnam_Pro({
  variable: "--font-vietnamese-sans",
  subsets: ["latin", "vietnamese"],
  weight: ["400", "500", "600", "700"],
});

/** Chữ tiêu đề: tên món, mã đơn, số tiền lớn. */
const display = Bricolage_Grotesque({
  variable: "--font-bricolage",
  subsets: ["latin", "vietnamese"],
  weight: ["500", "700", "800"],
});

export const metadata: Metadata = {
  title: "Maycha – Đặt trà & cà phê",
  description: "Chọn món, tuỳ chỉnh size, topping và thanh toán không tiền mặt tại Maycha.",
};

export const viewport: Viewport = {
  themeColor: "#2d5a3a",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="vi"
      className={`${vietnameseSans.variable} ${display.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col bg-sage text-ink">
        <CartProvider>{children}</CartProvider>
      </body>
    </html>
  );
}
