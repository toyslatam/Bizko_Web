import type { Metadata } from "next";
import { Poppins, Inter } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";

const poppins = Poppins({
  variable: "--font-heading",
  subsets: ["latin"],
  weight: ["600", "700"],
});

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "bizko — Tu negocio, inteligente",
  description:
    "La plataforma para administrar tu negocio: ventas, pedidos, inventario y clientes en un solo lugar.",
  icons: {
    icon: "/files/app_icon.svg",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="es"
      className={`${poppins.variable} ${inter.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col font-sans">
        <TooltipProvider delayDuration={200}>
          {children}
          <Toaster position="top-center" richColors />
        </TooltipProvider>
      </body>
    </html>
  );
}
