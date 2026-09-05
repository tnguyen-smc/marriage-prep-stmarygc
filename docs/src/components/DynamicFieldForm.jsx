import React from "react";
import { ink, bronze, FONT_SANS, inputStyle } from "../theme.js";
import { ToggleSwitch } from "./Shared.jsx";

/** Turns a raw PDF field name like "how_long_have_you_known_each_other"
 *  or "Present Address 1" into a readable label. Purely cosmetic. */
function humanize(name) {
  return name
    .replace(/_/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^./, (c) => c.toUpperCase());
}

export default function DynamicFieldForm({ fields, values, onChange }) {
  if (fields.length === 0) {
    return (
      <div className="text-[14px]" style={{ color: "#8A8378", fontFamily: FONT_SANS }}>
        This PDF doesn't have any fillable fields pdf-lib recognizes.
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {fields.map((f) => (
        <div key={f.name}>
          <div className="text-[13px] mb-1.5" style={{ color: "#8A8378", fontFamily: FONT_SANS }}>{humanize(f.name)}</div>

          {f.kind === "checkbox" && (
            <div className="flex items-center gap-3">
              <ToggleSwitch checked={!!values[f.name]} onChange={() => onChange(f.name, !values[f.name])} />
              <span className="text-[14px]" style={{ fontFamily: FONT_SANS, color: ink }}>{values[f.name] ? "Checked" : "Unchecked"}</span>
            </div>
          )}

          {(f.kind === "radio" || f.kind === "dropdown") && (
            <select
              value={values[f.name] || ""}
              onChange={(e) => onChange(f.name, e.target.value)}
              style={{ ...inputStyle, fontSize: "16px", padding: "14px 16px" }}
            >
              <option value="">— Select —</option>
              {(f.options || []).map((opt) => <option key={opt} value={opt}>{opt}</option>)}
            </select>
          )}

          {f.kind === "text" && (
            <input
              value={values[f.name] || ""}
              onChange={(e) => onChange(f.name, e.target.value)}
              style={{ ...inputStyle, fontSize: "16px", padding: "14px 16px" }}
              placeholder="Tap to enter"
            />
          )}
        </div>
      ))}
    </div>
  );
}
