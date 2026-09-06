import "dotenv/config";
import { google } from "googleapis";

// Scopes we ask the priest to grant on first login:
// - identify who they are (email/profile)
// - drive: full Drive access for THIS account. We need this, not the
//   narrower drive.file, because GOOGLE_DRIVE_FOLDER_ID points at a
//   folder the admin created by hand in Drive's own UI before the app
//   ever touched it. drive.file only grants visibility into files/folders
//   the app itself created or that were opened through Google's file
//   picker — it CANNOT see a pre-existing folder just because you know
//   its ID. Using drive.file here fails every upload with a misleading
//   "File not found: <folder id>" error, even when the id is correct.
// - spreadsheets: read/write the one Sheet we use as the database
export const SCOPES = [
  "openid",
  "email",
  "profile",
  "https://www.googleapis.com/auth/drive",
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
    delete tokens.id_token; // see auth.js — keeps the session cookie small
    session.tokens = { ...session.tokens, ...tokens };
  });
  return client;
}