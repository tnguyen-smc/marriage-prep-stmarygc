import React, { useState } from "react";
import { X, Mail, Link2, Check, ExternalLink } from "lucide-react";
import { ink, parchment, bronze, sage, brick, FONT_SERIF, FONT_SANS, inputStyle } from "../theme.js";
import { Field } from "./Shared.jsx";
import { api } from "../api.js";

const DURATIONS = [30, 45, 60, 90];

export default function CalendarModal({ couple, profileUrl, onClose, onCreated }) {
  const [start, setStart] = useState("");
  const [duration, setDuration] = useState(60);
  const [summary, setSummary] = useState(`Marriage prep — ${couple.groom} & ${couple.bride}`);
  const [state, setState] = useState("idle"); // idle | creating | done | error
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  const handleCreate = async () => {
    if (!start) return;
    setState("creating");
    setError(null);
    try {
      const startDate = new Date(start);
      const endDate = new Date(startDate.getTime() + duration * 60000);
      const event = await api.couples.createEvent(couple.id, {
        summary,
        start: startDate.toISOString(),
        end: endDate.toISOString(),
        timeZone,
      });
      setResult(event);
      setState("done");
      onCreated?.();
    } catch (e) {
      setError(e.message);
      setState("error");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(43,58,66,0.45)" }}>
      <div className="w-full max-w-[500px] rounded-xl p-6 sm:p-7" style={{ background: parchment }}>
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-[19px]" style={{ fontFamily: FONT_SERIF, color: ink }}>Schedule next session</h3>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-black/5"><X size={18} color={ink} /></button>
        </div>

        {state === "done" ? (
          <div>
            <div className="flex items-center gap-2 mb-4 text-[14px]" style={{ color: sage, fontFamily: FONT_SANS }}>
              <Check size={16} />
              Event created and invitation sent to {couple.email || "the couple"}.
            </div>
            {result?.htmlLink && (
              <a href={result.htmlLink} target="_blank" rel="noopener" className="flex items-center gap-2 text-[13px] mb-6" style={{ color: bronze, fontFamily: FONT_SANS }}>
                <ExternalLink size={14} />
                Open in Google Calendar
              </a>
            )}
            <div className="flex justify-end">
              <button onClick={onClose} className="px-5 py-3 rounded-lg text-[15px] text-white" style={{ fontFamily: FONT_SANS, background: ink }}>Done</button>
            </div>
          </div>
        ) : (
          <>
            <div className="rounded-lg p-4 mb-4 space-y-2.5" style={{ background: "#FFFFFF", border: "1px solid #E4DDD0" }}>
              <div>
                <div className="flex items-center gap-2 text-[12px] mb-1" style={{ color: "#8A8378", fontFamily: FONT_SANS }}>
                  <Mail size={12} /> Guests
                </div>
                <div className="text-[14px]" style={{ fontFamily: FONT_SANS, color: couple.email ? ink : brick }}>
                  {couple.email || "No email on file — add one on the profile first"}
                </div>
              </div>
              <div>
                <div className="flex items-center gap-2 text-[12px] mb-1" style={{ color: "#8A8378", fontFamily: FONT_SANS }}>
                  <Link2 size={12} /> Description
                </div>
                <div className="text-[12px] break-all" style={{ fontFamily: FONT_SANS, color: "#6E675C" }}>
                  {profileUrl}
                </div>
              </div>
            </div>

            <div className="mb-4">
              <Field label="Title"><input value={summary} onChange={(e) => setSummary(e.target.value)} style={inputStyle} /></Field>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-2">
              <Field label="Date & time">
                <input type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} style={inputStyle} />
              </Field>
              <Field label="Duration">
                <select value={duration} onChange={(e) => setDuration(Number(e.target.value))} style={inputStyle}>
                  {DURATIONS.map((d) => <option key={d} value={d}>{d} minutes</option>)}
                </select>
              </Field>
            </div>
            <div className="text-[11px] mb-5" style={{ color: "#B7AF9F", fontFamily: FONT_SANS }}>Time zone: {timeZone}</div>

            {error && <div className="text-[13px] mb-4" style={{ color: brick, fontFamily: FONT_SANS }}>{error}</div>}

            <div className="flex justify-end gap-3">
              <button onClick={onClose} className="px-5 py-3 rounded-lg text-[15px]" style={{ fontFamily: FONT_SANS, color: ink, border: "1px solid #E4DDD0" }}>Cancel</button>
              <button
                onClick={handleCreate}
                disabled={!start || state === "creating"}
                className="px-5 py-3 rounded-lg text-[15px] text-white"
                style={{ fontFamily: FONT_SANS, background: start ? bronze : "#B7AF9F", cursor: start ? "pointer" : "not-allowed" }}
              >
                {state === "creating" ? "Creating…" : "Create Google Calendar event"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
