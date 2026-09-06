import React, { useState, useEffect } from "react";
import { X } from "lucide-react";
import { ink, parchment, FONT_SERIF, FONT_SANS, inputStyle } from "../theme.js";
import { Field, ToggleSwitch } from "./Shared.jsx";

const emptyForm = {
  groom: "", groomEmail: "", groomPhone: "",
  bride: "", brideEmail: "", bridePhone: "",
  weddingDate: "", priest: "", templateIds: {},
};

export default function IntakeModal({ open, onClose, onCreate, templates, priests, profile }) {
  const [form, setForm] = useState(emptyForm);
  const isAdmin = profile?.role === "admin";
  const priestOptions = (priests || []).filter((p) => p.name.trim());

  // Reset on every open so a previous couple's entries/toggles don't linger.
  useEffect(() => {
    if (open) setForm({ ...emptyForm, priest: isAdmin ? "" : (profile?.priestName || "") });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open) return null;

  const toggle = (id) => setForm((f) => ({ ...f, templateIds: { ...f.templateIds, [id]: !f.templateIds[id] } }));
  const canSubmit = form.groom.trim() && form.bride.trim();

  const handleSubmit = () => {
    const templateIds = Object.entries(form.templateIds).filter(([, on]) => on).map(([id]) => id);
    onCreate({
      groom: form.groom.trim(),
      groomEmail: form.groomEmail.trim(),
      groomPhone: form.groomPhone.trim(),
      bride: form.bride.trim(),
      brideEmail: form.brideEmail.trim(),
      bridePhone: form.bridePhone.trim(),
      weddingDate: form.weddingDate,
      priest: form.priest.trim(),
      templateIds,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(43,58,66,0.45)" }}>
      <div className="w-full max-w-[640px] max-h-[85vh] overflow-y-auto rounded-xl p-6 sm:p-8" style={{ background: parchment }}>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-[22px]" style={{ fontFamily: FONT_SERIF, color: ink }}>New couple intake</h2>
          <button type="button" onClick={onClose} className="p-2 rounded-full hover:bg-black/5"><X size={20} color={ink} /></button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-3">
          <Field label="Groom's full name"><input value={form.groom} onChange={(e) => setForm({ ...form, groom: e.target.value })} style={inputStyle} /></Field>
          <Field label="Bride's full name"><input value={form.bride} onChange={(e) => setForm({ ...form, bride: e.target.value })} style={inputStyle} /></Field>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-3">
          <Field label="Groom's email"><input value={form.groomEmail} onChange={(e) => setForm({ ...form, groomEmail: e.target.value })} style={inputStyle} /></Field>
          <Field label="Bride's email"><input value={form.brideEmail} onChange={(e) => setForm({ ...form, brideEmail: e.target.value })} style={inputStyle} /></Field>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
          <Field label="Groom's phone"><input value={form.groomPhone} onChange={(e) => setForm({ ...form, groomPhone: e.target.value })} style={inputStyle} /></Field>
          <Field label="Bride's phone"><input value={form.bridePhone} onChange={(e) => setForm({ ...form, bridePhone: e.target.value })} style={inputStyle} /></Field>
        </div>
        <div className="mb-5">
          <Field label="Target wedding date (optional — a priest can set this later)"><input type="date" value={form.weddingDate} onChange={(e) => setForm({ ...form, weddingDate: e.target.value })} style={{ ...inputStyle, width: "220px" }} /></Field>
        </div>
        <div className="mb-6">
          <Field label="Priest in charge">
            {isAdmin ? (
              <select value={form.priest} onChange={(e) => setForm({ ...form, priest: e.target.value })} style={inputStyle}>
                <option value="">— Select a priest —</option>
                {priestOptions.map((p) => <option key={p.id} value={p.name}>{p.name} ({p.title})</option>)}
              </select>
            ) : (
              <input value={form.priest} disabled style={{ ...inputStyle, background: "#F4F1EA", color: "#8A8378" }} />
            )}
            {isAdmin && priestOptions.length === 0 && (
              <div className="text-[12px] mt-1.5" style={{ color: "#8A8378", fontFamily: FONT_SANS }}>
                No priests configured yet — add them in Settings.
              </div>
            )}
          </Field>
        </div>

        <div className="mb-2 text-[13px] tracking-wide" style={{ color: "#8A8378", fontFamily: FONT_SANS }}>Forms required for this couple</div>
        {templates.length === 0 ? (
          <div className="rounded-lg border p-4 text-[13px]" style={{ borderColor: "#E4DDD0", color: "#8A8378", fontFamily: FONT_SANS }}>
            No PDF templates uploaded yet — add one from Settings first.
          </div>
        ) : (
          <div className="rounded-lg border divide-y" style={{ borderColor: "#E4DDD0" }}>
            {templates.map((t) => (
              <div key={t.id} className="flex items-center justify-between px-4 py-3.5">
                <span className="text-[15px]" style={{ fontFamily: FONT_SANS, color: ink }}>{t.title}</span>
                <ToggleSwitch checked={!!form.templateIds[t.id]} onChange={() => toggle(t.id)} />
              </div>
            ))}
          </div>
        )}

        <div className="flex justify-end gap-3 mt-8">
          <button type="button" onClick={onClose} className="px-5 py-3 rounded-lg text-[15px]" style={{ fontFamily: FONT_SANS, color: ink, border: "1px solid #E4DDD0" }}>Cancel</button>
          <button
            type="button"
            disabled={!canSubmit}
            onClick={handleSubmit}
            className="px-5 py-3 rounded-lg text-[15px] text-white"
            style={{ fontFamily: FONT_SANS, background: canSubmit ? ink : "#B7AF9F", cursor: canSubmit ? "pointer" : "not-allowed" }}
          >
            Add couple
          </button>
        </div>
      </div>
    </div>
  );
}