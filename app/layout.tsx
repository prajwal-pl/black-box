import type { Metadata } from "next";
import { Saira_Condensed, Poppins, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";
import { ThemeProvider } from "@/components/themes/theme-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ClientProvider } from "@/components/providers/client-provider";
import { Toaster } from "@/components/ui/sonner";

const displayFont = Saira_Condensed({
  subsets: ["latin"],
  variable: "--font-display",
  weight: ["400"],
});

const sansBodyFont = Poppins({
  subsets: ["latin"],
  variable: "--font-sans-body",
  weight: ["300", "400", "500", "600", "700"],
});

const monoFont = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  weight: ["400"],
});

export const metadata: Metadata = {
  title: "BlackBox // AI Investigation OS",
  description: "Austere luxury intelligence interface for case analysis and evidence processing.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={cn(
        "h-full antialiased dark",
        displayFont.variable,
        sansBodyFont.variable,
        monoFont.variable
      )}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col bg-black text-white selection:bg-link selection:text-black">
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          forcedTheme="dark"
          enableSystem={false}
          disableTransitionOnChange
        >
          <ClientProvider>
            <TooltipProvider>
              {children}
            </TooltipProvider>
          </ClientProvider>
        </ThemeProvider>
        <Toaster />
      </body>
    </html>
  );
}
