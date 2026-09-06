import { google } from "googleapis";
import { Readable } from "stream";

function driveClient(auth) {
  return google.drive({ version: "v3", auth });
}

// IMPORTANT: `supportsAllDrives: true` is required on every Drive API
// call below if a folder lives inside a Shared Drive ("Team Drive")
// rather than someone's personal My Drive. Without this flag, the Drive
// API pretends Shared Drive items don't exist at all — "File not found"
// — no matter how broad the OAuth scope is. It's harmless to always
// include this even for a personal My Drive folder, so it's on by
// default for every call rather than needing a setting of its own.
const SHARED_DRIVE_SUPPORT = { supportsAllDrives: true };

export async function uploadPdf(auth, filename, buffer, folderId) {
  return uploadFile(auth, filename, "application/pdf", buffer, folderId);
}

/** Uploads any file type (baptism certificates, scans, photos, etc.).
 *  `folderId` is resolved by the caller — see server/src/config.js — so
 *  it can come from the admin's Settings screen instead of only an env
 *  variable. */
export async function uploadFile(auth, filename, mimeType, buffer, folderId) {
  const drive = driveClient(auth);
  const res = await drive.files.create({
    requestBody: { name: filename, parents: folderId ? [folderId] : undefined },
    media: { mimeType, body: Readable.from(buffer) },
    fields: "id, webViewLink",
    ...SHARED_DRIVE_SUPPORT,
  });
  return { id: res.data.id, webViewLink: res.data.webViewLink };
}

/** Streams a Drive file's bytes straight into an Express response. */
export async function downloadFileStream(auth, fileId, res) {
  const drive = driveClient(auth);
  const driveRes = await drive.files.get(
    { fileId, alt: "media", ...SHARED_DRIVE_SUPPORT },
    { responseType: "stream" }
  );
  res.setHeader("Content-Type", "application/pdf");
  driveRes.data.pipe(res);
}

export async function deleteFile(auth, fileId) {
  const drive = driveClient(auth);
  await drive.files.delete({ fileId, ...SHARED_DRIVE_SUPPORT });
}

/** Makes a brand-new Drive file that's a copy of `fileId`, so filling it
 *  in never touches the original. Returns the new file's id. */
export async function copyFile(auth, fileId, name, folderId) {
  const drive = driveClient(auth);
  const res = await drive.files.copy({
    fileId,
    requestBody: { name, parents: folderId ? [folderId] : undefined },
    fields: "id",
    ...SHARED_DRIVE_SUPPORT,
  });
  return res.data.id;
}

/** Overwrites a Drive file's bytes in place (used to save a couple's
 *  filled-in copy after they answer more fields — never called on a
 *  template's master file id). */
export async function updateFileBytes(auth, fileId, buffer) {
  const drive = driveClient(auth);
  await drive.files.update({
    fileId,
    media: { mimeType: "application/pdf", body: Readable.from(buffer) },
    ...SHARED_DRIVE_SUPPORT,
  });
}