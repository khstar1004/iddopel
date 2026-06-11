import type { MetadataRoute } from "next";

const siteUrl = normalizeOrigin(process.env.SITE_URL || process.env.VERCEL_PROJECT_PRODUCTION_URL || "https://YOUR_PRODUCTION_DOMAIN");

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/guides/", "/toss", "/privacy", "/terms", "/responsible-use"],
      disallow: ["/api/", "/checkout/", "/reports/"]
    },
    sitemap: `${siteUrl}/sitemap.xml`,
    host: siteUrl
  };
}

function normalizeOrigin(value: string) {
  if (!value) return "https://YOUR_PRODUCTION_DOMAIN";
  if (value.startsWith("http://") || value.startsWith("https://")) {
    return value.replace(/\/$/, "");
  }
  return `https://${value.replace(/\/$/, "")}`;
}
