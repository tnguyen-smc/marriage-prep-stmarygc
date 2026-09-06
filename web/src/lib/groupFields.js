// Groups a flat, introspected PDF field list into something efficient to
// fill during a live session, based on naming conventions rather than
// anything hardcoded to one diocese's form:
//   "Groom X" / "Bride X"                  -> paired side-by-side row
//   "<Question> - Groom/Bride Yes/No/N/A"  -> reconstructed Yes/No/N-A
//                                              question row, both sides
//   everything else                        -> General Information,
//                                              one field per row
//
// This is intentionally generic — any template uploaded in Settings that
// follows the same "Groom "/"Bride " and "<label> - Groom/Bride Yes/No"
// naming pattern gets the same efficient layout automatically. A
// template that doesn't follow the convention just puts everything in
// "General Information", which is exactly the old flat-list behavior —
// nothing breaks, it just doesn't get the extra grouping.

const SIDE_PREFIX_RE = /^(Groom|Bride)\s+(.*)$/;
const YES_NO_NA_RE = /^(.*?)\s*-\s*(Groom|Bride)\s+(Yes|No|N\/?A)$/i;

export function groupFields(fields) {
  const paired = new Map(); // suffix -> { groom?, bride? }
  const pairedOrder = [];
  const testimony = new Map(); // question -> { groomYes, groomNo, groomNa?, brideYes, brideNo, brideNa? }
  const testimonyOrder = [];
  const general = [];

  for (const f of fields) {
    if (f.kind === "checkbox") {
      const m = f.name.match(YES_NO_NA_RE);
      if (m) {
        const [, question, side, answer] = m;
        if (!testimony.has(question)) {
          testimony.set(question, {});
          testimonyOrder.push(question);
        }
        const entry = testimony.get(question);
        const sideKey = side.toLowerCase();
        const answerKey = /^yes$/i.test(answer) ? "yes" : /^no$/i.test(answer) ? "no" : "na"; // else "N/A" or "NA"
        entry[`${sideKey}${answerKey.charAt(0).toUpperCase()}${answerKey.slice(1)}`] = f.name;
        continue;
      }
      general.push(f);
      continue;
    }

    const m = f.name.match(SIDE_PREFIX_RE);
    if (m && (f.kind === "text" || f.kind === "dropdown" || f.kind === "radio")) {
      const [, side, suffix] = m;
      if (!paired.has(suffix)) {
        paired.set(suffix, {});
        pairedOrder.push(suffix);
      }
      paired.get(suffix)[side.toLowerCase()] = f;
      continue;
    }

    general.push(f);
  }

  return { paired, pairedOrder, testimony, testimonyOrder, general };
}

/** Turns a `groupFields` result into an ordered list of the sections that
 *  actually have content, e.g. for rendering as sidebar sub-navigation.
 *  Always returns the same three possible keys in the same order, so a
 *  section's identity is stable across renders regardless of the PDF. */
export function getSections(grouped) {
  const sections = [
    { key: "groomBride", label: "Groom & Bride", count: grouped.pairedOrder.length },
    { key: "testimony", label: "Prenuptial Testimony", count: grouped.testimonyOrder.length },
    { key: "general", label: "General Information", count: grouped.general.length },
  ];
  return sections.filter((s) => s.count > 0);
}

/** Turns a raw PDF field name/label fragment into a readable label. */
export function humanize(name) {
  return name
    .replace(/_/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^./, (c) => c.toUpperCase());
}