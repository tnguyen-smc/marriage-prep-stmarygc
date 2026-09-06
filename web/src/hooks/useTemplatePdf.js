import { useState, useEffect, useRef } from "react";
import { api } from "../api.js";
import { introspectFields, fillPdfFields } from "../lib/pdfForm.js";

/**
 * Given a couple id + templateId, loads THAT COUPLE'S OWN Drive copy of
 * the template (the backend creates it transparently on first use, from
 * the template's master file — see server/src/routes/couples.js), reports
 * back the fields it contains, keeps a live-filled preview in sync with
 * `values`, and — after the same debounce — saves the filled bytes back
 * into that couple's copy in Drive. The master template file is never
 * touched by any of this.
 */
export function useTemplatePdf(coupleId, templateId, values) {
  const [fields, setFields] = useState([]);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [status, setStatus] = useState("idle"); // idle | loading | ready | error
  const [errorMessage, setErrorMessage] = useState(null);
  const [saveStatus, setSaveStatus] = useState("idle"); // idle | saving | saved | error
  const originalBytesRef = useRef(null);
  const urlRef = useRef(null);
  const debounceRef = useRef(null);

  useEffect(() => {
    setFields([]);
    setPreviewUrl(null);
    setErrorMessage(null);
    if (!templateId) { setStatus("idle"); return; }
    let cancelled = false;
    setStatus("loading");
    (async () => {
      try {
        const buf = await api.couples.templateFile.fetchBytes(coupleId, templateId);
        if (cancelled) return;
        originalBytesRef.current = buf;
        const f = await introspectFields(buf);
        if (cancelled) return;
        setFields(f);
        setStatus("ready");
      } catch (e) {
        if (!cancelled) {
          setErrorMessage(e.message);
          setStatus("error");
        }
      }
    })();
    return () => { cancelled = true; };
  }, [coupleId, templateId]);

  useEffect(() => {
    if (status !== "ready" || !originalBytesRef.current) return;
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      try {
        const bytes = await fillPdfFields(originalBytesRef.current, values);

        const blob = new Blob([bytes], { type: "application/pdf" });
        const url = URL.createObjectURL(blob);
        if (urlRef.current) URL.revokeObjectURL(urlRef.current);
        urlRef.current = url;
        setPreviewUrl(url);

        setSaveStatus("saving");
        await api.couples.templateFile.save(coupleId, templateId, bytes);
        setSaveStatus("saved");
      } catch (_) {
        setSaveStatus("error");
        // Leave the last good preview showing rather than blanking it.
      }
    }, 350);
    return () => clearTimeout(debounceRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [values, status]);

  useEffect(() => () => { if (urlRef.current) URL.revokeObjectURL(urlRef.current); }, []);

  return { fields, previewUrl, status, errorMessage, saveStatus };
}