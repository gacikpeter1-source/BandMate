import { Navigate, Route, Routes } from "react-router-dom";
import { firebaseConfigured } from "./firebase";
import PublicPage from "./pages/PublicPage";
import { Login, Register } from "./pages/AuthPages";
import BandApp from "./pages/band/BandApp";

export default function App() {
  if (!firebaseConfigured) {
    return (
      <main className="page">
        <div className="wrap">
          <div className="empty">
            <h3>Firebase isn't connected yet</h3>
            <p>Add the VITE_FIREBASE_* values from your Firebase project to .env.local (or to Vercel's environment variables) and reload. See README step 3.</p>
          </div>
        </div>
      </main>
    );
  }
  return (
    <Routes>
      <Route path="/" element={<PublicPage />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/band/*" element={<BandApp />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
