// Which address the app is running on decides what it shows:
//  - the BandMate address itself (and localhost, Vercel preview links) = the platform: home page,
//    BandMate admin, and every band reachable at /b/<bandId>
//  - any other address (bandname.yourapp.com or a band's own domain) = that band's store,
//    looked up in the `domains` collection.
export const PLATFORM_HOST: string = import.meta.env.VITE_PLATFORM_HOST || "band-mate-zeta.vercel.app";

export function isPlatformHost(host: string = window.location.hostname) {
  return host === PLATFORM_HOST || host === "localhost" || host === "127.0.0.1" || host.endsWith(".vercel.app");
}

/** Where the BandMate admin login lives (a different address when running on a band's own domain). */
export function platformAdminUrl() {
  const path = "/platform/login";
  return isPlatformHost() ? path : `https://${PLATFORM_HOST}${path}`;
}
