import { Router } from "express";
import multer from "multer";
import { v4 as uuid } from "uuid";
import { requireAuth } from "../middleware/requireAuth.js";
import { requireAdmin } from "../middleware/requireAdmin.js";
import { readRows, appendRow, updateRow, getSheetIdByTitle, deleteRow } from "../sheets.js";
import { uploadPdf, downloadFileStream, deleteFile } from "../drive.js";
import { getConfigValue } from "../config.js";

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });
const router = Router();
const TAB = "Templates";
const HEADER = ["id", "title", "driveFileId", "createdAt"];

// List every uploaded PDF template (title + id), so the Settings screen
// and the intake checklist can both show them.
router.get("/", requireAuth, async (req, res) => {
  try {
    const { rows } = await readRows(req.oauth2Client, TAB, HEADER);
    res.json(rows.map(({ _row, ...r }) => r));
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

// Upload a new fillable PDF with a title. Admin only — this is what
// makes a form available for every priest to assign at intake.
router.post("/", requireAuth, requireAdmin, upload.single("file"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });
    if (!req.body.title) return res.status(400).json({ error: "Title is required" });
    const legacyFallback = await getConfigValue(req.oauth2Client, "driveFolderId", process.env.GOOGLE_DRIVE_FOLDER_ID || "");
    const folderId = await getConfigValue(req.oauth2Client, "templatesFolderId", legacyFallback);
    const { id: driveFileId } = await uploadPdf(req.oauth2Client, req.file.originalname, req.file.buffer, folderId);
    const row = { id: uuid(), title: req.body.title, driveFileId, createdAt: new Date().toISOString() };
    await appendRow(req.oauth2Client, TAB, HEADER, row);
    res.json(row);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

// Stream a template's raw PDF bytes back to the frontend, which then
// fills it live with pdf-lib. Kept behind auth so random people can't
// pull files out of your Drive folder by guessing IDs.
router.get("/:id/file", requireAuth, async (req, res) => {
  try {
    const { rows } = await readRows(req.oauth2Client, TAB, HEADER);
    const match = rows.find((r) => r.id === req.params.id);
    if (!match) return res.status(404).json({ error: "Template not found" });
    await downloadFileStream(req.oauth2Client, match.driveFileId, res);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

// Rename a template — updates only the display title shown at intake and
// in Settings; the underlying Drive file and its id are untouched, so
// every couple's existing copy (which was made from this file, not this
// title) is completely unaffected. Admin only.
router.put("/:id", requireAuth, requireAdmin, async (req, res) => {
  try {
    const { rows } = await readRows(req.oauth2Client, TAB, HEADER);
    const match = rows.find((r) => r.id === req.params.id);
    if (!match) return res.status(404).json({ error: "Template not found" });
    if (!req.body.title || !req.body.title.trim()) return res.status(400).json({ error: "Title is required" });

    const rowObj = { id: match.id, title: req.body.title.trim(), driveFileId: match.driveFileId, createdAt: match.createdAt };
    await updateRow(req.oauth2Client, TAB, match._row, HEADER, rowObj);
    res.json(rowObj);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

router.delete("/:id", requireAuth, requireAdmin, async (req, res) => {
  try {
    const { rows } = await readRows(req.oauth2Client, TAB, HEADER);
    const match = rows.find((r) => r.id === req.params.id);
    if (!match) return res.status(404).json({ error: "Template not found" });
    await deleteFile(req.oauth2Client, match.driveFileId).catch(() => {});
    const sheetIdNumeric = await getSheetIdByTitle(req.oauth2Client, TAB);
    await deleteRow(req.oauth2Client, sheetIdNumeric, match._row);
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

export default router;