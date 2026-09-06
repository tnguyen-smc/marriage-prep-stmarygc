import React from "react";
import { sage, FONT_SANS } from "../theme.js";
import { STATUS_STYLES } from "../data/helpers.js";

export function Field({ label, children }) {
  return (
    <label className="block">
      <div className="text-[12px] mb-1.5" style={{ color: "#8A8378", fontFamily: FONT_SANS }}>{label}</div>
      {children}
    </label>
  );
}

export function ToggleSwitch({ checked, onChange }) {
  return (
    <button
      type="button"
      onClick={onChange}
      aria-pressed={checked}
      className="w-12 h-7 rounded-full relative transition-colors flex-shrink-0"
      style={{ background: checked ? sage : "#E4DDD0" }}
    >
      <span
        className="absolute top-0.5 w-6 h-6 rounded-full bg-white transition-transform shadow-sm"
        style={{ transform: checked ? "translateX(22px)" : "translateX(2px)" }}
      />
    </button>
  );
}

export function StatusPill({ status }) {
  const s = STATUS_STYLES[status] || STATUS_STYLES["In Progress"];
  return (
    <span className="inline-flex items-center gap-1.5 text-[13px]" style={{ color: s.text, fontFamily: FONT_SANS }}>
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: s.dot }} />
      {status}
    </span>
  );
}

export function Spinner({ label }) {
  return (
    <div className="flex items-center justify-center py-16 text-[14px]" style={{ color: "#8A8378", fontFamily: FONT_SANS }}>
      {label || "Loading…"}
    </div>
  );
}
