import { Link } from "../../lib/nav";

export default function PlatformHome() {
  return (
    <main className="page auth">
      <div className="authcard">
        <h1>BandMate</h1>
        <p className="note">
          Your own merch page: products and photos, stock, payment QR codes and sales at the merch table, from your phone. Every band gets its own address and its own team.
        </p>
        <Link className="btn primary block" to="/start">Start Your TeamMate</Link>
        <p className="note center">Already have a band here? Open its own address, for example name.bandmate.shop.</p>
      </div>
    </main>
  );
}
