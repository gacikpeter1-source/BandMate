export type Role = "pending" | "bandmate" | "admin" | "disabled";

export interface UserProfile {
  id: string;
  email: string;
  displayName: string;
  role: Role;
  createdAt?: number;
  approvedBy?: string | null;
  approvedAt?: number | null;
}

/** A product photo stored in Firebase Storage (public/photos/*). */
export interface Photo {
  url: string;
  path: string;
}

export interface Item {
  id: string;
  name: string;
  variant: string;
  price: number;
  qrUrl: string | null;
  qrPath: string | null;
  visible: boolean;
  soldOut: boolean;
  order: number;
  /** Shared by every size of the same product (kept in sync on save). First one is the main photo. */
  images?: Photo[];
}

export interface BundlePart {
  name: string;
  qty: number;
}

export interface Bundle {
  id: string;
  name: string;
  price: number;
  parts: BundlePart[];
  qrUrl: string | null;
  qrPath: string | null;
  visible: boolean;
  order: number;
  images?: Photo[];
}

export interface Pick {
  itemId: string;
  qty: number;
}

export interface SaleLine {
  kind: "item" | "bundle";
  refId: string;
  label: string;
  detail?: string;
  price: number;
  qty: number;
  picks: Pick[];
}

export interface BasketLine extends SaleLine {
  key: string;
  qrUrl: string | null;
}

export type Method = "qr" | "cash" | "card" | "quick";

export interface Sale {
  id: string;
  at: number;
  by: string;
  byName: string;
  method: Method;
  gig: string;
  total: number;
  lines: SaleLine[];
  undone: boolean;
}

export interface Theme {
  primary: string;
  bg: string;
  surface: string;
  text: string;
}

export interface SocialLink {
  type: string;
  url: string;
}

export interface TopBarSettings {
  enabled: boolean;
  email: string;
  links: SocialLink[];
}

export interface PublicSettings {
  bandName: string;
  tagline: string;
  currency: string;
  preset: string;
  theme: Theme;
  logoUrl: string | null;
  logoPath: string | null;
  logoOpacity: number;
  logoInHeader: boolean;
  topBar: TopBarSettings;
}

export interface BandSettings {
  gig: string;
}
