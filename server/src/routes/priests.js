import { Router } from "express";
import { requireAuth } from "../middleware/requireAuth.js";
import { requireAdmin } from "../middleware/requireAdmin.js";
import { readRows, appendRow, updateRow } from "../sheets.js";

const router = Router();
const TAB = "Priests";
const HEADER = ["role", "name", "email"];
export const PRIEST_ROLES = ["Pastor", "Parochial Vicar"];

// Any signed-in user (admin or priest) can read this — the intake
// dropdown and "Edit couple" modal both need the current names to
// populate their priest picker.
router.get("/", requireAuth, async (req, res) => {
  try {
    const { rows } = await readRows(req.oauth2Client, TAB);
    const byRole = Object.fromEntries(rows.map((r) => [r.role, r]));
    // Always return both slots, even before either has been configured,
    // so Settings has something to render inputs for.
    const result = PRIEST_ROLES.map((role) => ({
      role,
      name: byRole[role]?.name || "",
      email: byRole[role]?.email || "",
    }));
    res.json(result);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

// Only the admin can set who the Pastor/Parochial Vicar are.
router.put("/:role", requireAuth, requireAdmin, async (req, res) => {
  try {
    const { role } = req.params;
    if (!PRIEST_ROLES.includes(role)) return res.status(400).json({ error: "Unknown role" });
    const { name, email } = req.body;
    const rowObj = { role, name: name || "", email: email || "" };

    const { rows } = await readRows(req.oauth2Client, TAB);
    const match = rows.find((r) => r.role === role);
    if (match) await updateRow(req.oauth2Client, TAB, match._row, HEADER, rowObj);
    else await appendRow(req.oauth2Client, TAB, HEADER, rowObj);

    res.json(rowObj);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

export default router;
