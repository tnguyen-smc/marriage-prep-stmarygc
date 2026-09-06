import { google } from "googleapis";
import { Readable } from "stream";

const FOLDER_ID = process.env.GOOGLE_DRIVE_FOLDER_ID;

function driveClient(auth) {
  return google.drive({ version: "v3", auth });
}

// IMPORTANT: `supportsAllDrives: true` is required on every Drive API
// call below because GOOGLE_DRIVE_FOLDER_ID points into a Shared Drive
// (a "Team Drive"), not a personal My Drive folder. Without this flag,
// the Drive API pretends Shared Drive items don't exist at all —
// "File not found" — no matter how broad the OAuth scope is. This is a
// completely separate requirement from the OAuth scope itself; both
// have to be satisfied for Shared Drive files to work.
const SHARED_DRIVE_SUPPORT = { supportsAllDrives: true };

export async function uploadPdf(auth, filename, buffer) {
  return uploadFile(auth, filename, "application/pdf", buffer);
}

/** Uploads any file type (baptism certificates, scans, photos, etc.). */
export async function uploadFile(auth, filename, mimeType, buffer) {
  const drive = driveClient(auth);
  const res = await drive.files.create({
    requestBody: { name: filename, parents: FOLDER_ID ? [FOLDER_ID] : undefined },
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
export async function copyFile(auth, fileId, name) {
  const drive = driveClient(auth);
  const res = await drive.files.copy({
    fileId,
    requestBody: { name, parents: FOLDER_ID ? [FOLDER_ID] : undefined },
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