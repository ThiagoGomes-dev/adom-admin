import type { Metadata } from "next";
import { Jost, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

// Mesmas fontes do site da loja: Jost nos títulos, Plus Jakarta Sans no texto.
const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
});

const jost = Jost({
  variable: "--font-jost",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "ADOM — Painel Administrativo",
  description: "Gestão de produtos e estoque da ADOM.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="pt-BR"
      className={`${jakarta.variable} ${jost.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col font-sans">{children}</body>
    </html>
  );
}
