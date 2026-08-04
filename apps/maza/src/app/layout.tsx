import type { Metadata, Viewport } from "next";
import { Fraunces, Instrument_Sans } from "next/font/google";
import "./globals.css";

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  // Fraunces é variable font: com `axes` definido, next/font exige weight
  // "variable" (eixo wght completo) — array de pesos quebra o build.
  axes: ["SOFT", "WONK", "opsz"],
  weight: "variable",
  style: ["normal", "italic"],
  display: "swap",
});

const instrumentSans = Instrument_Sans({
  variable: "--font-instrument-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Maza",
  description: "Sistema operacional Maza.",
  manifest: "/manifest.json",
  // appleWebApp.capable=false impede iOS de oferecer "Add to Home Screen"
  // como app standalone — homescreen vira bookmark Safari, mantendo
  // localStorage compartilhado e sessão Supabase persistente.
  // (PWA standalone tem storage isolado que quebra @supabase/ssr.)
  appleWebApp: {
    capable: false,
    title: "Maza Ponto",
  },
};

export const viewport: Viewport = {
  themeColor: "#1A1A1A",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="pt-BR"
      className={`dark ${fraunces.variable} ${instrumentSans.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-background text-foreground flex flex-col">
        {children}
      </body>
    </html>
  );
}
