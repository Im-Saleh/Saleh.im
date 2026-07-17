import type { MetadataRoute } from "next";

const siteUrl = "https://saleh.im";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // The live edge lookup is dynamic & uncacheable — no value to crawlers.
        disallow: ["/api/"],
      },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
    host: siteUrl,
  };
}
