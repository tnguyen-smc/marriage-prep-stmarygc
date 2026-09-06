import React, { useMemo } from "react";
import { ink, bronze, FONT_SANS, inputStyle } from "../theme.js";
import { ToggleSwitch } from "./Shared.jsx";

/** Turns a raw PDF field name/label fragment into a readable label.
 *  Handles "Groom Present Address Line 1" style names (already readable)
 *  as well as machine-y ones like "how_long_have_you_known_each_other"
 *  or "PriorMarriage" (camelCase from a Q-prefixed checkbox group). */
function humanize(name) {
  return name
    .replace(/_/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^./, (c) => c.toUpperCase());
}

const SIDE_PREFIX_RE = /^(Groom|Bride)\s+(.*)$/;
const YES_NO_NA_RE = /^(.*?)\s*-\s*(Groom|Bride)\s+(Yes|No|N\/?A)$/i;

/**
 * Groups a flat field list into something efficient to fill during a
 * live session, based on naming conventions (not hardcoded to any one
 * diocese's form):
 *   "Groom X" / "Bride X"                    -> paired side-by-side row
 *   "<Question> - Groom/Bride Yes/No/N/A"    -> reconstructed Yes/No/N-A
 *                                                question row, both sides
 *   everything else                          -> General Information,
 *                                                one field per row
 * This turns a 160-field flat list into ~60 rows a priest can move down
 * once, answering both partners' equivalent question together, instead
 * of hunting through everything twice.
 */
function groupFields(fields) {
  const paired = new Map(); // suffix -> { groom?, bride? }
  const pairedOrder = [];
  const testimony = new Map(); // question -> { groomYes, groomNo, groomNA, brideYes, brideNo, brideNA }
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
        const answerKey = /^yes$/i.test(answer) ? "yes" : /^no$/i.test(answer) ? "no" : "na"; // else matches "N/A" or "NA"
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

function SingleControl({ field, value, onChange }) {
  if (!field) return <div className="text-[13px] italic" style={{ color: "#B7AF9F", fontFamily: FONT_SANS }}>—</div>;

  if (field.kind === "checkbox") {
    return (
      <div className="flex items-center gap-3">
        <ToggleSwitch checked={!!value} onChange={() => onChange(field.name, !value)} />
        <span className="text-[13px]" style={{ fontFamily: FONT_SANS, color: ink }}>{value ? "Checked" : "Unchecked"}</span>
      </div>
    );
  }
  if (field.kind === "radio" || field.kind === "dropdown") {
    return (
      <select value={value || ""} onChange={(e) => onChange(field.name, e.target.value)} style={{ ...inputStyle, fontSize: "15px" }}>
        <option value="">— Select —</option>
        {(field.options || []).map((opt) => <option key={opt} value={opt}>{opt}</option>)}
      </select>
    );
  }
  return <input value={value || ""} onChange={(e) => onChange(field.name, e.target.value)} style={{ ...inputStyle, fontSize: "15px" }} />;
}

function PairedRow({ suffix, entry, values, onChange }) {
  return (
    <div>
      <div className="text-[13px] mb-1.5" style={{ color: "#8A8378", fontFamily: FONT_SANS }}>{humanize(suffix)}</div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <div className="text-[10px] mb-1 uppercase tracking-wide" style={{ color: "#4C6A80", fontFamily: FONT_SANS }}>Groom</div>
          <SingleControl field={entry.groom} value={entry.groom && values[entry.groom.name]} onChange={onChange} />
        </div>
        <div>
          <div className="text-[10px] mb-1 uppercase tracking-wide" style={{ color: "#9C5B6B", fontFamily: FONT_SANS }}>Bride</div>
          <SingleControl field={entry.bride} value={entry.bride && values[entry.bride.name]} onChange={onChange} />
        </div>
      </div>
    </div>
  );
}

function YesNoNa({ yes, no, na, values, onChange }) {
  const current = values[yes] ? "yes" : values[no] ? "no" : na && values[na] ? "na" : null;
  const setAnswer = (choice) => {
    if (yes) onChange(yes, choice === "yes");
    if (no) onChange(no, choice === "no");
    if (na) onChange(na, choice === "na");
  };
  const options = [["yes", "Yes"], ["no", "No"], na && ["na", "N/A"]].filter(Boolean);
  return (
    <div className="flex gap-1.5">
      {options.map(([key, label]) => (
        <button
          key={key}
          type="button"
          onClick={() => setAnswer(key)}
          className="px-4 py-2 rounded-lg text-[13px]"
          style={{
            fontFamily: FONT_SANS,
            border: `1px solid ${current === key ? bronze : "#E4DDD0"}`,
            background: current === key ? "#F7EEE0" : "#FFFFFF",
            color: current === key ? bronze : ink,
          }}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function TestimonyRow({ question, entry, values, onChange }) {
  const label = humanize(question.replace(/^Q\d+[a-z]?_/i, ""));
  return (
    <div>
      <div className="text-[13px] mb-1.5" style={{ color: "#8A8378", fontFamily: FONT_SANS }}>{label}</div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <div className="text-[10px] mb-1 uppercase tracking-wide" style={{ color: "#4C6A80", fontFamily: FONT_SANS }}>Groom</div>
          <YesNoNa yes={entry.groomYes} no={entry.groomNo} na={entry.groomNa} values={values} onChange={onChange} />
        </div>
        <div>
          <div className="text-[10px] mb-1 uppercase tracking-wide" style={{ color: "#9C5B6B", fontFamily: FONT_SANS }}>Bride</div>
          <YesNoNa yes={entry.brideYes} no={entry.brideNo} na={entry.brideNa} values={values} onChange={onChange} />
        </div>
      </div>
    </div>
  );
}

function GeneralRow({ field, values, onChange }) {
  return (
    <div>
      <div className="text-[13px] mb-1.5" style={{ color: "#8A8378", fontFamily: FONT_SANS }}>{humanize(field.name)}</div>
      <SingleControl field={field} value={values[field.name]} onChange={onChange} />
    </div>
  );
}

export default function DynamicFieldForm({ fields, values, onChange }) {
  const grouped = useMemo(() => groupFields(fields), [fields]);

  if (fields.length === 0) {
    return (
      <div className="text-[14px]" style={{ color: "#8A8378", fontFamily: FONT_SANS }}>
        This PDF doesn't have any fillable fields pdf-lib recognizes.
      </div>
    );
  }

  const { paired, pairedOrder, testimony, testimonyOrder, general } = grouped;

  return (
    <div className="space-y-10">
      {pairedOrder.length > 0 && (
        <section>
          <h3 className="text-[13px] mb-4 tracking-wide uppercase" style={{ color: "#B7AF9F", fontFamily: FONT_SANS }}>Groom &amp; Bride</h3>
          <div className="space-y-5">
            {pairedOrder.map((suffix) => (
              <PairedRow key={suffix} suffix={suffix} entry={paired.get(suffix)} values={values} onChange={onChange} />
            ))}
          </div>
        </section>
      )}

      {testimonyOrder.length > 0 && (
        <section>
          <h3 className="text-[13px] mb-4 tracking-wide uppercase" style={{ color: "#B7AF9F", fontFamily: FONT_SANS }}>Prenuptial Testimony</h3>
          <div className="space-y-5">
            {testimonyOrder.map((q) => (
              <TestimonyRow key={q} question={q} entry={testimony.get(q)} values={values} onChange={onChange} />
            ))}
          </div>
        </section>
      )}

      {general.length > 0 && (
        <section>
          <h3 className="text-[13px] mb-4 tracking-wide uppercase" style={{ color: "#B7AF9F", fontFamily: FONT_SANS }}>General Information</h3>
          <div className="space-y-5">
            {general.map((f) => (
              <GeneralRow key={f.name} field={f} values={values} onChange={onChange} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}