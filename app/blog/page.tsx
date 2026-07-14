import type { Metadata } from "next";
import Script from "next/script";

export const metadata: Metadata = {
  title: "Blog | Imperial Limousine",
  description: "News, guides, and luxury transportation insights from Imperial Limousine.",
};

export default function BlogPage() {
  return (
    <main className="blog-page">
      <div className="container">
        <header className="blog-header">
          <span className="section-label">Imperial Limousine</span>
          <h1 className="section-title">
            Latest <em>Insights</em>
          </h1>
          <div className="divider"></div>
        </header>

        <div id="soro-blog" className="soro-blog-embed" />
        <Script
          id="soro-blog-script"
          src="https://app.trysoro.com/api/embed/184c2f24-88e1-4079-8097-00ad2400ad09?theme=dark"
          strategy="afterInteractive"
        />
      </div>
    </main>
  );
}
