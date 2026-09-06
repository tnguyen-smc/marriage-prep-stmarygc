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
  // Never let a browser (or any intermediary) cache a PDF response and
  // silently reuse it later — especially important right after a bad
  // response (e.g. one cut short by a memory-limited restart), which
  // could otherwise keep being served from cache even once the
  // underlying file is fine again.
  res.setHeader("Cache-Control", "no-store");

  await new Promise((resolve, reject) => {
    // If the Drive read stream dies partway through (network blip, the
    // process getting killed for memory before finishing, etc.), pipe()
    // alone won't stop Express from ending the response as if it
    // succeeded — the browser can end up with a truncated PDF that
    // *looks* like a normal 200 response. Explicitly destroying the
    // response on a stream error turns that into a real, visible
    // network failure instead of a silent partial file.
    driveRes.data.on("error", (err) => {
      res.destroy(err);
      reject(err);
    });
    res.on("finish", resolve);
    res.on("error", reject);
    driveRes.data.pipe(res);
  });
}

export async function deleteFile(auth, fileId) {
  const drive = driveClient(auth);
  await drive.files.delete({ fileId, ...SHARED_DRIVE_SUPPORT });
}

/** Looks for an existing, non-trashed child of `parentId` with this exact
 *  name (and mimeType, if given). Used to make folder/file creation
 *  idempotent: if two requests race to create the same couple's
 *  subfolder or the same template copy at the same moment, both check
 *  Drive itself (not just the Sheet's cached id, which can't be trusted
 *  under a race) and converge on the one that actually exists rather
 *  than each creating its own duplicate. Returns the id, or null. */
export async function findChildByName(auth, parentId, name, mimeType) {
  if (!parentId) return null;
  const drive = driveClient(auth);
  const escaped = name.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
  const q = [`'${parentId}' in parents`, `name = '${escaped}'`, "trashed = false", mimeType && `mimeType = '${mimeType}'`]
    .filter(Boolean)
    .join(" and ");
  const res = await drive.files.list({
    q,
    fields: "files(id, name)",
    pageSize: 1,
    includeItemsFromAllDrives: true,
    corpora: "allDrives",
    ...SHARED_DRIVE_SUPPORT,
  });
  return res.data.files?.[0]?.id || null;
}

/** Creates a new Drive folder (used to give each couple their own
 *  subfolder under the configured "Couples" parent folder). Returns the
 *  new folder's id. */
export async function createFolder(auth, name, parentId) {
  const drive = driveClient(auth);
  const res = await drive.files.create({
    requestBody: {
      name,
      mimeType: "application/vnd.google-apps.folder",
      parents: parentId ? [parentId] : undefined,
    },
    fields: "id",
    ...SHARED_DRIVE_SUPPORT,
  });
  return res.data.id;
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