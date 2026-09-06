import React, { useState, useRef } from "react";
import { X, Upload, FileText } from "lucide-react";
import { ink, parchment, bronze, sage, FONT_SERIF, FONT_SANS, inputStyle } from "../theme.js";
import { Field } from "./Shared.jsx";

/** Strips a file extension for use as a default title, e.g.
 *  "baptismal_cert_scan.pdf" -> "baptismal_cert_scan". */
function nameWithoutExtension(filename) {
  const idx = filename.lastIndexOf(".");
  return idx > 0 ? filename.slice(0, idx) : filename;
}

export default function UploadDocumentModal({ open, onClose, onUpload }) {
  const [file, setFile] = useState(null);
  const [title, setTitle] = useState("");
  const [dragActive, setDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const inputRef = useRef(null);

  if (!open) return null;

  const pickFile = (f) => {
    if (!f) return;
    setFile(f);
    // Pre-fill the title from the filename, but the priest can rename
    // it to whatever's actually meaningful ("Baptismal Certificate"
    // rather than "IMG_4821_scan.pdf").
    setTitle(nameWithoutExtension(f.name));
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragActive(false);
    pickFile(e.dataTransfer.files?.[0]);
  };

  const handleClose = () => {
    setFile(null);
    setTitle("");
    setError(null);
    onClose();
  };

  const handleUpload = async () => {
    if (!file || !title.trim()) return;
    setUploading(true);
    setError(null);
    try {
      await onUpload(title.trim(), file);
      handleClose();
    } catch (e) {
      setError(e.message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(43,58,66,0.45)" }}>
      <div className="w-full max-w-[480px] rounded-xl p-6 sm:p-7" style={{ background: parchment }}>
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-[19px]" style={{ fontFamily: FONT_SERIF, color: ink }}>Upload document</h3>
          <button onClick={handleClose} className="p-2 rounded-full hover:bg-black/5"><X size={18} color={ink} /></button>
        </div>

        <div
          onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
          onDragLeave={() => setDragActive(false)}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
          className="rounded-lg border-2 border-dashed flex flex-col items-center justify-center text-center px-6 py-10 mb-5 cursor-pointer transition-colors"
          style={{ borderColor: dragActive ? bronze : "#E4DDD0", background: dragActive ? "#F7EEE0" : "#FFFFFF" }}
        >
          {file ? (
            <>
              <FileText size={28} color={sage} className="mb-3" />
              <div className="text-[14px]" style={{ fontFamily: FONT_SANS, color: ink }}>{file.name}</div>
              <div className="text-[12px] mt-1" style={{ color: "#8A8378", fontFamily: FONT_SANS }}>Tap to choose a different file</div>
            </>
          ) : (
            <>
              <Upload size={28} color="#B7AF9F" className="mb-3" />
              <div className="text-[14px]" style={{ fontFamily: FONT_SANS, color: ink }}>Drag a file here, or tap to browse</div>
              <div className="text-[12px] mt-1" style={{ color: "#8A8378", fontFamily: FONT_SANS }}>Baptismal or confirmation certificates, dispensations, scans</div>
            </>
          )}
          <input
            ref={inputRef}
            type="file"
            className="hidden"
            onChange={(e) => pickFile(e.target.files?.[0])}
          />
        </div>

        <div className="mb-2">
          <Field label="Document title (this is what's shown, not the file name)">
            <input value={title} onChange={(e) => setTitle(e.target.value)} style={inputStyle} />
          </Field>
        </div>

        {error && <div className="text-[13px] mb-4" style={{ color: "#8B3A3A", fontFamily: FONT_SANS }}>{error}</div>}

        <div className="flex justify-end gap-3 mt-6">
          <button onClick={handleClose} className="px-5 py-3 rounded-lg text-[15px]" style={{ fontFamily: FONT_SANS, color: ink, border: "1px solid #E4DDD0" }}>Cancel</button>
          <button
            onClick={handleUpload}
            disabled={!file || !title.trim() || uploading}
            className="px-5 py-3 rounded-lg text-[15px] text-white"
            style={{ fontFamily: FONT_SANS, background: file && title.trim() ? bronze : "#B7AF9F", cursor: file && title.trim() ? "pointer" : "not-allowed" }}
          >
            {uploading ? "Uploading…" : "Upload"}
          </button>
        </div>
      </div>
    </div>
  );
}