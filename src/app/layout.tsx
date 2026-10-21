import type { Metadata } from "next";
import { Fraunces, IBM_Plex_Sans } from "next/font/google";
import "./globals.css";

const ibmPlexSans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-ibm-plex-sans",
});

const fraunces = Fraunces({
  subsets: ["latin"],
  weight: ["500", "600"],
  variable: "--font-fraunces",
});

export const metadata: Metadata = {
  title: "Social72",
  description:
    "Social72 CRM and project management: onboard clients, projects and employees, run ad campaigns, calling and nurture, then track POs, expenses, invoices and profit.",
  icons: { icon: "/social72-logo.png" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${ibmPlexSans.variable} ${fraunces.variable} antialiased`}>
        {children}
      </body>
    </html>
  );
}
