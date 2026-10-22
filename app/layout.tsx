import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Chattrn Commerce — Store & ERP",
  description: "One connected workspace for your storefront, products, inventory and orders.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
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
