import { Router } from "express";
import express from "express";
import multer from "multer";
import { v4 as uuid } from "uuid";
import { requireAuth } from "../middleware/requireAuth.js";
import { readRows, appendRow, updateRow } from "../sheets.js";
import { copyFile, updateFileBytes, downloadFileStream, uploadFile, deleteFile } from "../drive.js";
import { createEvent } from "../calendar.js";

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } });
const router = Router();
const TAB = "Couples";
const TEMPLATES_TAB = "Templates";
const HEADER = [
  "id", "slug", "groom", "bride", "email", "phone", "weddingDate",
  "prepStartDate", "lastAppointment", "status", "drivePath",
  "templateIds", "templateData", "priest",
  "archived", "archivedReason", "archivedAt",
  "templateCopies", "documents",
];

// JSON-blob columns (templateData, templateCopies, documents) keep the
// sheet's shape fixed no matter how many templates or documents exist:
// - templateData:   { [templateId]: { [pdfFieldName]: value } }
// - templateCopies: { [templateId]: driveFileId }  <- this couple's OWN copy
// - documents:      [ { id, name, driveFileId, webViewLink, uploadedAt } ]
// archived is "true"/"false" (Sheets has no boolean cell type worth relying on).
function parseRow(r) {
  return {
    ...r,
    templateIds: r.templateIds ? r.templateIds.split(",").filter(Boolean) : [],
    templateData: r.templateData ? JSON.parse(r.templateData) : {},
    templateCopies: r.templateCopies ? JSON.parse(r.templateCopies) : {},
    documents: r.documents ? JSON.parse(r.documents) : [],
    archived: r.archived === "true" || r.archived === true,
  };
}

/** "Michael Alvarez" + "Teresa Nguyen" -> "alvarez-nguyen" */
function makeSlug(groom, bride) {
  const last = (full) => {
    const parts = (full || "").trim().split(/\s+/).filter(Boolean);
    return (parts.length > 1 ? parts[parts.length - 1] : parts[0] || "")
      .toLowerCase()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // strip accents
      .replace(/[^a-z0-9]/g, "");
  };
  return `${last(groom)}-${last(bride)}` || "couple";
}

/** Guarantees the slug is unique across all couples (appends -2, -3, ...). */
function uniqueSlug(base, existingSlugs) {
  if (!existingSlugs.includes(base)) return base;
  let n = 2;
  while (existingSlugs.includes(`${base}-${n}`)) n += 1;
  return `${base}-${n}`;
}

async function findCouple(auth, idOrSlug) {
  const { rows } = await readRows(auth, TAB);
  return rows.find((r) => r.id === idOrSlug || r.slug === idOrSlug);
}

async function saveRow(auth, row) {
  const rowNumber = row._row;
  const copy = { ...row };
  delete copy._row;
  await updateRow(auth, TAB, rowNumber, HEADER, copy);
  return copy;
}

/** Returns this couple's own Drive copy of `templateId`, creating it from
 *  the template's master file on first use. The master is never modified. */
async function ensureCoupleCopy(auth, coupleRow, templateId) {
  const copies = coupleRow.templateCopies ? JSON.parse(coupleRow.templateCopies) : {};
  if (copies[templateId]) return copies[templateId];

  const { rows: templateRows } = await readRows(auth, TEMPLATES_TAB);
  const template = templateRows.find((t) => t.id === templateId);
  if (!template) throw Object.assign(new Error("Template not found"), { status: 404 });

  const newFileId = await copyFile(
    auth,
    template.driveFileId,
    `${template.title} — ${coupleRow.groom}_${coupleRow.bride}.pdf`
  );

  copies[templateId] = newFileId;
  await saveRow(auth, { ...coupleRow, templateCopies: JSON.stringify(copies) });
  return newFileId;
}

// Both priests and the admin can see every couple — the parish works as
// one office, so the Pastor and Parochial Vicar cover for each other.
// `priest` records who's responsible, not who's allowed to look.
router.get("/", requireAuth, async (req, res) => {
  try {
    const { rows } = await readRows(req.oauth2Client, TAB);
    res.json(rows.map(({ _row, ...r }) => parseRow(r)));
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

router.get("/:idOrSlug", requireAuth, async (req, res) => {
  try {
    const match = await findCouple(req.oauth2Client, req.params.idOrSlug);
    if (!match) return res.status(404).json({ error: "Couple not found" });
    const { _row, ...rest } = match;
    res.json(parseRow(rest));
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

router.post("/", requireAuth, async (req, res) => {
  try {
    const b = req.body;
    const today = new Date().toISOString().slice(0, 10);
    const { rows } = await readRows(req.oauth2Client, TAB);
    const slug = uniqueSlug(makeSlug(b.groom, b.bride), rows.map((r) => r.slug).filter(Boolean));

    const row = {
      id: uuid(),
      slug,
      groom: b.groom || "",
      bride: b.bride || "",
      email: b.email || "",
      phone: b.phone || "",
      weddingDate: b.weddingDate || "",
      prepStartDate: b.prepStartDate || today,
      lastAppointment: today,
      status: "In Progress",
      drivePath: b.drivePath || "",
      templateIds: (b.templateIds || []).join(","),
      templateData: "{}",
      priest: b.priest || "",
      archived: "false",
      archivedReason: "",
      archivedAt: "",
      templateCopies: "{}",
      documents: "[]",
    };
    await appendRow(req.oauth2Client, TAB, HEADER, row);
    res.json(parseRow(row));
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

router.patch("/:idOrSlug", requireAuth, async (req, res) => {
  try {
    const match = await findCouple(req.oauth2Client, req.params.idOrSlug);
    if (!match) return res.status(404).json({ error: "Couple not found" });

    const updated = { ...match, ...req.body };
    if (req.body.templateIds) updated.templateIds = req.body.templateIds.join(",");
    if (req.body.templateData) updated.templateData = JSON.stringify(req.body.templateData);
    if (req.body.templateCopies) updated.templateCopies = JSON.stringify(req.body.templateCopies);
    if (req.body.documents) updated.documents = JSON.stringify(req.body.documents);
    if (typeof req.body.archived === "boolean") updated.archived = req.body.archived ? "true" : "false";

    // Names changed -> refresh the slug so the URL keeps matching, but
    // only if that wouldn't collide with another couple's slug.
    if ((req.body.groom && req.body.groom !== match.groom) || (req.body.bride && req.body.bride !== match.bride)) {
      const { rows } = await readRows(req.oauth2Client, TAB);
      const others = rows.filter((r) => r.id !== match.id).map((r) => r.slug).filter(Boolean);
      updated.slug = uniqueSlug(makeSlug(updated.groom, updated.bride), others);
    }

    const saved = await saveRow(req.oauth2Client, updated);
    res.json(parseRow(saved));
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

/* ---------- This couple's own copy of an assigned template ---------- */

router.get("/:idOrSlug/templates/:templateId/file", requireAuth, async (req, res) => {
  try {
    const match = await findCouple(req.oauth2Client, req.params.idOrSlug);
    if (!match) return res.status(404).json({ error: "Couple not found" });
    const fileId = await ensureCoupleCopy(req.oauth2Client, match, req.params.templateId);
    await downloadFileStream(req.oauth2Client, fileId, res);
  } catch (e) {
    console.error(e);
    res.status(e.status || 500).json({ error: e.message });
  }
});

router.put(
  "/:idOrSlug/templates/:templateId/file",
  requireAuth,
  express.raw({ type: "application/pdf", limit: "25mb" }),
  async (req, res) => {
    try {
      const match = await findCouple(req.oauth2Client, req.params.idOrSlug);
      if (!match) return res.status(404).json({ error: "Couple not found" });
      const fileId = await ensureCoupleCopy(req.oauth2Client, match, req.params.templateId);
      await updateFileBytes(req.oauth2Client, fileId, req.body);
      res.json({ ok: true });
    } catch (e) {
      console.error(e);
      res.status(e.status || 500).json({ error: e.message });
    }
  }
);

/* ---------- Supporting documents (baptism certs, scans, etc.) ---------- */

router.post("/:idOrSlug/documents", requireAuth, upload.single("file"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });
    const match = await findCouple(req.oauth2Client, req.params.idOrSlug);
    if (!match) return res.status(404).json({ error: "Couple not found" });

    const { id: driveFileId, webViewLink } = await uploadFile(
      req.oauth2Client,
      `${req.body.name || req.file.originalname} — ${match.groom}_${match.bride}`,
      req.file.mimetype,
      req.file.buffer
    );

    const documents = match.documents ? JSON.parse(match.documents) : [];
    documents.push({
      id: uuid(),
      name: req.body.name || req.file.originalname,
      driveFileId,
      webViewLink,
      uploadedAt: new Date().toISOString(),
    });

    const saved = await saveRow(req.oauth2Client, { ...match, documents: JSON.stringify(documents) });
    res.json(parseRow(saved));
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

router.delete("/:idOrSlug/documents/:docId", requireAuth, async (req, res) => {
  try {
    const match = await findCouple(req.oauth2Client, req.params.idOrSlug);
    if (!match) return res.status(404).json({ error: "Couple not found" });

    const documents = match.documents ? JSON.parse(match.documents) : [];
    const doc = documents.find((d) => d.id === req.params.docId);
    if (doc) await deleteFile(req.oauth2Client, doc.driveFileId).catch(() => {});

    const remaining = documents.filter((d) => d.id !== req.params.docId);
    const saved = await saveRow(req.oauth2Client, { ...match, documents: JSON.stringify(remaining) });
    res.json(parseRow(saved));
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

/* ---------- Schedule the next session (real Google Calendar event) ---------- */

router.post("/:idOrSlug/events", requireAuth, async (req, res) => {
  try {
    const match = await findCouple(req.oauth2Client, req.params.idOrSlug);
    if (!match) return res.status(404).json({ error: "Couple not found" });

    const { start, end, summary, timeZone } = req.body;
    if (!start || !end) return res.status(400).json({ error: "start and end are required" });

    // The description links back to this couple's profile card in the app.
    const profileUrl = `${process.env.CLIENT_URL.replace(/\/$/, "")}/couples/${match.slug}`;

    const event = await createEvent(req.oauth2Client, {
      summary: summary || `Marriage prep — ${match.groom} & ${match.bride}`,
      description: `Couple profile: ${profileUrl}`,
      start,
      end,
      timeZone: timeZone || "America/Chicago",
      attendees: [match.email],
    });

    // Scheduling a session counts as contact — keep the card's date fresh.
    await saveRow(req.oauth2Client, { ...match, lastAppointment: start.slice(0, 10) });

    res.json(event);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

export default router;
