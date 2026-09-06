import React, { useState, useRef } from "react";
import {
  ChevronLeft, Calendar, Mail, Phone, FileText, Upload, Trash2,
  Plus, Check, Pencil, Archive, ExternalLink, Link2
} from "lucide-react";
import { ink, sage, bronze, brick, FONT_SERIF, FONT_SANS, inputStyle } from "../theme.js";
import { formatDate, STATUS_STYLES } from "../data/helpers.js";
import { StatusPill } from "./Shared.jsx";
import CalendarModal from "./CalendarModal.jsx";
import ArchiveCoupleModal from "./ArchiveCoupleModal.jsx";
import UploadDocumentModal from "./UploadDocumentModal.jsx";
import { api, API_URL } from "../api.js";

/** An inline field that shows text until you tap Edit, then saves on blur. */
function EditableField({ label, value, type = "text", icon, onSave }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value || "");

  const commit = async () => {
    setEditing(false);
    if (draft !== value) await onSave(draft);
  };

  return (
    <div>
      <div className="text-[12px] mb-1 flex items-center gap-1.5" style={{ color: "#8A8378", fontFamily: FONT_SANS }}>
        {icon}
        {label}
      </div>
      {editing ? (
        <input
          autoFocus
          type={type}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
          style={{ ...inputStyle, fontSize: "15px" }}
        />
      ) : (
        <button
          onClick={() => { setDraft(value || ""); setEditing(true); }}
          className="w-full text-left px-3 py-2.5 rounded-lg border border-transparent hover:border-[#E4DDD0] group flex items-center justify-between gap-2"
          style={{ fontFamily: FONT_SANS, color: ink, fontSize: "15px" }}
        >
          <span>{type === "date" ? formatDate(value) : (value || "—")}</span>
          <Pencil size={13} className="opacity-0 group-hover:opacity-100 flex-shrink-0" color="#B7AF9F" />
        </button>
      )}
    </div>
  );
}

export default function CoupleProfileScreen({ couple, templates, priests, isAdmin, onBack, onOpenForms, onCoupleUpdated, onCoupleDeleted }) {
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [addFormOpen, setAddFormOpen] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [justUploaded, setJustUploaded] = useState(null); // title of the most recently uploaded document
  const [copied, setCopied] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const successTimer = useRef(null);

  const assigned = templates.filter((t) => couple.templateIds.includes(t.id));
  const unassigned = templates.filter((t) => !couple.templateIds.includes(t.id));
  const profileUrl = `${window.location.origin}${import.meta.env.BASE_URL.replace(/\/$/, "")}/couples/${couple.slug}`;

  const patch = async (payload) => {
    const updated = await api.couples.update(couple.id, payload);
    onCoupleUpdated(updated);
  };

  const handleUpload = async (title, file) => {
    const updated = await api.couples.documents.upload(couple.id, title, file);
    onCoupleUpdated(updated);
    setJustUploaded(title);
    clearTimeout(successTimer.current);
    successTimer.current = setTimeout(() => setJustUploaded(null), 5000);
  };

  const removeDoc = async (docId) => {
    if (!confirm("Remove this document? It will also be deleted from Drive.")) return;
    const updated = await api.couples.documents.remove(couple.id, docId);
    onCoupleUpdated(updated);
  };

  const addForm = async (templateId) => {
    await patch({ templateIds: [...couple.templateIds, templateId] });
    setAddFormOpen(false);
  };

  const copyUrl = () => {
    navigator.clipboard?.writeText(profileUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const handleDeleteCouple = async () => {
    const ok = confirm(
      `Permanently delete ${couple.groom} & ${couple.bride}? This removes their record entirely — this can't be undone. ` +
      `Their Drive folder and its files are NOT deleted. If you just want to stop tracking them without losing anything, use Archive instead.`
    );
    if (!ok) return;
    setDeleting(true);
    try {
      await api.couples.remove(couple.id);
      onCoupleDeleted(couple.id);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="min-h-screen" style={{ background: "#FAF7F0" }}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-4 sm:px-6 py-4 border-b" style={{ borderColor: "#E4DDD0", background: "#FFFFFF" }}>
        <div className="flex items-center gap-4 min-w-0">
          <button onClick={onBack} className="p-2 rounded-full hover:bg-black/5 flex-shrink-0"><ChevronLeft size={20} color={ink} /></button>
          <div className="min-w-0">
            <div className="text-[21px] leading-tight truncate" style={{ fontFamily: FONT_SERIF, color: ink }}>
              {couple.groom} &amp; {couple.bride}
            </div>
            <div className="text-[12px] mt-0.5 flex items-center gap-2" style={{ color: "#8A8378", fontFamily: FONT_SANS }}>
              <StatusPill status={couple.status} />
              {couple.priest && <><span style={{ color: "#B7AF9F" }}>·</span> {couple.priest}</>}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={copyUrl} className="flex items-center gap-2 px-3.5 py-2.5 rounded-lg text-[13px]" style={{ border: "1px solid #E4DDD0", color: copied ? sage : "#6E675C", fontFamily: FONT_SANS }}>
            {copied ? <Check size={14} /> : <Link2 size={14} />}
            {copied ? "Link copied" : "Copy link"}
          </button>
          <button
            onClick={() => patch({ status: couple.status === "Completed" ? "In Progress" : "Completed" })}
            className="flex items-center gap-2 px-3.5 py-2.5 rounded-lg text-[13px]"
            style={{ fontFamily: FONT_SANS, color: STATUS_STYLES[couple.status].text, background: couple.status === "Completed" ? "#EEF2EE" : "#F7EEE0" }}
          >
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: STATUS_STYLES[couple.status].dot }} />
            Mark {couple.status === "Completed" ? "In Progress" : "Completed"}
          </button>
          <button onClick={() => setCalendarOpen(true)} className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-white text-[14px]" style={{ background: ink, fontFamily: FONT_SANS }}>
            <Calendar size={15} />
            Schedule next session
          </button>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-5 sm:px-8 py-8 space-y-8">
        {couple.archived && (
          <div className="rounded-lg border px-4 py-3 text-[13px]" style={{ borderColor: "#E4C9C9", background: "#FBF3F3", color: brick, fontFamily: FONT_SANS }}>
            Archived {couple.archivedAt ? `on ${formatDate(couple.archivedAt)}` : ""} — {couple.archivedReason || "no reason given"}
          </div>
        )}

        {/* Details */}
        <section>
          <h2 className="text-[16px] mb-4" style={{ fontFamily: FONT_SANS, color: ink, fontWeight: 600 }}>Details of Couple</h2>
          <div className="rounded-lg border p-5 grid grid-cols-1 sm:grid-cols-2 gap-4" style={{ borderColor: "#E4DDD0", background: "#FFFFFF" }}>
            <EditableField label="Groom" value={couple.groom} onSave={(v) => patch({ groom: v })} />
            <EditableField label="Bride" value={couple.bride} onSave={(v) => patch({ bride: v })} />
            <EditableField label="Groom's email" value={couple.groomEmail} icon={<Mail size={12} />} onSave={(v) => patch({ groomEmail: v })} />
            <EditableField label="Bride's email" value={couple.brideEmail} icon={<Mail size={12} />} onSave={(v) => patch({ brideEmail: v })} />
            <EditableField label="Groom's phone" value={couple.groomPhone} icon={<Phone size={12} />} onSave={(v) => patch({ groomPhone: v })} />
            <EditableField label="Bride's phone" value={couple.bridePhone} icon={<Phone size={12} />} onSave={(v) => patch({ bridePhone: v })} />
            <EditableField label="Started prep" value={couple.prepStartDate} type="date" icon={<Calendar size={12} />} onSave={(v) => patch({ prepStartDate: v })} />
            <EditableField label="Wedding date" value={couple.weddingDate} type="date" icon={<Calendar size={12} />} onSave={(v) => patch({ weddingDate: v })} />
            <EditableField label="Last appointment" value={couple.lastAppointment} type="date" icon={<Calendar size={12} />} onSave={(v) => patch({ lastAppointment: v })} />
            {isAdmin ? (
              <div>
                <div className="text-[12px] mb-1" style={{ color: "#8A8378", fontFamily: FONT_SANS }}>Priest</div>
                <select value={couple.priest || ""} onChange={(e) => patch({ priest: e.target.value })} style={{ ...inputStyle, fontSize: "15px" }}>
                  <option value="">— Select a priest —</option>
                  {priests.filter((p) => p.name.trim()).map((p) => (
                    <option key={p.id} value={p.name}>{p.name} ({p.title})</option>
                  ))}
                </select>
              </div>
            ) : (
              <div>
                <div className="text-[12px] mb-1" style={{ color: "#8A8378", fontFamily: FONT_SANS }}>Priest</div>
                <div className="px-3 py-2.5 text-[15px]" style={{ fontFamily: FONT_SANS, color: ink }}>{couple.priest || "—"}</div>
              </div>
            )}
          </div>
        </section>

        {/* Fillable forms */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-[16px]" style={{ fontFamily: FONT_SANS, color: ink, fontWeight: 600 }}>Fillable forms</h2>
            <div className="flex items-center gap-2">
              {unassigned.length > 0 && (
                <button onClick={() => setAddFormOpen((v) => !v)} className="flex items-center gap-2 px-3.5 py-2 rounded-lg text-[13px]" style={{ border: "1px solid #E4DDD0", color: ink, fontFamily: FONT_SANS }}>
                  <Plus size={14} />
                  Add form
                </button>
              )}
              {assigned.length > 0 && (
                <button onClick={onOpenForms} className="flex items-center gap-2 px-4 py-2 rounded-lg text-white text-[13px]" style={{ background: bronze, fontFamily: FONT_SANS }}>
                  <FileText size={14} />
                  Fill out forms
                </button>
              )}
            </div>
          </div>

          {addFormOpen && (
            <div className="rounded-lg border divide-y mb-3" style={{ borderColor: "#E4DDD0", background: "#FFFFFF" }}>
              {unassigned.map((t) => (
                <button key={t.id} onClick={() => addForm(t.id)} className="w-full text-left px-4 py-3 flex items-center justify-between hover:bg-black/[0.02]">
                  <span className="text-[14px]" style={{ fontFamily: FONT_SANS, color: ink }}>{t.title}</span>
                  <Plus size={14} color={bronze} />
                </button>
              ))}
            </div>
          )}

          {assigned.length === 0 ? (
            <div className="rounded-lg border p-4 text-[13px]" style={{ borderColor: "#E4DDD0", background: "#FFFFFF", color: "#8A8378", fontFamily: FONT_SANS }}>
              No forms assigned yet. Use "Add form" to pick one uploaded in Settings.
            </div>
          ) : (
            <div className="rounded-lg border divide-y" style={{ borderColor: "#E4DDD0", background: "#FFFFFF" }}>
              {assigned.map((t) => {
                const started = Object.keys(couple.templateData?.[t.id] || {}).length > 0;
                return (
                  <div key={t.id} className="flex items-center justify-between px-4 py-3.5">
                    <div className="flex items-center gap-3 min-w-0">
                      <FileText size={16} color={bronze} className="flex-shrink-0" />
                      <div className="min-w-0">
                        <div className="text-[14px] truncate" style={{ fontFamily: FONT_SANS, color: ink }}>{t.title}</div>
                        <div className="text-[11px]" style={{ color: started ? sage : "#B7AF9F", fontFamily: FONT_SANS }}>
                          {started ? "In progress" : "Not started"}
                        </div>
                      </div>
                    </div>
                    <a
                      href={`${API_URL}/api/couples/${couple.id}/templates/${t.id}/file`}
                      target="_blank"
                      rel="noopener"
                      className="flex items-center gap-1.5 text-[12px] flex-shrink-0"
                      style={{ color: "#6E675C", fontFamily: FONT_SANS }}
                    >
                      <ExternalLink size={13} />
                      PDF
                    </a>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Supporting documents */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-[16px]" style={{ fontFamily: FONT_SANS, color: ink, fontWeight: 600 }}>Supporting documents</h2>
            <button onClick={() => setUploadOpen(true)} className="flex items-center gap-2 px-3.5 py-2 rounded-lg text-[13px]" style={{ border: "1px solid #E4DDD0", color: ink, fontFamily: FONT_SANS }}>
              <Upload size={14} />
              Upload document
            </button>
          </div>
          <p className="text-[12px] mb-3" style={{ color: "#8A8378", fontFamily: FONT_SANS }}>
            Baptismal or confirmation certificates, dispensations, prior-marriage paperwork — anything worth keeping on file.
          </p>

          {justUploaded && (
            <div className="flex items-center gap-2 mb-3 px-3.5 py-2.5 rounded-lg text-[13px]" style={{ background: "#EEF2EE", color: sage, fontFamily: FONT_SANS }}>
              <Check size={15} />
              "{justUploaded}" uploaded and saved to this couple's Drive folder.
            </div>
          )}

          {couple.documents.length === 0 ? (
            <div className="rounded-lg border p-4 text-[13px]" style={{ borderColor: "#E4DDD0", background: "#FFFFFF", color: "#8A8378", fontFamily: FONT_SANS }}>
              No documents uploaded yet.
            </div>
          ) : (
            <div className="rounded-lg border divide-y" style={{ borderColor: "#E4DDD0", background: "#FFFFFF" }}>
              {couple.documents.map((d) => (
                <div key={d.id} className="flex items-center justify-between px-4 py-3.5">
                  <div className="flex items-center gap-3 min-w-0">
                    <FileText size={16} color={sage} className="flex-shrink-0" />
                    <div className="min-w-0">
                      <div className="text-[14px] truncate" style={{ fontFamily: FONT_SANS, color: ink }}>{d.name}</div>
                      <div className="text-[11px]" style={{ color: "#8A8378", fontFamily: FONT_SANS }}>
                        Added {new Date(d.uploadedAt).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {d.webViewLink && (
                      <a href={d.webViewLink} target="_blank" rel="noopener" className="p-2 rounded-lg hover:bg-black/5">
                        <ExternalLink size={15} color="#6E675C" />
                      </a>
                    )}
                    <button onClick={() => removeDoc(d.id)} className="p-2 rounded-lg hover:bg-black/5">
                      <Trash2 size={15} color={brick} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="pt-2 flex items-center justify-between">
          {!couple.archived ? (
            <button onClick={() => setArchiveOpen(true)} className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-[13px]" style={{ border: "1px solid #E4DDD0", color: brick, fontFamily: FONT_SANS }}>
              <Archive size={15} />
              Archive this couple
            </button>
          ) : <span />}
          {isAdmin && (
            <button
              onClick={handleDeleteCouple}
              disabled={deleting}
              className="flex items-center gap-1 text-[11px] opacity-50 hover:opacity-100"
              style={{ color: brick, fontFamily: FONT_SANS }}
              title="Permanently delete this couple's record (rare — use Archive instead in almost every case)"
            >
              <Trash2 size={11} />
              {deleting ? "Deleting…" : "Delete couple"}
            </button>
          )}
        </section>
      </div>

      {calendarOpen && (
        <CalendarModal
          couple={couple}
          profileUrl={profileUrl}
          onClose={() => setCalendarOpen(false)}
          onCreated={(updated) => updated && onCoupleUpdated(updated)}
        />
      )}
      <ArchiveCoupleModal
        open={archiveOpen}
        couple={couple}
        onClose={() => setArchiveOpen(false)}
        onArchive={async (reason) => {
          await patch({ archived: true, archivedReason: reason, archivedAt: new Date().toISOString().slice(0, 10) });
          onBack();
        }}
      />
      <UploadDocumentModal open={uploadOpen} onClose={() => setUploadOpen(false)} onUpload={handleUpload} />
    </div>
  );
}