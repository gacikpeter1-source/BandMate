// "Which bands am I part of?" for the BandMate front page. Member documents carry the person's email,
// so one collection-group query finds them all; the rules only return documents with the signed-in
// person's own (verified) email.
import { collectionGroup, doc, getDoc, getDocs, query, where } from "firebase/firestore";
import { db } from "../firebase";
import type { Role } from "../types";

export interface MyBand {
  bandId: string;
  name: string;
  role: Role;
  status: "active" | "paused";
}

export async function fetchMyBands(email: string): Promise<MyBand[]> {
  const snap = await getDocs(query(collectionGroup(db, "members"), where("email", "==", email.toLowerCase())));
  const rows = await Promise.all(
    snap.docs.map(async (m) => {
      const bandId = m.ref.parent.parent!.id;
      const band = (await getDoc(doc(db, "bands", bandId))).data();
      return { bandId, name: (band?.name as string) || bandId, role: m.data().role as Role, status: (band?.status as MyBand["status"]) || "active" };
    })
  );
  return rows.filter((r) => r.role !== "disabled").sort((a, b) => a.name.localeCompare(b.name));
}
