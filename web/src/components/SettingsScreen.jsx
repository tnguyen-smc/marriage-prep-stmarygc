import React, { useState } from "react";
import { ChevronLeft, Upload, FileText, Trash2, Save, Plus } from "lucide-react";
import { ink, bronze, sage, brick, FONT_SERIF, FONT_SANS, inputStyle } from "../theme.js";
import { api } from "../api.js";

function PriestRow({ priest, onSaved, onRemoved }) {
  const [title, setTitle] = useState(priest.title);
  const [name, setName] = useState(priest.name);
  const [email, setEmail] = useState(priest.email);
  const [saving, setSaving] = useState(false);

  const dirty = title !== priest.title || name !== priest.name || email !== priest.email;

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.priests.update(priest.id, { title, name, email });
      onSaved();
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async () => {
    if (!confirm(`Remove ${priest.name || "this priest"} from the roster?`)) return;
    await api.priests.remove(priest.id);
    onRemoved();
  };

  return (
    <div className="rounded-lg border p-4" style={{ borderColor: "#E4DDD0", background: "#FFFFFF" }}>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
        <div>
          <div className="text-[12px] mb-1.5" style={{ color: "#8A8378", fontFamily: FONT_SANS }}>Title</div>
          <input value={title} onChange={(e) => setTitle(e.target.value)} style={inputStyle} />
        </div>
        <div>
          <div className="text-[12px] mb-1.5" style={{ color: "#8A8378", fontFamily: FONT_SANS }}>Name</div>
          <input value={name} onChange={(e) => setName(e.target.value)} style={inputStyle} />
        </div>
        <div>
          <div className="text-[12px] mb-1.5" style={{ color: "#8A8378", fontFamily: FONT_SANS }}>Email (used to sign in)</div>
          <input value={email} onChange={(e) => setEmail(e.target.value)} style={inputStyle} />
        </div>
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={handleSave}
          disabled={!dirty || saving}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-[13px] text-white"
          style={{ background: dirty ? sage : "#B7AF9F", fontFamily: FONT_SANS, cursor: dirty ? "pointer" : "not-allowed" }}
        >
          <Save size={14} />
          {saving ? "Saving…" : "Save"}
        </button>
        <button
          onClick={handleRemove}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-[13px]"
          style={{ color: brick, border: "1px solid #E4DDD0", fontFamily: FONT_SANS }}
        >
          <Trash2 size={14} />
          Remove
        </button>
      </div>
    </div>
  );
}

export default function SettingsScreen({ templates, priests, onBack, onTemplatesChanged, onPriestsChanged }) {
  const [title, setTitle] = useState("");
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const [addingPriest, setAddingPriest] = useState(false);

  const canUpload = title.trim() && file && !uploading;

  const handleUpload = async () => {
    if (!canUpload) return;
    setUploading(true);
    setError(null);
    try {
      await api.templates.upload(title.trim(), file);
      setTitle("");
      setFile(null);
      onTemplatesChanged();
    } catch (e) {
      setError(e.message);
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteTemplate = async (id) => {
    if (!confirm("Delete this template? Couples already using it keep their saved answers, but the fillable PDF is removed.")) return;
    await api.templates.remove(id);
    onTemplatesChanged();
  };

  const handleAddPriest = async () => {
    setAddingPriest(true);
    try {
      await api.priests.create({ title: "", name: "", email: "" });
      onPriestsChanged();
    } finally {
      setAddingPriest(false);
    }
  };

  return (
    <div className="min-h-screen" style={{ background: "#FAF7F0" }}>
      <div className="flex items-center gap-4 px-5 sm:px-8 py-4 border-b" style={{ borderColor: "#E4DDD0", background: "#FFFFFF" }}>
        <button onClick={onBack} className="p-2 rounded-full hover:bg-black/5"><ChevronLeft size={20} color={ink} /></button>
        <h1 className="text-[20px]" style={{ fontFamily: FONT_SERIF, color: ink }}>Settings</h1>
      </div>

      <div className="max-w-2xl mx-auto px-5 sm:px-8 py-8">
        <div className="mb-8">
          <div className="flex items-center justify-between mb-1">
            <h2 className="text-[16px]" style={{ fontFamily: FONT_SANS, color: ink, fontWeight: 600 }}>Priests</h2>
            <button
              onClick={handleAddPriest}
              disabled={addingPriest}
              className="flex items-center gap-2 px-3.5 py-2 rounded-lg text-[13px]"
              style={{ border: "1px solid #E4DDD0", color: ink, fontFamily: FONT_SANS }}
            >
              <Plus size={14} />
              Add another priest
            </button>
          </div>
          <p className="text-[13px] mb-4" style={{ color: "#8A8378", fontFamily: FONT_SANS }}>
            Whoever's email is set here can sign in. Title is shown next to their name at intake and can be changed to anything (Pastor, Parochial Vicar, Associate Pastor, or your own wording).
          </p>
          <div className="space-y-3">
            {priests.length === 0 && (
              <div className="rounded-lg border p-4 text-[13px]" style={{ borderColor: "#E4DDD0", background: "#FFFFFF", color: "#8A8378", fontFamily: FONT_SANS }}>
                No priests on the roster yet.
              </div>
            )}
            {priests.map((p) => (
              <PriestRow key={p.id} priest={p} onSaved={onPriestsChanged} onRemoved={onPriestsChanged} />
            ))}
          </div>
        </div>

        <div className="rounded-lg border p-5 mb-8" style={{ borderColor: "#E4DDD0", background: "#FFFFFF" }}>
          <h2 className="text-[16px] mb-4" style={{ fontFamily: FONT_SANS, color: ink, fontWeight: 600 }}>Upload a fillable PDF</h2>

          <div className="mb-4">
            <div className="text-[12px] mb-1.5" style={{ color: "#8A8378", fontFamily: FONT_SANS }}>Title (shown to priests at intake)</div>
            <input value={title} onChange={(e) => setTitle(e.target.value)} style={inputStyle} />
          </div>

          <div className="mb-5">
            <div className="text-[12px] mb-1.5" style={{ color: "#8A8378", fontFamily: FONT_SANS }}>Fillable PDF file</div>
            <input
              type="file"
              accept="application/pdf"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              className="text-[14px]"
              style={{ fontFamily: FONT_SANS, color: ink }}
            />
          </div>

          {error && <div className="text-[13px] mb-4" style={{ color: brick, fontFamily: FONT_SANS }}>{error}</div>}

          <button
            onClick={handleUpload}
            disabled={!canUpload}
            className="flex items-center gap-2 px-5 py-3 rounded-lg text-white text-[14px]"
            style={{ background: canUpload ? bronze : "#B7AF9F", fontFamily: FONT_SANS, cursor: canUpload ? "pointer" : "not-allowed" }}
          >
            <Upload size={16} />
            {uploading ? "Uploading…" : "Upload template"}
          </button>
        </div>

        <h2 className="text-[16px] mb-3" style={{ fontFamily: FONT_SANS, color: ink, fontWeight: 600 }}>Existing templates</h2>
        {templates.length === 0 ? (
          <div className="text-[13px]" style={{ color: "#8A8378", fontFamily: FONT_SANS }}>No templates uploaded yet.</div>
        ) : (
          <div className="rounded-lg border divide-y" style={{ borderColor: "#E4DDD0", background: "#FFFFFF" }}>
            {templates.map((t) => (
              <div key={t.id} className="flex items-center justify-between px-4 py-3.5">
                <div className="flex items-center gap-3 min-w-0">
                  <FileText size={16} color={bronze} className="flex-shrink-0" />
                  <div className="min-w-0">
                    <div className="text-[14px] truncate" style={{ fontFamily: FONT_SANS, color: ink }}>{t.title}</div>
                    <div className="text-[11px]" style={{ color: "#8A8378", fontFamily: FONT_SANS }}>
                      Uploaded {new Date(t.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                </div>
                <button onClick={() => handleDeleteTemplate(t.id)} className="p-2 rounded-lg hover:bg-black/5 flex-shrink-0">
                  <Trash2 size={16} color={brick} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}