import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { GoogleOAuthProvider } from "@react-oauth/google";
import "./index.css";
import "./App.css";
import App from "./App.tsx";
import { ToastProvider } from "./ui/components/Toast";

// TODO: Replace with the actual Google Client ID from Google Cloud Console.
// You must supply this for Phase 31 (Drive Sync) to work!
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || "350340206913-cka41qrr5efnqbi2i353c7mnb68so1hk.apps.googleusercontent.com";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      <ToastProvider>
        <App />
      </ToastProvider>
    </GoogleOAuthProvider>
  </StrictMode>,
);