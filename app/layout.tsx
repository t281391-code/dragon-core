import type { Metadata } from "next";
import { JetBrains_Mono, Manrope, Orbitron, Syne } from "next/font/google";
import "./globals.css";
import "./landing-ui.css";

const syne = Syne({
  subsets: ["latin"],
  variable: "--font-syne",
  weight: ["400", "500", "600", "700", "800"],
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  weight: ["400", "500", "600"],
});

const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-manrope",
  display: "swap",
});

const orbitron = Orbitron({
  subsets: ["latin"],
  variable: "--font-orbitron",
  display: "swap",
});

export const metadata: Metadata = {
  title: "EXPLO-KPI · Тэсрэх бодисын үйлдвэр",
  description: "KPI Dashboard · Тэсрэх бодисын үйлдвэрийн удирдлагын систем",
  icons: {
    icon: [{ url: "/favicon.ico?v=20260504", sizes: "16x16 32x32 48x48", type: "image/x-icon" }],
    shortcut: [{ url: "/favicon.ico?v=20260504", type: "image/x-icon" }],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="mn">
      <body
        className={`${syne.variable} ${jetbrainsMono.variable} ${manrope.variable} ${orbitron.variable} theme-light`}
        suppressHydrationWarning
      >
        {children}
      </body>
    </html>
  );
}
