import { ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import { storage } from "../firebase";

async function resize(file: File, max: number, type: "image/png" | "image/webp"): Promise<Blob> {
  let bmp: ImageBitmap;
  try {
    bmp = await createImageBitmap(file);
  } catch {
    return file;
  }
  const scale = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const w = Math.round(bmp.width * scale);
  const h = Math.round(bmp.height * scale);
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d");
  if (!ctx) return file;
  ctx.drawImage(bmp, 0, 0, w, h);
  return new Promise((res) => c.toBlob((b) => res(b || file), type, 0.92));
}

/** Shrinks the picture on the phone, then uploads it to Firebase Storage. */
export async function uploadImage(file: File, folder: "qr" | "logo" | "photos") {
  if (!file.type.startsWith("image/")) throw new Error("Choose a picture file (PNG, JPG or WebP).");
  if (file.size > 20 * 1024 * 1024) throw new Error("That picture is over 20 MB. Use a screenshot instead.");
  // QR codes stay PNG so the squares stay sharp; logos and product photos use WebP to stay small.
  const max = folder === "qr" ? 1000 : folder === "photos" ? 1400 : 1600;
  const blob = await resize(file, max, folder === "qr" ? "image/png" : "image/webp");
  if (blob.size > 5 * 1024 * 1024) throw new Error("That picture is still over 5 MB after shrinking.");
  const type = blob.type || file.type;
  const ext = type.split("/")[1]?.replace("jpeg", "jpg") || "img";
  const path = `public/${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const r = ref(storage, path);
  await uploadBytes(r, blob, { contentType: type, cacheControl: "public,max-age=31536000,immutable" });
  return { url: await getDownloadURL(r), path };
}

export function removeImage(path?: string | null) {
  if (path) deleteObject(ref(storage, path)).catch(() => {});
}
