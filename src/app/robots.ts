import type { MetadataRoute } from "next";
import { SITE } from "@/lib/site";

/** Every page is public; the API and the scheduled work are not for crawlers. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/api/", "/_next/"] }],
    sitemap: `${SITE}/sitemap.xml`,
    host: SITE,
  };
}
