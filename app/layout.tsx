import type { Metadata } from "next";
import { Inter, Manrope, Geist } from "next/font/google";
import { LanguageProvider } from "@/lib/i18n/language-context";
import { QueryProvider } from "@/lib/query-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";
import { cn } from "@/lib/utils";

const geist = Geist({subsets:['latin'],variable:'--font-sans'});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title:
    "CVR-MATE | Automatiseret B2B Lead Intelligence til Danske Virksomheder",
  description:
    "Få adgang til komplette virksomhedsdata, identificer nye virksomheder i realtid, og eksportér kvalificerede leads direkte til din salgsproces.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="da" className={cn("antialiased", inter.variable, manrope.variable, "font-sans", geist.variable)} suppressHydrationWarning>
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-full flex flex-col bg-background text-foreground" suppressHydrationWarning>
        <LanguageProvider>
          <QueryProvider>
            <TooltipProvider>
              {children}
            </TooltipProvider>
          </QueryProvider>
        </LanguageProvider>
        <Toaster richColors position="top-right" />
      </body>
    </html>
  );
}
