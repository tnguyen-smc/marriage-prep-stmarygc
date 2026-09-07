import { google } from "googleapis";

// The whole "database" is one Google Sheet with two tabs: "Templates"
// and "Couples". You create these two tabs by hand once (see README.md,
// "Set up the Google Sheet") — that's simpler and more transparent than
// having the server silently create/reshape sheets for you.

const SHEET_ID = process.env.GOOGLE_SHEET_ID;

function sheetsClient(auth) {
  return google.sheets({ version: "v4", auth });
}

function columnLetter(n) {
  let s = "";
  while (n > 0) {
    const rem = (n - 1) % 26;
    s = String.fromCharCode(65 + rem) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

/**
 * Makes sure a tab's actual header row (row 1) has every column the code
 * expects, appending any missing ones at the end. This is what lets
 * adding a new field to the app (a new entry in some route's HEADER
 * array) "just work" against an existing Sheet, without anyone having to
 * remember to hand-edit the spreadsheet every time — and just as
 * importantly, it un-orphans data that was already written into a column
 * with no label yet: `appendRow`/`updateRow` always write values
 * positionally according to the code's HEADER order, but `readRows` maps
 * them back using whatever header row actually exists in the sheet, so a
 * column the code knows about but the sheet's header row doesn't (yet)
 * mention makes that data invisible on read even though it's sitting
 * right there. Fixing the header immediately makes it visible again —
 * nothing needs to be re-imported or re-entered.
 *
 * Refuses to touch anything if the existing header doesn't match the
 * expected order at all (e.g. someone manually reordered columns) —
 * that needs a human to sort out, not an automatic rewrite that could
 * silently scramble which column means what.
 */
async function ensureHeader(auth, tab, expectedHeader) {
  const sheets = sheetsClient(auth);
  const res = await sheets.spreadsheets.values.get({ spreadsheetId: SHEET_ID, range: `${tab}!A1:Z1` });
  const current = (res.data.values && res.data.values[0]) || [];

  // Validate whatever overlaps between the two, regardless of which one
  // is longer — checking length first (as an earlier version of this
  // function did) would let a same-length-but-reordered header slip
  // through as "already fine" without ever comparing its actual content.
  const checkLen = Math.min(current.length, expectedHeader.length);
  const prefixMatches = expectedHeader.slice(0, checkLen).every((h, i) => h === current[i]);
  if (!prefixMatches) {
    throw new Error(
      `The "${tab}" tab's header row doesn't match what this app expects — check that its columns are in exactly this order: ${expectedHeader.join(", ")}`
    );
  }
  if (current.length >= expectedHeader.length) return; // already has everything (or more)

  const missing = expectedHeader.slice(current.length);
  const startCol = current.length + 1; // 1-based column index for the first missing header
  await sheets.spreadsheets.values.update({
    spreadsheetId: SHEET_ID,
    range: `${tab}!${columnLetter(startCol)}1`,
    valueInputOption: "RAW",
    requestBody: { values: [missing] },
  });
}

/** Reads a tab into { header, rows }. Each row is an object keyed by
 *  the header, plus a `_row` giving its 1-based row number in the
 *  sheet (row 1 is the header), so callers can update/delete it later.
 *  Pass `expectedHeader` (the same HEADER array a route uses for
 *  writes) to self-heal a header row that's missing a column the code
 *  added later — without it, a plain reload can't un-orphan data on its
 *  own; it'd only get fixed the next time something writes to that tab. */
export async function readRows(auth, tab, expectedHeader) {
  if (expectedHeader) await ensureHeader(auth, tab, expectedHeader);
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
  await ensureHeader(auth, tab, header);
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
  await ensureHeader(auth, tab, header);
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