import "dotenv/config";
import { google } from "googleapis";

// Scopes we ask the priest to grant on first login:
// - identify who they are (email/profile)
// - drive.file: only files THIS app creates/opens — not their whole Drive
// - spreadsheets: read/write the one Sheet we use as the database
export const SCOPES = [
  "openid",
  "email",
  "profile",
  "https://www.googleapis.com/auth/drive.file",
  "https://www.googleapis.com/auth/spreadsheets",
  "https://www.googleapis.com/auth/calendar.events",
];

export function newOAuth2Client() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
}

/**
 * Builds an OAuth2 client pre-loaded with this session's tokens, and
 * keeps the session updated if Google silently refreshes the access
 * token during the request (this is why we don't just store one
 * static client per user).
 */
export function clientFromSession(session) {
  const client = newOAuth2Client();
  if (session.tokens) client.setCredentials(session.tokens);
  client.on("tokens", (tokens) => {
    session.tokens = { ...session.tokens, ...tokens };
  });
  return client;
}
