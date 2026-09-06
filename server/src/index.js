import "dotenv/config";
import express from "express";
import session from "express-session";
import cors from "cors";
import authRoutes from "./routes/auth.js";
import templateRoutes from "./routes/templates.js";
import coupleRoutes from "./routes/couples.js";
import priestRoutes from "./routes/priests.js";

const app = express();

// CLIENT_URL includes a path on GitHub Pages project sites
// (https://tnguyen-smc.github.io/marriage-prep-stmarygc), but a browser's
// Origin header is only scheme://host — so comparing against the full
// CLIENT_URL would reject every request. Strip it down to the origin.
const CLIENT_ORIGIN = (() => {
  try {
    return new URL(process.env.CLIENT_URL).origin;
  } catch {
    return "http://localhost:5173";
  }
})();

// Render terminates TLS at its proxy and forwards over plain HTTP, so
// Express sees an insecure request and would refuse to set a `Secure`
// cookie. Trusting the proxy lets it read X-Forwarded-Proto and set the
// session cookie correctly. Without this, login silently fails in
// production: the cookie is never stored and every request looks
// signed-out.
app.set("trust proxy", 1);

app.use(cors({ origin: CLIENT_ORIGIN, credentials: true }));
app.use(express.json());
app.use(
  session({
    secret: process.env.SESSION_SECRET || "dev-secret",
    resave: false,
    saveUninitialized: false,
    cookie: {
      sameSite: process.env.COOKIE_SAMESITE || "lax",
      secure: process.env.COOKIE_SECURE === "true",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    },
  })
);

app.use("/api/auth", authRoutes);
app.use("/api/templates", templateRoutes);
app.use("/api/couples", coupleRoutes);
app.use("/api/priests", priestRoutes);

app.get("/", (_req, res) => res.send("Marriage Prep API is running."));

// Fail fast and loudly on a misconfigured deploy rather than throwing
// confusing Google errors on the first real request.
const REQUIRED = ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "GOOGLE_REDIRECT_URI", "GOOGLE_SHEET_ID", "ADMIN_EMAIL"];
const missing = REQUIRED.filter((k) => !process.env[k]);
if (missing.length) {
  console.warn(`[config] Missing env vars: ${missing.join(", ")} — set these in Render's Environment tab.`);
}

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
  console.log(`Allowing CORS from: ${CLIENT_ORIGIN}`);
});
