import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";

export const metadata: Metadata = {
  title: "Imperial Limousine | New York Luxury Transportation",
  description: "Imperial Limousine luxury transportation services in New York.",
  icons: {
    icon: "/images/logo2.png",
    shortcut: "/images/logo2.png",
    apple: "/images/logo2.png",
  },
};

export const viewport = {
  width: "device-width" as const,
  initialScale: 1,
  themeColor: "#050505",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        {/* Google tag (gtag.js) — loads on every page */}
        <Script
          src="https://www.googletagmanager.com/gtag/js?id=AW-18321442697"
          strategy="afterInteractive"
        />
        <Script id="google-gtag" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', 'AW-18321442697');
          `}
        </Script>
        {children}
      </body>
    </html>
  );
}
