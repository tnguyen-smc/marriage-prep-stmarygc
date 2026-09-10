import { PDFDocument } from "pdf-lib";

/* Saddle-fold (half-fold) booklet imposition.
 *
 * Rearranges a document onto 11x17 landscape sheets, two source pages
 * side by side, in the order a folded booklet needs. Works for any page
 * count, not just 4: the count is padded up to the next multiple of 4
 * with blanks, then sheets are laid out as
 *
 *   sheet 1 front : last | 1          sheet 1 back : 2 | second-to-last
 *   sheet 2 front : last-2 | 3        sheet 2 back : 4 | last-3
 *   ...
 *
 * Printed double-sided (short-edge flip), stacked in order, and folded
 * down the middle as one bundle, this reads 1, 2, 3, ... straight
 * through. For counts above 4 the sheets nest inside each other, so keep
 * them in the order they come out of the printer before folding.
 *
 * Because the imposition is baked into the file, nobody has to find the
 * driver's "Booklet" checkbox — only 11x17 paper and 2-sided short-edge,
 * which can be saved as defaults on a dedicated Sharp queue.
 */

const SHEET_W = 17 * 72; // 1224pt — 11x17 landscape
const SHEET_H = 11 * 72; // 792pt

/** Which source page (1-based) goes in each half of each sheet side.
 *  0 means "leave this half blank". */
export function bookletPageOrder(pageCount) {
  const total = Math.ceil(pageCount / 4) * 4;
  const sides = [];
  for (let i = 0; i < total / 4; i++) {
    sides.push([total - 2 * i, 2 * i + 1]);     // front of sheet i
    sides.push([2 * i + 2, total - 2 * i - 1]); // back of sheet i
  }
  // Anything past the real page count is a blank half.
  return sides.map(([l, r]) => [l > pageCount ? 0 : l, r > pageCount ? 0 : r]);
}

export async function imposeAsHalfFoldBooklet(bytes) {
  const src = await PDFDocument.load(bytes);
  const pageCount = src.getPageCount();
  if (pageCount < 2) return bytes;

  const out = await PDFDocument.create();
  const embedded = await out.embedPages(src.getPages());
  const half = SHEET_W / 2;

  for (const [leftNum, rightNum] of bookletPageOrder(pageCount)) {
    const sheet = out.addPage([SHEET_W, SHEET_H]);
    for (const [slot, num] of [[0, leftNum], [1, rightNum]]) {
      if (!num) continue; // blank half
      const ep = embedded[num - 1];
      // Fit each source page into its half, preserving aspect ratio,
      // then center it there.
      const scale = Math.min(half / ep.width, SHEET_H / ep.height);
      const w = ep.width * scale;
      const h = ep.height * scale;
      sheet.drawPage(ep, {
        x: slot * half + (half - w) / 2,
        y: (SHEET_H - h) / 2,
        xScale: scale,
        yScale: scale,
      });
    }
  }

  return await out.save();
}

/** fetched bytes -> blob URL ready for the hidden-iframe print path.
 *  Imposes only when `booklet` is true; otherwise the original file is
 *  printed untouched. */
export async function toPrintableBlobUrl(bytes, booklet = false) {
  const finalBytes = booklet ? await imposeAsHalfFoldBooklet(bytes) : bytes;
  return URL.createObjectURL(new Blob([finalBytes], { type: "application/pdf" }));
}