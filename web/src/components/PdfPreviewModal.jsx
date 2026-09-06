import React from "react";
import { X, FileText } from "lucide-react";
import { ink, bronze, FONT_SANS } from "../theme.js";

export default function PdfPreviewModal({ onClose, previewUrl, status, title }) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col" style={{ background: "rgba(43,58,66,0.55)" }}>
      <div className="flex-shrink-0 flex items-center justify-between px-4 sm:px-6 py-3.5" style={{ background: "#FFFFFF", borderBottom: "1px solid #E4DDD0" }}>
        <div className="flex items-center gap-3 min-w-0">
          <FileText size={16} color={bronze} className="flex-shrink-0" />
          <span className="text-[14px] truncate" style={{ fontFamily: FONT_SANS, color: ink }}>{title} — live preview</span>
        </div>
        <button onClick={onClose} className="ml-3 flex items-center gap-2 px-4 py-2 rounded-lg text-[14px] flex-shrink-0" style={{ background: ink, color: "#fff", fontFamily: FONT_SANS }}>
          <X size={15} />
          Close preview
        </button>
      </div>
      <div className="flex-1" style={{ background: "#525659" }}>
        {status === "loading" && <div className="h-full flex items-center justify-center text-[14px]" style={{ color: "#FAF7F0", fontFamily: FONT_SANS }}>Loading the PDF…</div>}
        {status === "error" && <div className="h-full flex items-center justify-center text-center px-8 text-[14px]" style={{ color: "#FAF7F0", fontFamily: FONT_SANS }}>Couldn't load this template's PDF.</div>}
        {status === "ready" && previewUrl && <iframe title="PDF preview" src={previewUrl} className="w-full h-full border-0" />}
      </div>
    </div>
  );
}
