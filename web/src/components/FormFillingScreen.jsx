import React, { useState, useEffect, useRef } from "react";
import { Calendar, Cloud, RefreshCw, ChevronLeft, Eye } from "lucide-react";
import { ink, sage, bronze, FONT_SERIF, FONT_SANS } from "../theme.js";
import { formatDate } from "../data/helpers.js";
import { useTemplatePdf } from "../hooks/useTemplatePdf.js";
import DynamicFieldForm from "./DynamicFieldForm.jsx";
import PdfPreviewModal from "./PdfPreviewModal.jsx";
import { api } from "../api.js";

export default function FormFillingScreen({ couple, templates, onBack, onCoupleUpdated }) {
  const assignedTemplates = templates.filter((t) => couple.templateIds.includes(t.id));
  const [activeTemplateId, setActiveTemplateId] = useState(assignedTemplates[0]?.id || null);

  useEffect(() => {
    if (activeTemplateId && !assignedTemplates.some((t) => t.id === activeTemplateId)) {
      setActiveTemplateId(assignedTemplates[0]?.id || null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [couple.templateIds.join(",")]);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [syncStatus, setSyncStatus] = useState("synced"); // synced | syncing | error
  const [templateData, setTemplateData] = useState(couple.templateData || {});
  const saveTimer = useRef(null);

  const activeValues = templateData[activeTemplateId] || {};
  const { fields, previewUrl, status: pdfStatus, saveStatus: driveSaveStatus } = useTemplatePdf(couple.id, activeTemplateId, activeValues);
  const activeTemplate = assignedTemplates.find((t) => t.id === activeTemplateId);
  const combinedStatus =
    syncStatus === "error" || driveSaveStatus === "error" ? "error" :
    syncStatus === "syncing" || driveSaveStatus === "saving" ? "syncing" :
    "synced";

  const updateField = (name, val) => {
    setTemplateData((prev) => ({ ...prev, [activeTemplateId]: { ...(prev[activeTemplateId] || {}), [name]: val } }));
  };

  // Debounced save to the real Google Sheet whenever answers change.
  useEffect(() => {
    setSyncStatus("syncing");
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      try {
        const updated = await api.couples.update(couple.id, {
          templateData,
          lastAppointment: new Date().toISOString().slice(0, 10),
        });
        onCoupleUpdated(updated);
        setSyncStatus("synced");
      } catch (e) {
        setSyncStatus("error");
      }
    }, 800);
    return () => clearTimeout(saveTimer.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [templateData]);

  return (
    <div className="h-screen flex flex-col" style={{ background: "#FAF7F0" }}>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-4 sm:px-6 py-4 border-b flex-shrink-0" style={{ borderColor: "#E4DDD0", background: "#FFFFFF" }}>
        <div className="flex items-center gap-4 min-w-0">
          <button onClick={onBack} className="p-2 rounded-full hover:bg-black/5 flex-shrink-0"><ChevronLeft size={20} color={ink} /></button>
          <div className="min-w-0">
            <div className="text-[19px] leading-tight truncate" style={{ fontFamily: FONT_SERIF, color: ink }}>{couple.groom} &amp; {couple.bride}</div>
            <div className="text-[13px] mt-0.5 flex items-center gap-1.5 flex-wrap" style={{ color: "#8A8378", fontFamily: FONT_SANS }}>
              <Calendar size={13} /> {formatDate(couple.weddingDate)}
              {couple.priest && (
                <>
                  <span style={{ color: "#B7AF9F" }}>·</span>
                  Priest: {couple.priest}
                </>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
          <div className="flex items-center gap-2 px-3 py-2 rounded-full text-[13px]" style={{ fontFamily: FONT_SANS, color: combinedStatus === "synced" ? sage : combinedStatus === "error" ? "#8B3A3A" : bronze, background: combinedStatus === "synced" ? "#EEF2EE" : "#F7EEE0" }}>
            {combinedStatus === "syncing" ? <RefreshCw size={14} className="animate-spin" /> : <Cloud size={14} />}
            {combinedStatus === "synced" ? "Saved" : combinedStatus === "error" ? "Save failed — retrying" : "Saving…"}
          </div>
          {activeTemplateId && (
            <button onClick={() => setPreviewOpen(true)} className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-[14px]" style={{ border: "1px solid #E4DDD0", color: ink, fontFamily: FONT_SANS }}>
              <Eye size={15} />
              Preview PDF
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-1 min-h-0 flex-col md:flex-row">
        <div className="flex md:flex-col flex-shrink-0 border-b md:border-b-0 md:border-r overflow-x-auto md:overflow-y-auto md:w-[260px]" style={{ borderColor: "#E4DDD0" }}>
          <div className="hidden md:block px-5 pt-5 pb-2 text-[11px] tracking-wide" style={{ color: "#8A8378", fontFamily: FONT_SANS }}>ASSIGNED FORMS</div>
          {assignedTemplates.length === 0 && (
            <div className="px-5 py-4 text-[13px]" style={{ color: "#8A8378", fontFamily: FONT_SANS }}>No forms assigned yet. Edit this couple's intake to add one.</div>
          )}
          {assignedTemplates.map((t) => (
            <button
              key={t.id}
              onClick={() => setActiveTemplateId(t.id)}
              className="w-full text-left px-5 py-3.5 border-l-2 flex-shrink-0"
              style={{ borderColor: activeTemplateId === t.id ? bronze : "transparent", background: activeTemplateId === t.id ? "#FFFFFF" : "transparent" }}
            >
              <span className="text-[14.5px]" style={{ fontFamily: FONT_SANS, color: activeTemplateId === t.id ? ink : "#6E675C" }}>{t.title}</span>
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto min-w-0">
          <div className="max-w-3xl mx-auto px-5 sm:px-10 py-8">
            {activeTemplate && <h2 className="text-[24px] mb-6" style={{ fontFamily: FONT_SERIF, color: ink }}>{activeTemplate.title}</h2>}
            {pdfStatus === "loading" && <div className="text-[14px]" style={{ color: "#8A8378", fontFamily: FONT_SANS }}>Reading this PDF's fields…</div>}
            {pdfStatus === "error" && <div className="text-[14px]" style={{ color: "#8B3A3A", fontFamily: FONT_SANS }}>Couldn't load this template's PDF.</div>}
            {pdfStatus === "ready" && (
              <div className="pb-16">
                <DynamicFieldForm fields={fields} values={activeValues} onChange={updateField} />
              </div>
            )}
          </div>
        </div>
      </div>

      {previewOpen && <PdfPreviewModal previewUrl={previewUrl} status={pdfStatus} title={activeTemplate?.title || ""} onClose={() => setPreviewOpen(false)} />}
    </div>
  );
}
