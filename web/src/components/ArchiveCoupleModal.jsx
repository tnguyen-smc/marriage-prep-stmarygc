import React, { useState } from "react";
import { X } from "lucide-react";
import { ink, parchment, brick, FONT_SERIF, FONT_SANS, inputStyle } from "../theme.js";
import { Field } from "./Shared.jsx";

const PRESET_REASONS = ["Did not complete prep", "Wedding cancelled/postponed indefinitely", "Moved to another parish", "Other"];

export default function ArchiveCoupleModal({ open, couple, onClose, onArchive }) {
  const [reasonPreset, setReasonPreset] = useState(PRESET_REASONS[0]);
  const [note, setNote] = useState("");

  if (!open) return null;

  const handleArchive = () => {
    const reason = reasonPreset === "Other" ? note.trim() : `${reasonPreset}${note.trim() ? " — " + note.trim() : ""}`;
    onArchive(reason || "No reason given");
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(43,58,66,0.45)" }}>
      <div className="w-full max-w-[480px] rounded-xl p-6 sm:p-7" style={{ background: parchment }}>
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-[19px]" style={{ fontFamily: FONT_SERIF, color: ink }}>Archive {couple.groom} &amp; {couple.bride}</h3>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-black/5"><X size={18} color={ink} /></button>
        </div>

        <p className="text-[13px] mb-5" style={{ color: "#8A8378", fontFamily: FONT_SANS }}>
          Archived couples are hidden from the main directory but kept for your records under the "Archived" tab.
        </p>

        <div className="mb-4">
          <Field label="Reason">
            <select value={reasonPreset} onChange={(e) => setReasonPreset(e.target.value)} style={inputStyle}>
              {PRESET_REASONS.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </Field>
        </div>

        <Field label={reasonPreset === "Other" ? "Note" : "Additional note (optional)"}>
          <textarea value={note} onChange={(e) => setNote(e.target.value)} style={{ ...inputStyle, minHeight: "80px", resize: "vertical" }} />
        </Field>

        <div className="flex justify-end gap-3 mt-6">
          <button onClick={onClose} className="px-5 py-3 rounded-lg text-[15px]" style={{ fontFamily: FONT_SANS, color: ink, border: "1px solid #E4DDD0" }}>Cancel</button>
          <button
            onClick={handleArchive}
            disabled={reasonPreset === "Other" && !note.trim()}
            className="px-5 py-3 rounded-lg text-[15px] text-white"
            style={{ fontFamily: FONT_SANS, background: brick }}
          >
            Archive couple
          </button>
        </div>
      </div>
    </div>
  );
}