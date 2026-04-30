import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "https://chattrail.netlify.app";
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // Authenticated app + API routes shouldn't be indexed.
        disallow: ["/dashboard", "/programs", "/learn", "/admin", "/org", "/api/", "/auth/"],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
  };
}
