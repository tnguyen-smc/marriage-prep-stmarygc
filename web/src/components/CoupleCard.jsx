import React from "react";
import { Calendar } from "lucide-react";
import { ink, sage, bronze, FONT_SERIF, FONT_SANS } from "../theme.js";
import { formatDate, daysUntil, splitName } from "../data/helpers.js";
import { StatusPill } from "./Shared.jsx";

export default function CoupleCard({ couple, onOpen }) {
  const dLeft = daysUntil(couple.weddingDate);
  const groom = splitName(couple.groom);
  const bride = splitName(couple.bride);
  const templateCount = couple.templateIds?.length || 0;

  return (
    <button
      onClick={() => onOpen(couple)}
      className="text-left w-full rounded-lg p-5 border transition-colors hover:border-[#A8763E] active:scale-[0.99]"
      style={{ borderColor: "#E4DDD0", background: "#FFFFFF" }}
    >
      <div className="flex items-start justify-between mb-3 gap-3">
        <div className="min-w-0 text-[18px] leading-snug" style={{ fontFamily: FONT_SERIF, color: ink }}>
          <span className="block truncate">{groom.first} {groom.last}</span>
          <span className="block truncate" style={{ color: "#8A8378", fontSize: "13px", fontFamily: FONT_SANS, marginTop: "1px" }}>&amp;</span>
          <span className="block truncate">{bride.first} {bride.last}</span>
        </div>
        <StatusPill status={couple.status} />
      </div>

      <div className="flex items-center gap-2 text-[13px] mb-3 flex-wrap" style={{ color: ink, fontFamily: FONT_SANS }}>
        <Calendar size={14} strokeWidth={1.75} style={{ color: bronze }} />
        {formatDate(couple.weddingDate)}
        {dLeft !== null && (
          <>
            <span style={{ color: "#B7AF9F" }}>·</span>
            <span style={{ color: dLeft < 30 ? "#8B3A3A" : "#8A8378" }}>{dLeft > 0 ? `${dLeft} days out` : "date passed"}</span>
          </>
        )}
      </div>

      <div className="text-[12px] space-y-0.5" style={{ color: "#8A8378", fontFamily: FONT_SANS }}>
        {couple.priest && <div><span style={{ fontWeight: 600, color: "#6E675C" }}>Priest:</span> {couple.priest}</div>}
        <div>Started prep: {formatDate(couple.prepStartDate)}</div>
        <div>Last appointment: {formatDate(couple.lastAppointment)}</div>
        <div>{templateCount} form{templateCount === 1 ? "" : "s"} assigned</div>
        {couple.archived && (
          <div className="mt-1.5 pt-1.5 border-t" style={{ borderColor: "#E4DDD0", color: "#8B3A3A" }}>
            Archived: {couple.archivedReason || "No reason given"}
          </div>
        )}
      </div>
    </button>
  );
}