import { PDFDocument } from "pdf-lib";

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

/** Reads a PDF's real AcroForm fields into a simple, renderable shape. */
export async function introspectFields(bytes) {
  if (looksTruncated(bytes)) {
    throw new Error(
      "This PDF looks incomplete — it was cut off before fully downloading. This is usually a temporary network or server issue, not a problem with the file itself. Try again in a moment."
    );
  }

  const pdfDoc = await PDFDocument.load(bytes);
  const form = pdfDoc.getForm();

  return form
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