import type { Metadata } from "next";
import { Fira_Code, Fira_Sans, STIX_Two_Text } from "next/font/google";
import { Providers } from "./providers";
import { SiteHeader } from "./_components/site-header";
import "./globals.css";

// STIX Two is the typeface scientific journals set papers in; Fira Sans is the Beamer "metropolis" face.
const stix = STIX_Two_Text({ variable: "--font-stix", subsets: ["latin"], style: ["normal", "italic"] });
const firaSans = Fira_Sans({ variable: "--font-fira-sans", subsets: ["latin"], weight: ["400", "500", "600"] });
const firaCode = Fira_Code({ variable: "--font-fira-code", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Paperscope: search AI research papers",
  description: "Search, discover and chat with AI research papers, powered by Meilisearch.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${stix.variable} ${firaSans.variable} ${firaCode.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col bg-background text-foreground">
        <Providers>
          <SiteHeader />
          {children}
        </Providers>
      </body>
    </html>
  );
}
