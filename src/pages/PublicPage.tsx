import { useState } from "react";
import { Link } from "../lib/nav";
import { query, where } from "firebase/firestore";
import { bandCol } from "../lib/scope";
import { useLiveQuery } from "../lib/live";
import { groupItems, itemLabel, money, priceTag } from "../lib/format";
import { useSettings } from "../state/settings";
import { useAuth, isStaff } from "../state/auth";
import { useTenant } from "../state/tenant";
import { useT } from "../i18n";
import LangSwitch from "../components/LangSwitch";
import { LogoBackdrop, TopBar } from "../components/brand";
import { Loading, PhotoCarousel, PhotoViewer, QrFull } from "../components/ui";
import type { Bundle, Item, Photo } from "../types";

/** What fans see: products, prices and payment QR codes. Never stock counts. */
export default function PublicPage() {
  const t = useT();
  const { settings, ready } = useSettings();
  const { profile } = useAuth();
  const { bandId } = useTenant();
  const items = useLiveQuery<Item>(() => query(bandCol("items"), where("visible", "==", true)), `pub-items-${bandId}`);
  const bundles = useLiveQuery<Bundle>(() => query(bandCol("bundles"), where("visible", "==", true)), `pub-bundles-${bandId}`);
  const [qr, setQr] = useState<{ src: string | null; title: string; sub: string } | null>(null);
  const [viewer, setViewer] = useState<{ photos: Photo[]; start: number; title: string } | null>(null);
  const cur = settings.currency;
  const groups = groupItems(items.data);
  const bundleList = bundles.data.slice().sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  const open = (title: string, price: number, src: string | null) => setQr({ src, title, sub: money(price, cur) });

  return (
    <>
      <LogoBackdrop settings={settings} />
      <TopBar settings={settings} />
      <header className="hero">
        <div className="hero-in">
          {settings.logoInHeader && settings.logoUrl && <img className="hero-logo" src={settings.logoUrl} alt="" />}
          <div className="hero-txt">
            <h1>{settings.bandName || (ready ? "Merch" : "")}</h1>
            {settings.tagline && <p>{settings.tagline}</p>}
          </div>
          <LangSwitch />
        </div>
      </header>
      <main className="page">
        <div className="wrap">
          {!items.ready ? (
            <Loading text={t("fan.loading")} />
          ) : !groups.length && !bundleList.length ? (
            <div className="empty">
              <h3>{t("fan.comingTitle")}</h3>
              <p>{t("fan.comingText")}</p>
            </div>
          ) : (
            <>
              <p className="lead">{t("fan.lead")}</p>
              <div className="grid">
                {groups.map((g) => {
                  const single = g.items.length === 1 && !g.items[0].variant;
                  const allOut = g.items.every((i) => i.soldOut);
                  const photos = g.items.find((i) => i.images?.length)?.images ?? [];
                  return (
                    <article key={g.key} className={`tile ${photos.length ? "photo" : ""} ${allOut ? "dim" : ""}`}>
                      {photos.length > 0 && <PhotoCarousel photos={photos} alt={g.name} onOpen={(start) => setViewer({ photos, start, title: g.name })} />}
                      <div className="tile-top">
                        <h3>{g.name}</h3>
                        <span className="tag">{priceTag(g.items, cur)}</span>
                      </div>
                      {single ? (
                        <button className="btn primary block" disabled={g.items[0].soldOut} onClick={() => open(g.name, g.items[0].price, g.items[0].qrUrl)}>
                          {g.items[0].soldOut ? t("fan.soldOut") : g.items[0].qrUrl ? t("fan.showQr") : t("fan.buyAtTable")}
                        </button>
                      ) : (
                        <>
                          <div className="sizes">
                            {g.items.map((it) => (
                              <button
                                key={it.id}
                                className="chip"
                                disabled={it.soldOut}
                                onClick={() => open(itemLabel(it), it.price, it.qrUrl)}
                                aria-label={it.soldOut ? t("fan.itemSoldOutAria", { label: itemLabel(it) }) : itemLabel(it)}
                              >
                                <b>{it.variant || t("common.oneSize")}</b>
                                <small>{it.soldOut ? t("fan.soldOut") : money(it.price, cur)}</small>
                              </button>
                            ))}
                          </div>
                          <span className="note">{t("fan.tapSize")}</span>
                        </>
                      )}
                    </article>
                  );
                })}
              </div>
              {bundleList.length > 0 && (
                <>
                  <h2 className="sec">{t("fan.bundles")}</h2>
                  <div className="grid">
                    {bundleList.map((b) => (
                      <article key={b.id} className={`tile bundle ${b.images?.length ? "photo" : ""}`}>
                        {!!b.images?.length && <PhotoCarousel photos={b.images} alt={b.name} onOpen={(start) => setViewer({ photos: b.images!, start, title: b.name })} />}
                        <div className="tile-top">
                          <div>
                            <h3>{b.name}</h3>
                            <div className="sub">{b.parts.map((p) => `${p.qty > 1 ? p.qty + "× " : ""}${p.name}`).join(" + ")}</div>
                          </div>
                          <span className="tag">{money(b.price, cur)}</span>
                        </div>
                        <button className="btn primary block" onClick={() => open(b.name, b.price, b.qrUrl)}>
                          {b.qrUrl ? t("fan.showQr") : t("fan.buyAtTable")}
                        </button>
                      </article>
                    ))}
                  </div>
                </>
              )}
            </>
          )}
          <footer className="foot">
            {profile && isStaff(profile.role) ? <Link to="/band">{t("fan.openDesk")}</Link> : <Link to="/login">{t("fan.bandLogin")}</Link>}
          </footer>
        </div>
      </main>
      {viewer && <PhotoViewer photos={viewer.photos} start={viewer.start} title={viewer.title} onClose={() => setViewer(null)} />}
      {qr && <QrFull src={qr.src} title={qr.title} sub={qr.sub} onClose={() => setQr(null)} />}
    </>
  );
}
