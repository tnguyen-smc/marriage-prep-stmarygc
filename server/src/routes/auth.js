import { Router } from "express";
import { google } from "googleapis";
import { newOAuth2Client, SCOPES } from "../googleClient.js";
import { readRows } from "../sheets.js";

const router = Router();

// Step 1: priest clicks "Sign in with Google" in the app, which sends
// their browser here. We redirect on to Google's real consent screen.
router.get("/google", (req, res) => {
  const client = newOAuth2Client();
  const url = client.generateAuthUrl({ access_type: "offline", prompt: "consent", scope: SCOPES });
  res.redirect(url);
});

// Step 2: Google redirects the browser back here with a one-time code.
// We exchange it for tokens, fetch the profile, then decide WHO this
// person is allowed to be in the app:
//   - matches ADMIN_EMAIL           -> role "admin", sees everything
//   - matches an email in the       -> role "priest", scoped to only
//     "Priests" sheet tab              their own couples
//   - matches neither                -> not authorized, bounced back out
router.get("/google/callback", async (req, res) => {
  try {
    const client = newOAuth2Client();
    const { tokens } = await client.getToken(req.query.code);
    client.setCredentials(tokens);

    const oauth2 = google.oauth2({ version: "v2", auth: client });
    const { data: profile } = await oauth2.userinfo.get();
    const emailLower = (profile.email || "").toLowerCase();

    let role = null;
    let priestName = null;

    if (process.env.ADMIN_EMAIL && emailLower === process.env.ADMIN_EMAIL.toLowerCase()) {
      role = "admin";
    } else {
      const { rows } = await readRows(client, "Priests");
      const match = rows.find((r) => (r.email || "").toLowerCase() === emailLower);
      if (match) {
        role = "priest";
        priestName = match.name;
      }
    }

    if (!role) {
      return res.redirect(`${process.env.CLIENT_URL}?auth_error=not_authorized`);
    }

    req.session.tokens = tokens;
    req.session.profile = { email: profile.email, name: profile.name, picture: profile.picture, role, priestName };
    res.redirect(process.env.CLIENT_URL);
  } catch (e) {
    console.error("Google OAuth callback failed:", e.message);
    res.redirect(`${process.env.CLIENT_URL}?auth_error=1`);
  }
});

router.get("/me", (req, res) => {
  if (!req.session.tokens || !req.session.profile) return res.status(401).json({ error: "Not signed in" });
  res.json(req.session.profile);
});

router.post("/logout", (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

export default router;
