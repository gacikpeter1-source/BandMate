import { ref, uploadBytes, getDownloadURL, deleteObject, getMetadata } from "firebase/storage";
import { increment, setDoc } from "firebase/firestore";
import { db, storage } from "../firebase";
import { doc } from "firebase/firestore";
import { getBandId } from "./scope";
import { tr } from "../i18n";
import { assertSpaceRoom } from "./planState";
import { decodeQr } from "./qrdecode";

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
  if (!file.type.startsWith("image/")) throw new Error(tr("img.notPicture"));
  if (file.size > 20 * 1024 * 1024) throw new Error(tr("img.tooBig"));
  // QR codes stay PNG so the squares stay sharp; logos and product photos use WebP to stay small.
  const max = folder === "qr" ? 1000 : folder === "photos" ? 1400 : 1600;
  const blob = await resize(file, max, folder === "qr" ? "image/png" : "image/webp");
  if (blob.size > 5 * 1024 * 1024) throw new Error(tr("img.stillBig"));
  assertSpaceRoom(blob.size); // the plan's picture space; storage.rules enforces the same limit
  const type = blob.type || file.type;
  const ext = type.split("/")[1]?.replace("jpeg", "jpg") || "img";
  const path = `bands/${getBandId()}/${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const r = ref(storage, path);
  await uploadBytes(r, blob, { contentType: type, cacheControl: "public,max-age=31536000,immutable" });
  await addBytes(blob.size);
  // For a payment QR, also read what is inside it: a payment link in there lets fans on a phone tap instead of scan.
  const qrText = folder === "qr" ? await decodeQr(blob) : null;
  return { url: await getDownloadURL(r), path, ...(qrText ? { qrText } : {}) };
}

/** Keeps the band's "space used" total (settings/usage) in step with what is in Storage. */
function addBytes(delta: number) {
  return setDoc(doc(db, "bands", getBandId(), "settings", "usage"), { bytes: increment(delta) }, { merge: true }).catch(() => {});
}

export async function removeImage(path?: string | null) {
  if (!path) return;
  try {
    const size = (await getMetadata(ref(storage, path))).size;
    await deleteObject(ref(storage, path));
    await addBytes(-size);
  } catch {
    /* already gone, or offline: nothing more to do */
  }
}
