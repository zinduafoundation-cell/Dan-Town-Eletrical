import type { MetadataRoute } from "next";export default function robots() : MetadataRoute.Robots {return {rules : {userAgent : "*",allow : "/",disallow : ["/api/", "/account/", "/business", "/business-center", "/centre", "/admin/", "/staff/", "/pos/"]},sitemap : "https://www.dantownelectrical.co.ke/sitemap.xml"};
}
