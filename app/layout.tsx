import type { Metadata } from "next";
import "./globals.css";
import ToastProvider from "@/components/ToastProvider";

export const metadata: Metadata = {
  title: "Naví Belle - Studio de Beleza",
  description: "Naví Belle - Studio de Beleza. Sistema completo de gestão: agenda, clientes, colaboradoras, lançamentos e relatórios financeiros",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body className="antialiased">
        <ToastProvider />
        {children}
      </body>
    </html>
  );
}
