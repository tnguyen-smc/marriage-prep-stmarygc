import { PDFDocument, PDFName, PDFDict } from "pdf-lib";

// This is the key simplification vs. the old hand-mapped diocese-specific
// field tables: instead of a human transcribing every field name out of
// ONE known PDF ahead of time, we ask pdf-lib what fields the PDF
// actually has, at runtime, for whatever PDF the priest just uploaded.
// That's what makes arbitrary uploaded PDFs possible at all.

/** A well-formed PDF starts with "%PDF-" and its bytes end with an
 *  "%%EOF" marker (with, at most, a little trailing whitespace/newline
 *  after it — never real content). If a download got cut short — a
 *  network blip, or the server process restarting mid-response under
 *  memory pressure — this fails while the file itself may otherwise
 *  look plausible, which is exactly the case that used to show up as a
 *  confusing "no fillable fields" error with no way to tell it apart
 *  from a PDF that's genuinely just not fillable. */
function looksTruncated(bytes) {
  const bufferView = new Uint8Array(bytes);
  const head = new TextDecoder().decode(bufferView.slice(0, 8));
  if (!head.startsWith("%PDF-")) return true;
  const tailLength = Math.min(bufferView.length, 2048);
  const tail = new TextDecoder().decode(bufferView.slice(bufferView.length - tailLength));
  return !/%%EOF\s*$/.test(tail);
}

/** Some PDFs (often ones built in Adobe LiveCycle Designer) use Adobe's
 *  XFA form format layered inside the PDF instead of, or alongside, a
 *  plain AcroForm. Acrobat has its own XFA rendering engine and reads
 *  those fields fine — but pdf-lib (like most non-Adobe PDF libraries)
 *  only understands the classic AcroForm/Widget structure and sees
 *  nothing at all, even though the fields are real, properly named, and
 *  fully fillable in Acrobat. This is the single most common reason a
 *  "properly named, Adobe reads it fine" PDF still shows zero fields
 *  here — worth checking for explicitly rather than leaving it as an
 *  unexplained dead end. */
function hasXfa(pdfDoc) {
  try {
    const acroFormEntry = pdfDoc.catalog.get(PDFName.of("AcroForm"));
    if (!acroFormEntry) return false;
    const acroForm = pdfDoc.context.lookup(acroFormEntry);
    return acroForm instanceof PDFDict && acroForm.has(PDFName.of("XFA"));
  } catch (_) {
    return false;
  }
}

/** Reads a PDF's real AcroForm fields into a simple, renderable shape. */
export async function introspectFields(bytes) {
  if (looksTruncated(bytes)) {
    throw new Error(
      "This PDF looks incomplete — it was cut off before fully downloading. This is usually a temporary network or server issue, not a problem with the file itself. Try again in a moment."
    );
  }

  const pdfDoc = await PDFDocument.load(bytes);
  const form = pdfDoc.getForm();

  const fields = form
    .getFields()
    .map((field) => {
      const name = field.getName();
      const ctor = field.constructor.name;
      if (ctor === "PDFCheckBox") return { name, kind: "checkbox" };
      if (ctor === "PDFRadioGroup") return { name, kind: "radio", options: field.getOptions() };
      if (ctor === "PDFDropdown") return { name, kind: "dropdown", options: field.getOptions() };
      if (ctor === "PDFOptionList") return { name, kind: "dropdown", options: field.getOptions() };
      if (ctor === "PDFTextField") return { name, kind: "text" };
      return { name, kind: "unsupported" }; // e.g. signature fields — priest signs those by hand
    })
    .filter((f) => f.kind !== "unsupported");

  if (fields.length === 0 && hasXfa(pdfDoc)) {
    throw new Error(
      "This PDF uses Adobe's XFA (LiveCycle) form format. Acrobat can read XFA fields, but pdf-lib — and most non-Adobe PDF tools — cannot see them at all, even though they're real and properly named. To fix: in Acrobat, use Prepare Form to rebuild it as a standard fillable PDF (not LiveCycle Designer), or re-save/print-to-PDF the form to strip the XFA layer, then re-upload it in Settings."
    );
  }

  return fields;
}

/**
 * Fills a PDF's real fields with `values` (keyed by the PDF's own field
 * names — no separate mapping layer needed) and returns the saved bytes.
 * Never calls form.flatten(), so the result stays editable afterward.
 */
export async function fillPdfFields(bytes, values) {
  const pdfDoc = await PDFDocument.load(bytes);
  const form = pdfDoc.getForm();

  form.getFields().forEach((field) => {
    const name = field.getName();
    if (!(name in values)) return;
    const val = values[name];
    try {
      const ctor = field.constructor.name;
      if (ctor === "PDFCheckBox") val ? field.check() : field.uncheck();
      else if (ctor === "PDFRadioGroup" || ctor === "PDFDropdown" || ctor === "PDFOptionList") {
        if (val) field.select(val);
      } else if (ctor === "PDFTextField") {
        field.setText(val || "");
      }
    } catch (_) {
      // Skip fields pdf-lib can't set (e.g. malformed/edge-case fields)
      // rather than letting one bad field break the whole preview.
    }
  });

  return pdfDoc.save();
}