import React from "react";
import { LogOut, Settings } from "lucide-react";
import { ink, parchment, FONT_SERIF, FONT_SANS } from "../theme.js";

export default function TopBar({ onLogoTap, onSettings, showSettings, onLogout }) {
  return (
    <div className="flex items-center justify-between px-5 sm:px-8 py-4 border-b" style={{ borderColor: "#E4DDD0", background: parchment }}>
      <button onClick={onLogoTap} className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm flex-shrink-0" style={{ background: ink, color: parchment, fontFamily: FONT_SERIF }}>SB</div>
        <div className="text-left">
          <div className="text-[15px] leading-tight" style={{ fontFamily: FONT_SERIF, color: ink }}>St. Mary Catholic Church</div>
          <div className="text-[11px] tracking-wide" style={{ color: "#8A8378", fontFamily: FONT_SANS }}>Marriage Preparation</div>
        </div>
      </button>
      <div className="flex items-center gap-1">
        {showSettings && (
          <button onClick={onSettings} className="flex items-center gap-2 px-3.5 py-2 rounded-lg hover:bg-black/5" style={{ color: "#6E675C", fontFamily: FONT_SANS }}>
            <Settings size={16} strokeWidth={1.75} />
            <span className="text-[14px] hidden sm:inline">Settings</span>
          </button>
        )}
        <button onClick={onLogout} className="flex items-center gap-2 px-3.5 py-2 rounded-lg hover:bg-black/5" style={{ color: "#6E675C", fontFamily: FONT_SANS }}>
          <LogOut size={16} strokeWidth={1.75} />
          <span className="text-[14px]">Log Out</span>
        </button>
      </div>
    </div>
  );
}
