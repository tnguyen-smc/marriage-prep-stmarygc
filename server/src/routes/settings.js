import { Router } from "express";
import { requireAuth } from "../middleware/requireAuth.js";
import { requireAdmin } from "../middleware/requireAdmin.js";
import { getConfigValue, setConfigValue } from "../config.js";

const router = Router();

/** Accepts either a raw Drive folder id or a full folder URL, e.g.
 *  https://drive.google.com/drive/folders/<id>, and returns just the id. */
function extractFolderId(input) {
  const trimmed = (input || "").trim();
  const match = trimmed.match(/\/folders\/([a-zA-Z0-9_-]+)/);
  return match ? match[1] : trimmed;
}

router.get("/", requireAuth, requireAdmin, async (req, res) => {
  try {
    const driveFolderId = await getConfigValue(req.oauth2Client, "driveFolderId", process.env.GOOGLE_DRIVE_FOLDER_ID || "");
    res.json({ driveFolderId });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

router.put("/", requireAuth, requireAdmin, async (req, res) => {
  try {
    const driveFolderId = extractFolderId(req.body.driveFolderId);
    await setConfigValue(req.oauth2Client, "driveFolderId", driveFolderId);
    res.json({ driveFolderId });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

export default router;