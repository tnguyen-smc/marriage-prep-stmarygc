import { PDFDocument } from "pdf-lib";

// This is the key simplification vs. the old hand-mapped diocese-specific
// field tables: instead of a human transcribing every field name out of
// ONE known PDF ahead of time, we ask pdf-lib what fields the PDF
// actually has, at runtime, for whatever PDF the priest just uploaded.
// That's what makes arbitrary uploaded PDFs possible at all.

/** Reads a PDF's real AcroForm fields into a simple, renderable shape. */
export async function introspectFields(bytes) {
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
