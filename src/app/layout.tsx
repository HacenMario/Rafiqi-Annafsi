import type { Metadata, Viewport } from "next";
import { Cairo, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { Providers } from "@/components/providers";

const cairo = Cairo({
  variable: "--font-cairo",
  subsets: ["arabic", "latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "رفيقي النفسي — منصة الدعم النفسي لضحايا الكوارث | الجزائر",
  description:
    "منصة جزائرية مجانية وسرية تربط المتضررين نفسياً بأخصائيين موثّقين عبر محادثة نصية وصوتية ومرئية. هوية محمية، ثلاث لغات، متاحة على هاتفك وحاسوبك.",
  keywords: [
    "الدعم النفسي",
    "الجزائر",
    "حرائق",
    "ضحايا الكوارث",
    "استشارة نفسية",
    "psychological support Algeria",
    "soutien psychologique Algérie",
  ],
  applicationName: "رفيقي النفسي",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/favicon.png", sizes: "64x64", type: "image/png" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: "/icons/icon-192.png",
  },
  openGraph: {
    title: "رفيقي النفسي — بعد الصدمة النفسية، لسنا بحاجة أن نتعافى وحدنا",
    description:
      "استشارات نفسية مجانية وسرية عبر النص والصوت والفيديو مع أخصائيين موثّقين — لأهالي الجزائر المتضررين من الكوارث.",
    type: "website",
    locale: "ar_DZ",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "رفيقي",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#0d9488" },
    { media: "(prefers-color-scheme: dark)", color: "#0f2a23" },
  ],
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ar" dir="rtl" suppressHydrationWarning>
      <body className={`${cairo.variable} ${geistMono.variable} antialiased bg-background text-foreground`}>
        <Providers>
          {children}
          <Toaster />
        </Providers>
      </body>
    </html>
  );
}
