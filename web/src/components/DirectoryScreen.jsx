import React, { useState, useMemo } from "react";
import { Search, Plus } from "lucide-react";
import { ink, bronze, FONT_SERIF, FONT_SANS } from "../theme.js";
import { SORT_OPTIONS, sortCouples } from "../data/helpers.js";
import TopBar from "./TopBar.jsx";
import CoupleCard from "./CoupleCard.jsx";
import IntakeModal from "./IntakeModal.jsx";

const TABS = ["In Progress", "Completed", "Archived", "All"];

export default function DirectoryScreen({ couples, templates, priests, profile, onOpenCouple, onLogout, onSettings, onCreateCouple }) {
  const [filter, setFilter] = useState("All");
  const [query, setQuery] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [sortKey, setSortKey] = useState("weddingClosest");

  const filtered = useMemo(() => {
    const matched = couples.filter((c) => {
      const matchesQuery = query === "" || `${c.groom} ${c.bride}`.toLowerCase().includes(query.toLowerCase());
      if (!matchesQuery) return false;
      if (filter === "Archived") return c.archived;
      if (c.archived) return false;
      return filter === "All" || c.status === filter;
    });
    return sortCouples(matched, sortKey);
  }, [couples, filter, query, sortKey]);

  return (
    <div className="min-h-screen" style={{ background: "#FAF7F0" }}>
      <TopBar onSettings={onSettings} showSettings={profile?.role === "admin"} onLogout={onLogout} />

      <div className="px-5 sm:px-8 pt-7 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 className="text-[26px] sm:text-[28px]" style={{ fontFamily: FONT_SERIF, color: ink }}>Marriage Preparation</h1>
        <button onClick={() => setModalOpen(true)} className="flex items-center justify-center gap-2 px-5 py-3.5 rounded-lg text-white text-[15px] flex-shrink-0" style={{ background: bronze, fontFamily: FONT_SANS }}>
          <Plus size={18} strokeWidth={2} />
          New couple intake
        </button>
      </div>

      <div className="px-5 sm:px-8 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 border-b pb-2 sm:pb-0" style={{ borderColor: "#E4DDD0" }}>
        <div className="flex gap-1 overflow-x-auto">
          {TABS.map((t) => (
            <button key={t} onClick={() => setFilter(t)} className="px-4 py-3 text-[14px] relative whitespace-nowrap" style={{ fontFamily: FONT_SANS, color: filter === t ? ink : "#8A8378" }}>
              {t}
              {filter === t && <span className="absolute left-4 right-4 -bottom-[1px] h-[2px]" style={{ background: bronze }} />}
            </button>
          ))}
        </div>
        <div className="flex-1 flex flex-col sm:flex-row sm:justify-end gap-3 py-2">
          <select value={sortKey} onChange={(e) => setSortKey(e.target.value)} className="px-3.5 py-2 rounded-lg text-[14px] w-full sm:w-[220px]" style={{ background: "#FFFFFF", border: "1px solid #E4DDD0", fontFamily: FONT_SANS, color: ink }}>
            {SORT_OPTIONS.map((o) => <option key={o.key} value={o.key}>Sort: {o.label}</option>)}
          </select>
          <div className="flex items-center gap-2 px-3.5 py-2 rounded-lg w-full sm:w-[260px]" style={{ background: "#FFFFFF", border: "1px solid #E4DDD0" }}>
            <Search size={15} color="#8A8378" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search couples" className="w-full bg-transparent outline-none text-[14px]" style={{ fontFamily: FONT_SANS, color: ink }} />
          </div>
        </div>
      </div>

      <div className="px-5 sm:px-8 py-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
        {filtered.map((c) => <CoupleCard key={c.id} couple={c} onOpen={onOpenCouple} />)}
        {filtered.length === 0 && (
          <div className="col-span-full text-center py-16" style={{ color: "#8A8378", fontFamily: FONT_SANS }}>No couples match this filter yet.</div>
        )}
      </div>

      <IntakeModal open={modalOpen} onClose={() => setModalOpen(false)} onCreate={onCreateCouple} templates={templates} priests={priests} profile={profile} />
    </div>
  );
}
