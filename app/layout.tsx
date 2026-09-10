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
        <div id="widget-by-bookinglane" />
        <Script
          id="bookinglane-widget"
          src="https://bookinglane-widgets.s3.us-east-2.amazonaws.com/Widget/widget.js?token=31f2b325-c25a-4bc2-a798-cb1c179eca5d&lat=40.0393522&lng=-75.5997511"
          strategy="afterInteractive"
        />
      </body>
    </html>
  );
}
