import { Router } from "express";
import { v4 as uuid } from "uuid";
import { requireAuth } from "../middleware/requireAuth.js";
import { requireAdmin } from "../middleware/requireAdmin.js";
import { readRows, appendRow, updateRow, getSheetIdByTitle, deleteRow } from "../sheets.js";

const router = Router();
const TAB = "Priests";
const HEADER = ["id", "title", "name", "email"];

// Any signed-in user (admin or priest) can read this — the intake
// dropdown and profile card both need the current roster to populate
// their priest picker.
router.get("/", requireAuth, async (req, res) => {
  try {
    const { rows } = await readRows(req.oauth2Client, TAB);
    res.json(rows.map(({ _row, ...r }) => r));
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

// Add another priest to the roster (e.g. a second associate). Admin only.
router.post("/", requireAuth, requireAdmin, async (req, res) => {
  try {
    const { title, name, email } = req.body;
    const row = { id: uuid(), title: title || "", name: name || "", email: email || "" };
    await appendRow(req.oauth2Client, TAB, HEADER, row);
    res.json(row);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

// Edit an existing priest's title (e.g. rename "Pastor" to something
// else), name, or email. Admin only.
router.put("/:id", requireAuth, requireAdmin, async (req, res) => {
  try {
    const { rows } = await readRows(req.oauth2Client, TAB);
    const match = rows.find((r) => r.id === req.params.id);
    if (!match) return res.status(404).json({ error: "Priest not found" });

    const { title, name, email } = req.body;
    const rowObj = { id: match.id, title: title ?? match.title, name: name ?? match.name, email: email ?? match.email };
    await updateRow(req.oauth2Client, TAB, match._row, HEADER, rowObj);
    res.json(rowObj);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

// Remove a priest from the roster. Admin only. Couples already assigned
// to them keep their record; they simply won't appear in the dropdown
// for new assignments anymore.
router.delete("/:id", requireAuth, requireAdmin, async (req, res) => {
  try {
    const { rows } = await readRows(req.oauth2Client, TAB);
    const match = rows.find((r) => r.id === req.params.id);
    if (!match) return res.status(404).json({ error: "Priest not found" });

    const sheetIdNumeric = await getSheetIdByTitle(req.oauth2Client, TAB);
    await deleteRow(req.oauth2Client, sheetIdNumeric, match._row);
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

export default router;