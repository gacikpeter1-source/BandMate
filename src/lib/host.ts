// Which address the app is running on decides what it shows:
//  - the BandMate address itself (bandmate.shop, plus localhost and Vercel links) = the platform:
//    home page, BandMate admin, and every band reachable at /b/<bandId>
//  - <bandId>.bandmate.shop = that band's store (no setup needed per band: the first part IS the band id)
//  - any other address (a band's own domain) = the band named in the `domains` collection.
export const PLATFORM_HOST: string = import.meta.env.VITE_PLATFORM_HOST || "bandmate.shop";

// Names that can never be a band's address (they belong to BandMate itself).
export const RESERVED_BAND_IDS = ["www", "app", "admin", "api", "mail", "platform", "static", "assets", "cdn", "help", "support", "status", "docs", "blog", "login", "b"];

export function isPlatformHost(host: string = window.location.hostname) {
  return (
    host === PLATFORM_HOST ||
    host === `www.${PLATFORM_HOST}` ||
    host === "localhost" ||
    host === "127.0.0.1" ||
    host.endsWith(".vercel.app")
  );
}

/** "sawdust.bandmate.shop" -> "sawdust". Null for anything else (or a reserved name). */
export function subdomainBandId(host: string = window.location.hostname): string | null {
  const suffix = `.${PLATFORM_HOST}`;
  if (!host.endsWith(suffix)) return null;
  const label = host.slice(0, -suffix.length);
  return /^[a-z0-9]+(-[a-z0-9]+)*$/.test(label) && !RESERVED_BAND_IDS.includes(label) ? label : null;
}

/** Where the BandMate admin login lives (a different address when running on a band's own domain). */
export function platformAdminUrl() {
  const path = "/platform/login";
  return isPlatformHost() ? path : `https://${PLATFORM_HOST}${path}`;
}
