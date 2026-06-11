import type { MetadataRoute } from "next";
import { getGuideUrl, seoGuides } from "@/lib/seo-guides";

const siteUrl = normalizeOrigin(process.env.SITE_URL || process.env.VERCEL_PROJECT_PRODUCTION_URL || "https://YOUR_PRODUCTION_DOMAIN");

export default function sitemap(): MetadataRoute.Sitemap {
  const staticRoutes = [
    "",
    "/llms.txt",
    "/pricing.md",
    "/toss",
    "/privacy",
    "/terms",
    "/responsible-use"
  ];

  return [
    ...staticRoutes.map((path) => ({
      url: `${siteUrl}${path}`,
      lastModified: new Date("2026-06-11"),
      changeFrequency: path === "" ? ("weekly" as const) : ("monthly" as const),
      priority: path === "" ? 1 : 0.7
    })),
    ...seoGuides.map((guide) => ({
      url: `${siteUrl}${getGuideUrl(guide.slug)}`,
      lastModified: new Date("2026-06-11"),
      changeFrequency: "monthly" as const,
      priority: 0.85
    }))
  ];
}

function normalizeOrigin(value: string) {
  if (!value) return "https://YOUR_PRODUCTION_DOMAIN";
  if (value.startsWith("http://") || value.startsWith("https://")) {
    return value.replace(/\/$/, "");
  }
  return `https://${value.replace(/\/$/, "")}`;
}
