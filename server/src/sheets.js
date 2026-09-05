import { google } from "googleapis";

// The whole "database" is one Google Sheet with two tabs: "Templates"
// and "Couples". You create these two tabs by hand once (see README.md,
// "Set up the Google Sheet") — that's simpler and more transparent than
// having the server silently create/reshape sheets for you.

const SHEET_ID = process.env.GOOGLE_SHEET_ID;

function sheetsClient(auth) {
  return google.sheets({ version: "v4", auth });
}

/** Reads a tab into { header, rows }. Each row is an object keyed by
 *  the header, plus a `_row` giving its 1-based row number in the
 *  sheet (row 1 is the header), so callers can update/delete it later. */
export async function readRows(auth, tab) {
  const sheets = sheetsClient(auth);
  const res = await sheets.spreadsheets.values.get({ spreadsheetId: SHEET_ID, range: `${tab}!A1:Z1000` });
  const [header = [], ...dataRows] = res.data.values || [[]];
  const rows = dataRows
    .filter((r) => r.some((cell) => cell !== undefined && cell !== ""))
    .map((r, i) => {
      const obj = { _row: i + 2 };
      header.forEach((h, idx) => { obj[h] = r[idx] ?? ""; });
      return obj;
    });
  return { header, rows };
}

export async function appendRow(auth, tab, header, rowObj) {
  const sheets = sheetsClient(auth);
  const values = [header.map((h) => rowObj[h] ?? "")];
  await sheets.spreadsheets.values.append({
    spreadsheetId: SHEET_ID,
    range: `${tab}!A1`,
    valueInputOption: "RAW",
    requestBody: { values },
  });
}

export async function updateRow(auth, tab, rowNumber, header, rowObj) {
  const sheets = sheetsClient(auth);
  const values = [header.map((h) => rowObj[h] ?? "")];
  await sheets.spreadsheets.values.update({
    spreadsheetId: SHEET_ID,
    range: `${tab}!A${rowNumber}`,
    valueInputOption: "RAW",
    requestBody: { values },
  });
}

export async function getSheetIdByTitle(auth, tab) {
  const sheets = sheetsClient(auth);
  const meta = await sheets.spreadsheets.get({ spreadsheetId: SHEET_ID });
  const sheet = meta.data.sheets.find((s) => s.properties.title === tab);
  if (!sheet) throw new Error(`Sheet tab "${tab}" not found — see README.md, "Set up the Google Sheet".`);
  return sheet.properties.sheetId;
}

export async function deleteRow(auth, sheetIdNumeric, rowNumber) {
  const sheets = sheetsClient(auth);
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: SHEET_ID,
    requestBody: {
      requests: [{
        deleteDimension: {
          range: { sheetId: sheetIdNumeric, dimension: "ROWS", startIndex: rowNumber - 1, endIndex: rowNumber },
        },
      }],
    },
  });
}
