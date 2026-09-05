import React from "react";
import { ink, parchment, FONT_SERIF, FONT_SANS } from "../theme.js";
import { api } from "../api.js";

export default function LoginScreen({ authError }) {
  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: parchment }}>
      <div className="text-center w-full max-w-sm">
        <div className="w-16 h-16 rounded-full mx-auto mb-6 flex items-center justify-center" style={{ background: ink, color: parchment, fontFamily: FONT_SERIF, fontSize: "22px" }}>SB</div>
        <h1 className="text-[26px] mb-2" style={{ fontFamily: FONT_SERIF, color: ink }}>Marriage Preparation</h1>
        <p className="text-[14px] mb-8" style={{ color: "#8A8378", fontFamily: FONT_SANS }}>Sign in with the Google account this parish uses for Sheets and Drive.</p>

        {authError && (
          <p className="text-[13px] mb-4" style={{ color: "#8B3A3A", fontFamily: FONT_SANS }}>
            Sign-in didn't complete. Please try again.
          </p>
        )}

        <a
          href={api.loginUrl()}
          className="w-full flex items-center justify-center gap-3 py-4 rounded-lg text-[15px] mb-3"
          style={{ background: "#FFFFFF", border: "1px solid #E4DDD0", fontFamily: FONT_SANS, color: ink, textDecoration: "none" }}
        >
          <svg width="18" height="18" viewBox="0 0 18 18">
            <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62z" />
            <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.81.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18z" />
            <path fill="#FBBC05" d="M3.97 10.72A5.4 5.4 0 0 1 3.68 9c0-.6.1-1.18.29-1.72V4.95H.96A9 9 0 0 0 0 9c0 1.45.35 2.83.96 4.05z" />
            <path fill="#EA4335" d="M9 3.58c1.32 0 2.51.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58z" />
          </svg>
          Sign in with Google
        </a>
        <p className="text-[12px]" style={{ color: "#B7AF9F", fontFamily: FONT_SANS }}>You'll be asked to grant access to Drive files this app creates and to one Google Sheet.</p>
      </div>
    </div>
  );
}
