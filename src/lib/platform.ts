// Collections only the BandMate operator can list (see firestore.rules).
import { collection } from "firebase/firestore";
import { db } from "../firebase";

export const bandsCol = () => collection(db, "bands");
export const domainsCol = () => collection(db, "domains");
