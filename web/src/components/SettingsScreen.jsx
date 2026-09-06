import React, { useState, useEffect, useRef } from "react";
import { ChevronLeft, Upload, FileText, Trash2, Save, Plus, FolderOpen, Check } from "lucide-react";
import { ink, bronze, sage, brick, FONT_SERIF, FONT_SANS, inputStyle } from "../theme.js";
import { Field } from "./Shared.jsx";
import { api } from "../api.js";

function PriestRow({ priest, onSaved, onRemoved }) {
  const [title, setTitle] = useState(priest.title);
  const [name, setName] = useState(priest.name);
  const [email, setEmail] = useState(priest.email);
  const [saving, setSaving] = useState(false);

  // `useState(priest.title)` only seeds the field once, at mount. Since
  // this row keeps the same React key (priest.id) across re-renders,
  // React reuses this same component instance when the list refreshes
  // after a save — so without this effect, the input can silently drift
  // out of sync with what's actually saved (the write always succeeds;
  // this was purely the displayed value going stale).
  useEffect(() => {
    setTitle(priest.title);
    setName(priest.name);
    setEmail(priest.email);
  }, [priest.id, priest.title, priest.name, priest.email]);

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

function TemplateRow({ template, onRenamed, onDeleted }) {
  const [title, setTitle] = useState(template.title);
  const [saving, setSaving] = useState(false);

  // Same stale-state issue as PriestRow above — resync on every update.
  useEffect(() => {
    setTitle(template.title);
  }, [template.id, template.title]);

  const dirty = title.trim() !== template.title && title.trim().length > 0;

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.templates.rename(template.id, title.trim());
      onRenamed();
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm("Delete this template? Couples already using it keep their saved answers, but the fillable PDF is removed.")) return;
    await api.templates.remove(template.id);
    onDeleted();
  };

  return (
    <div className="flex items-center gap-3 px-4 py-3.5">
      <FileText size={16} color={bronze} className="flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full text-[14px] bg-transparent outline-none rounded px-1 -mx-1 focus:bg-white"
          style={{ fontFamily: FONT_SANS, color: ink }}
        />
        <div className="text-[11px] mt-0.5" style={{ color: "#8A8378", fontFamily: FONT_SANS }}>
          Uploaded {new Date(template.createdAt).toLocaleDateString()}
        </div>
      </div>
      <button
        onClick={handleSave}
        disabled={!dirty || saving}
        className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-[12px] text-white flex-shrink-0"
        style={{ background: dirty ? sage : "#B7AF9F", fontFamily: FONT_SANS, cursor: dirty ? "pointer" : "not-allowed" }}
      >
        <Save size={13} />
        {saving ? "Saving…" : "Rename"}
      </button>
      <button onClick={handleDelete} className="p-2 rounded-lg hover:bg-black/5 flex-shrink-0">
        <Trash2 size={16} color={brick} />
      </button>
    </div>
  );
}

function FolderField({ label, value, onChange }) {
  return (
    <div className="mb-4">
      <div className="text-[12px] mb-1.5" style={{ color: "#8A8378", fontFamily: FONT_SANS }}>{label}</div>
      <div className="flex items-center gap-2">
        <FolderOpen size={16} color={bronze} className="flex-shrink-0" />
        <input value={value} onChange={(e) => onChange(e.target.value)} style={inputStyle} />
      </div>
    </div>
  );
}

function DriveFoldersSetting() {
  const [templatesFolderId, setTemplatesFolderId] = useState("");
  const [couplesFolderId, setCouplesFolderId] = useState("");
  const [saved, setSaved] = useState({ templatesFolderId: "", couplesFolderId: "" });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.settings.get()
      .then((s) => {
        setTemplatesFolderId(s.templatesFolderId);
        setCouplesFolderId(s.couplesFolderId);
        setSaved(s);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const dirty = templatesFolderId !== saved.templatesFolderId || couplesFolderId !== saved.couplesFolderId;

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const s = await api.settings.update({ templatesFolderId, couplesFolderId });
      setTemplatesFolderId(s.templatesFolderId);
      setCouplesFolderId(s.couplesFolderId);
      setSaved((prev) => ({ ...prev, ...s }));
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-lg border p-5" style={{ borderColor: "#E4DDD0", background: "#FFFFFF" }}>
      <h2 className="text-[16px] mb-1" style={{ fontFamily: FONT_SANS, color: ink, fontWeight: 600 }}>Drive folders</h2>
      <p className="text-[13px] mb-4" style={{ color: "#8A8378", fontFamily: FONT_SANS }}>
        Paste each folder's full Drive URL or just its id — either works, including a folder inside a Shared Drive. Changes take effect immediately, no redeploy needed.
      </p>
      {loading ? (
        <div className="text-[13px]" style={{ color: "#8A8378", fontFamily: FONT_SANS }}>Loading…</div>
      ) : (
        <>
          <FolderField label="Master templates folder — where uploads below are stored" value={templatesFolderId} onChange={setTemplatesFolderId} />
          <FolderField label="Couples folder — each couple gets their own subfolder created inside this one automatically, holding their PDF copies and documents together" value={couplesFolderId} onChange={setCouplesFolderId} />
          {error && <div className="text-[13px] mb-3" style={{ color: brick, fontFamily: FONT_SANS }}>{error}</div>}
          <button
            onClick={handleSave}
            disabled={!dirty || saving}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-[13px] text-white"
            style={{ background: dirty ? sage : "#B7AF9F", fontFamily: FONT_SANS, cursor: dirty ? "pointer" : "not-allowed" }}
          >
            <Save size={14} />
            {saving ? "Saving…" : "Save"}
          </button>
        </>
      )}
    </div>
  );
}

function ImportCoupleSetting({ priests, onImported }) {
  const empty = { groom: "", bride: "", priest: "", existingFolder: "" };
  const [form, setForm] = useState(empty);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null); // { importedForms }

  const canImport = form.groom.trim() && form.bride.trim() && form.existingFolder.trim() && !importing;

  const handleImport = async () => {
    if (!canImport) return;
    setImporting(true);
    setError(null);
    setResult(null);
    try {
      const res = await api.couples.import({
        groom: form.groom.trim(),
        bride: form.bride.trim(),
        priest: form.priest,
        existingFolder: form.existingFolder.trim(),
      });
      onImported(res.couple);
      setResult({ importedForms: res.importedForms });
      setForm(empty);
    } catch (e) {
      setError(e.message);
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="rounded-lg border p-5" style={{ borderColor: "#E4DDD0", background: "#FFFFFF" }}>
      <h2 className="text-[16px] mb-1" style={{ fontFamily: FONT_SANS, color: ink, fontWeight: 600 }}>Import an existing couple</h2>
      <p className="text-[13px] mb-4" style={{ color: "#8A8378", fontFamily: FONT_SANS }}>
        For couples already in marriage prep before this app existed, who already have their own Drive folder with fillable copies in it.
        Point this at that existing folder instead of creating a new one — every PDF already in it is pulled in as one of this couple's own
        forms (renameable from their profile, since old files are often labeled inconsistently), rather than creating duplicate copies
        alongside what's already there. Email, phone, and wedding date aren't needed here — a priest can fill those in later on the couple's profile.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-3">
        <Field label="Groom's full name"><input value={form.groom} onChange={(e) => setForm({ ...form, groom: e.target.value })} style={inputStyle} /></Field>
        <Field label="Bride's full name"><input value={form.bride} onChange={(e) => setForm({ ...form, bride: e.target.value })} style={inputStyle} /></Field>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-3">
        <Field label="Priest in charge (optional)">
          <select value={form.priest} onChange={(e) => setForm({ ...form, priest: e.target.value })} style={inputStyle}>
            <option value="">— Select a priest —</option>
            {priests.filter((p) => p.name.trim()).map((p) => <option key={p.id} value={p.name}>{p.name} ({p.title})</option>)}
          </select>
        </Field>
        <Field label="Their existing Drive folder (URL or id)"><input value={form.existingFolder} onChange={(e) => setForm({ ...form, existingFolder: e.target.value })} style={inputStyle} /></Field>
      </div>

      {error && <div className="text-[13px] mb-4" style={{ color: brick, fontFamily: FONT_SANS }}>{error}</div>}

      <button
        onClick={handleImport}
        disabled={!canImport}
        className="flex items-center gap-2 px-5 py-3 rounded-lg text-white text-[14px]"
        style={{ background: canImport ? bronze : "#B7AF9F", fontFamily: FONT_SANS, cursor: canImport ? "pointer" : "not-allowed" }}
      >
        <FolderOpen size={16} />
        {importing ? "Importing…" : "Import couple"}
      </button>

      {result && (
        <div className="mt-4 rounded-lg p-3.5 text-[13px]" style={{ background: "#EEF2EE", color: sage, fontFamily: FONT_SANS }}>
          <div className="flex items-center gap-2 mb-1">
            <Check size={15} />
            Imported. {result.importedForms.length} existing PDF{result.importedForms.length === 1 ? "" : "s"} found and added.
          </div>
          {result.importedForms.length > 0 && (
            <ul className="ml-6 list-disc">
              {result.importedForms.map((title) => <li key={title}>{title}</li>)}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

export default function SettingsScreen({ templates, priests, onBack, onTemplatesChanged, onPriestsChanged, onCoupleImported }) {
  const [title, setTitle] = useState("");
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const [addingPriest, setAddingPriest] = useState(false);
  const [justUploaded, setJustUploaded] = useState(null); // title of the most recently uploaded template
  const fileInputRef = useRef(null);
  const successTimer = useRef(null);

  const canUpload = title.trim() && file && !uploading;

  const handleUpload = async () => {
    if (!canUpload) return;
    setUploading(true);
    setError(null);
    try {
      const uploadedTitle = title.trim();
      await api.templates.upload(uploadedTitle, file);
      setTitle("");
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      onTemplatesChanged();

      // Transient confirmation so it's obvious the upload actually landed,
      // rather than the form just quietly clearing.
      setJustUploaded(uploadedTitle);
      clearTimeout(successTimer.current);
      successTimer.current = setTimeout(() => setJustUploaded(null), 5000);
    } catch (e) {
      setError(e.message);
    } finally {
      setUploading(false);
    }
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

      <div className="max-w-2xl mx-auto px-5 sm:px-8 py-8 space-y-8">
        <div>
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

        <div className="rounded-lg border p-5" style={{ borderColor: "#E4DDD0", background: "#FFFFFF" }}>
          <h2 className="text-[16px] mb-4" style={{ fontFamily: FONT_SANS, color: ink, fontWeight: 600 }}>Upload a fillable PDF</h2>

          <div className="mb-4">
            <div className="text-[12px] mb-1.5" style={{ color: "#8A8378", fontFamily: FONT_SANS }}>Title (shown to priests at intake)</div>
            <input value={title} onChange={(e) => setTitle(e.target.value)} style={inputStyle} />
          </div>

          <div className="mb-5">
            <div className="text-[12px] mb-1.5" style={{ color: "#8A8378", fontFamily: FONT_SANS }}>Fillable PDF file</div>
            <input
              ref={fileInputRef}
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

          {justUploaded && (
            <div className="flex items-center gap-2 mt-4 px-3.5 py-2.5 rounded-lg text-[13px]" style={{ background: "#EEF2EE", color: sage, fontFamily: FONT_SANS }}>
              <Check size={15} />
              "{justUploaded}" uploaded and ready to assign at intake.
            </div>
          )}
        </div>

        <div>
          <h2 className="text-[16px] mb-3" style={{ fontFamily: FONT_SANS, color: ink, fontWeight: 600 }}>Existing templates</h2>
          {templates.length === 0 ? (
            <div className="text-[13px]" style={{ color: "#8A8378", fontFamily: FONT_SANS }}>No templates uploaded yet.</div>
          ) : (
            <div className="rounded-lg border divide-y" style={{ borderColor: "#E4DDD0", background: "#FFFFFF" }}>
              {templates.map((t) => (
                <TemplateRow key={t.id} template={t} onRenamed={onTemplatesChanged} onDeleted={onTemplatesChanged} />
              ))}
            </div>
          )}
        </div>

        <DriveFoldersSetting />

        <ImportCoupleSetting priests={priests} onImported={onCoupleImported} />
      </div>
    </div>
  );
}