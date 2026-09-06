import { readRows, appendRow, updateRow } from "./sheets.js";

// A one-off key/value store, backed by a "Config" tab (columns: key,
// value) in the same Sheet used for everything else. Right now the only
// key used is "driveFolderId" — the Drive folder new templates and
// documents get uploaded into, settable from the app's Settings screen
// instead of only through Render's environment variables. Add more keys
// the same way if other admin-editable settings come up later.
const TAB = "Config";
const HEADER = ["key", "value"];

export async function getConfigValue(auth, key, fallback = "") {
  const { rows } = await readRows(auth, TAB);
  const match = rows.find((r) => r.key === key);
  return match && match.value ? match.value : fallback;
}

export async function setConfigValue(auth, key, value) {
  const { rows } = await readRows(auth, TAB);
  const match = rows.find((r) => r.key === key);
  if (match) await updateRow(auth, TAB, match._row, HEADER, { key, value });
  else await appendRow(auth, TAB, HEADER, { key, value });
}