import type { MetadataRoute } from "next";
import { CATEGORIES } from "@/lib/config";
import { SITE } from "@/lib/site";

/*
  Every page is public; the API and the scheduled work are not for crawlers,
  and neither are filtered views. A query string on any page is a view of
  that page, and /agents alone has a dozen filters whose combinations are
  endless: crawlers walking them were most of the site's hosting bill (19 Oct).
  The four job pages stay crawlable, by their exact address.
*/
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", ...CATEGORIES.map((c) => `/agents?category=${c}$`)],
        disallow: ["/api/", "/_next/", "/*?"],
      },
    ],
    sitemap: `${SITE}/sitemap.xml`,
    host: SITE,
  };
}
