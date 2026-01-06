import type { Metadata } from "next";
import "./globals.css";
import ToastProvider from "@/components/ToastProvider";
import { AuthProvider } from "@/contexts/AuthContext";
import ActivityTracker from "@/components/ActivityTracker";

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
        <AuthProvider>
          <ToastProvider />
          <ActivityTracker />
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
