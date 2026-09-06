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

// Two separate folders, matching how you'd actually browse Drive:
// - templatesFolderId: where master template PDFs uploaded in Settings live.
// - couplesFolderId: the parent folder under which EACH COUPLE automatically
//   gets their own subfolder (created the first time they need one — see
//   ensureCoupleFolder in routes/couples.js) holding their PDF copies and
//   any supporting documents together.
//
// "driveFolderId" (singular, no "s") is the old single-folder setting from
// before this split existed. It's kept as a fallback so nothing breaks for
// an admin who already configured it — both new settings fall back to it,
// then to the original env var, if nothing more specific has been set yet.
router.get("/", requireAuth, requireAdmin, async (req, res) => {
  try {
    const legacyFallback = await getConfigValue(req.oauth2Client, "driveFolderId", process.env.GOOGLE_DRIVE_FOLDER_ID || "");
    const templatesFolderId = await getConfigValue(req.oauth2Client, "templatesFolderId", legacyFallback);
    const couplesFolderId = await getConfigValue(req.oauth2Client, "couplesFolderId", legacyFallback);
    res.json({ templatesFolderId, couplesFolderId });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

router.put("/", requireAuth, requireAdmin, async (req, res) => {
  try {
    const updates = {};
    if ("templatesFolderId" in req.body) updates.templatesFolderId = extractFolderId(req.body.templatesFolderId);
    if ("couplesFolderId" in req.body) updates.couplesFolderId = extractFolderId(req.body.couplesFolderId);

    await Promise.all(Object.entries(updates).map(([key, value]) => setConfigValue(req.oauth2Client, key, value)));

    res.json(updates);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

export default router;