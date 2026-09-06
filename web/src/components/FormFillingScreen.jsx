import React, { useState, useEffect, useRef, useCallback } from "react";
import { Calendar, ChevronLeft, Check, ChevronRight as ChevronRightIcon } from "lucide-react";
import * as pdfjsLib from "pdfjs-dist";
import { AnnotationLayer } from "pdfjs-dist";
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import "pdfjs-dist/web/pdf_viewer.css";
import { ink, sage, bronze, brick, FONT_SERIF, FONT_SANS } from "../theme.js";
import { formatDate } from "../data/helpers.js";
import { api } from "../api.js";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

/**
 * Renders one page of the loaded document into a canvas, with a real,
 * interactive form layer (actual <input>/<select> elements, positioned
 * exactly over their fields) laid on top via PDF.js's own AnnotationLayer
 * — the same rendering PDF.js uses in its reference viewer, and closely
 * related to what Chrome/Firefox use for their built-in PDF viewers.
 * Typing into these fields writes directly into `pdfDoc.annotationStorage`,
 * which is what makes Save (pdfDoc.saveDocument()) able to pick up every
 * edit with no separate state-tracking of our own.
 */
function PdfPage({ pdfDoc, pageNumber, containerWidth }) {
  const canvasRef = useRef(null);
  const layerRef = useRef(null);
  const renderTaskRef = useRef(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const page = await pdfDoc.getPage(pageNumber);
      if (cancelled) return;

      const nativeViewport = page.getViewport({ scale: 1 });
      const scale = containerWidth ? containerWidth / nativeViewport.width : 1;
      const viewport = page.getViewport({ scale });

      const canvas = canvasRef.current;
      const layerDiv = layerRef.current;
      if (!canvas || !layerDiv) return;

      canvas.width = viewport.width;
      canvas.height = viewport.height;

      if (renderTaskRef.current) renderTaskRef.current.cancel();
      const renderTask = page.render({ canvasContext: canvas.getContext("2d"), viewport });
      renderTaskRef.current = renderTask;
      try {
        await renderTask.promise;
      } catch (e) {
        if (e?.name === "RenderingCancelledException") return;
        throw e;
      }
      if (cancelled) return;

      layerDiv.innerHTML = "";
      layerDiv.style.width = `${viewport.width}px`;
      layerDiv.style.height = `${viewport.height}px`;

      const annotations = await page.getAnnotations({ intent: "display" });
      if (cancelled) return;

      const annotationLayer = new AnnotationLayer({
        div: layerDiv,
        page,
        viewport: viewport.clone({ dontFlip: true }),
        annotationStorage: pdfDoc.annotationStorage,
      });
      await annotationLayer.render({ annotations, renderForms: true });
    })();

    return () => {
      cancelled = true;
      if (renderTaskRef.current) renderTaskRef.current.cancel();
    };
  }, [pdfDoc, pageNumber, containerWidth]);

  return (
    <div className="relative inline-block shadow-sm bg-white mx-auto">
      <canvas ref={canvasRef} />
      <div ref={layerRef} className="annotationLayer absolute top-0 left-0" />
    </div>
  );
}

export default function FormFillingScreen({ couple, templates, onBack }) {
  const assignedTemplates = templates.filter((t) => couple.templateIds.includes(t.id));
  const [activeTemplateId, setActiveTemplateId] = useState(assignedTemplates[0]?.id || null);
  const [pdfDoc, setPdfDoc] = useState(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [loadStatus, setLoadStatus] = useState("idle"); // idle | loading | ready | error
  const [saveStatus, setSaveStatus] = useState("idle"); // idle | saving | saved | error
  const [errorMessage, setErrorMessage] = useState(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const containerRef = useRef(null);

  const activeTemplate = assignedTemplates.find((t) => t.id === activeTemplateId);

  useEffect(() => {
    if (activeTemplateId && !assignedTemplates.some((t) => t.id === activeTemplateId)) {
      setActiveTemplateId(assignedTemplates[0]?.id || null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [couple.templateIds.join(",")]);

  // Measure available width so pages render at a sensible size and stay
  // responsive across iPad/desktop.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width;
      if (width) setContainerWidth(Math.min(width - 32, 900));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    setPdfDoc(null);
    setPageNumber(1);
    setSaveStatus("idle");
    setErrorMessage(null);
    if (!activeTemplateId) {
      setLoadStatus("idle");
      return;
    }
    let cancelled = false;
    setLoadStatus("loading");
    (async () => {
      try {
        // Always the couple's own copy in their Drive subfolder — never
        // the shared template master (see ensureCoupleCopy on the server).
        const buf = await api.couples.templateFile.fetchBytes(couple.id, activeTemplateId);
        if (cancelled) return;
        const doc = await pdfjsLib.getDocument({ data: new Uint8Array(buf) }).promise;
        if (cancelled) return;
        setPdfDoc(doc);
        setLoadStatus("ready");
      } catch (e) {
        if (!cancelled) {
          setErrorMessage(e.message);
          setLoadStatus("error");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [couple.id, activeTemplateId]);

  const handleSave = useCallback(async () => {
    if (!pdfDoc || !activeTemplateId) return;
    setSaveStatus("saving");
    setErrorMessage(null);
    try {
      const bytes = await pdfDoc.saveDocument();
      await api.couples.templateFile.save(couple.id, activeTemplateId, bytes);
      setSaveStatus("saved");
    } catch (e) {
      setErrorMessage(e.message);
      setSaveStatus("error");
    }
  }, [pdfDoc, couple.id, activeTemplateId]);

  const numPages = pdfDoc?.numPages || 0;

  return (
    <div className="h-screen flex flex-col" style={{ background: "#FAF7F0" }}>
      <div className="flex items-center gap-4 px-4 sm:px-6 py-4 border-b flex-shrink-0" style={{ borderColor: "#E4DDD0", background: "#FFFFFF" }}>
        <button onClick={onBack} className="p-2 rounded-full hover:bg-black/5 flex-shrink-0"><ChevronLeft size={20} color={ink} /></button>
        <div className="min-w-0 flex-1">
          <div className="text-[19px] leading-tight truncate" style={{ fontFamily: FONT_SERIF, color: ink }}>{couple.groom} &amp; {couple.bride}</div>
          <div className="text-[13px] mt-0.5 flex items-center gap-1.5" style={{ color: "#8A8378", fontFamily: FONT_SANS }}>
            <Calendar size={13} /> {formatDate(couple.weddingDate)}
          </div>
        </div>
        {loadStatus === "ready" && (
          <div className="flex items-center gap-3 flex-shrink-0">
            {saveStatus === "saved" && (
              <span className="hidden sm:flex items-center gap-1.5 text-[13px]" style={{ color: sage, fontFamily: FONT_SANS }}>
                <Check size={14} /> Saved to Drive
              </span>
            )}
            {saveStatus === "error" && (
              <span className="hidden sm:inline text-[13px]" style={{ color: brick, fontFamily: FONT_SANS }}>{errorMessage}</span>
            )}
            <button
              onClick={handleSave}
              disabled={saveStatus === "saving"}
              className="px-5 py-2.5 rounded-lg text-white text-[14px]"
              style={{ background: bronze, fontFamily: FONT_SANS }}
            >
              {saveStatus === "saving" ? "Saving…" : "Save to Drive"}
            </button>
          </div>
        )}
      </div>

      <div className="flex flex-1 min-h-0 flex-col md:flex-row">
        <div className="flex md:flex-col flex-shrink-0 border-b md:border-b-0 md:border-r overflow-x-auto md:overflow-y-auto md:w-[260px]" style={{ borderColor: "#E4DDD0" }}>
          <div className="hidden md:block px-5 pt-5 pb-2 text-[11px] tracking-wide" style={{ color: "#8A8378", fontFamily: FONT_SANS }}>ASSIGNED FORMS</div>
          {assignedTemplates.length === 0 && (
            <div className="px-5 py-4 text-[13px]" style={{ color: "#8A8378", fontFamily: FONT_SANS }}>
              No forms assigned yet. Assign one from this couple's profile.
            </div>
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

        <div ref={containerRef} className="flex-1 flex flex-col min-h-0 overflow-y-auto">
          {activeTemplate && (
            <div className="px-5 sm:px-8 pt-6 pb-3 flex-shrink-0">
              <h2 className="text-[22px]" style={{ fontFamily: FONT_SERIF, color: ink }}>{activeTemplate.title}</h2>
              <p className="text-[13px] mt-1.5" style={{ color: "#8A8378", fontFamily: FONT_SANS }}>
                Tap into any field below to fill it out, then hit Save to Drive when done — no download needed.
              </p>
            </div>
          )}

          <div className="flex-1 px-4 sm:px-8 pb-8">
            {loadStatus === "loading" && (
              <div className="text-[14px] py-6" style={{ color: "#8A8378", fontFamily: FONT_SANS }}>Loading this couple's copy…</div>
            )}
            {loadStatus === "error" && (
              <div className="text-[14px] py-6" style={{ color: brick, fontFamily: FONT_SANS }}>{errorMessage || "Couldn't load this couple's copy."}</div>
            )}
            {loadStatus === "idle" && !activeTemplateId && (
              <div className="text-[14px] py-6" style={{ color: "#8A8378", fontFamily: FONT_SANS }}>Choose a form on the left to get started.</div>
            )}
            {loadStatus === "ready" && pdfDoc && containerWidth > 0 && (
              <>
                <PdfPage pdfDoc={pdfDoc} pageNumber={pageNumber} containerWidth={containerWidth} />
                {numPages > 1 && (
                  <div className="flex items-center justify-center gap-4 mt-4">
                    <button
                      onClick={() => setPageNumber((p) => Math.max(1, p - 1))}
                      disabled={pageNumber <= 1}
                      className="p-2 rounded-lg hover:bg-black/5 disabled:opacity-30"
                    >
                      <ChevronLeft size={18} color={ink} />
                    </button>
                    <span className="text-[13px]" style={{ color: "#8A8378", fontFamily: FONT_SANS }}>Page {pageNumber} of {numPages}</span>
                    <button
                      onClick={() => setPageNumber((p) => Math.min(numPages, p + 1))}
                      disabled={pageNumber >= numPages}
                      className="p-2 rounded-lg hover:bg-black/5 disabled:opacity-30"
                    >
                      <ChevronRightIcon size={18} color={ink} />
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}