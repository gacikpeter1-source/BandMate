// Reads the text inside an uploaded QR picture (in the browser, nothing is sent anywhere), and checks payment links.

/** The text a QR picture contains, or null if none can be read (no code, blurry, or not a QR). */
export async function decodeQr(blob: Blob): Promise<string | null> {
  try {
    const bmp = await createImageBitmap(blob);
    const c = document.createElement("canvas");
    c.width = bmp.width;
    c.height = bmp.height;
    const ctx = c.getContext("2d", { willReadFrequently: true });
    if (!ctx) return null;
    ctx.drawImage(bmp, 0, 0);
    const { default: jsQR } = await import("jsqr"); // loaded only when a QR picture is uploaded
    return jsQR(ctx.getImageData(0, 0, c.width, c.height).data, c.width, c.height)?.data || null;
  } catch {
    return null;
  }
}

/** A payment link a fan may open: https only. "" = none given, null = not acceptable. */
export function cleanPayUrl(raw: string): string | null {
  const v = raw.trim();
  if (!v) return "";
  if (v.length > 500) return null;
  try {
    const u = new URL(v);
    return u.protocol === "https:" && u.hostname.includes(".") ? u.toString() : null;
  } catch {
    return null;
  }
}

export const hostOf = (url: string) => {
  try {
    return new URL(url).hostname;
  } catch {
    return "";
  }
};
