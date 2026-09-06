import { sage, bronze } from "../theme.js";

export const STATUS_STYLES = {
  "In Progress": { dot: bronze, text: bronze },
  Completed: { dot: sage, text: sage },
};

export function formatDate(iso) {
  if (!iso) return "—";
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

export function daysUntil(iso) {
  if (!iso) return null;
  const d = new Date(iso + "T00:00:00");
  return Math.ceil((d - new Date()) / (1000 * 60 * 60 * 24));
}

/** Splits "Michael Alvarez" into { first: "Michael", last: "Alvarez" }. */
export function splitName(fullName = "") {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { first: "", last: "" };
  const last = parts.length > 1 ? parts[parts.length - 1] : "";
  const first = parts.length > 1 ? parts.slice(0, -1).join(" ") : parts[0];
  return { first, last };
}

export const SORT_OPTIONS = [
  { key: "groomFirst", label: "Groom first name" },
  { key: "groomLast", label: "Groom last name" },
  { key: "brideFirst", label: "Bride first name" },
  { key: "brideLast", label: "Bride last name" },
  { key: "prepStart", label: "Date started prep" },
  { key: "weddingClosest", label: "Wedding date (closest)" },
];

export function sortCouples(couples, sortKey) {
  const withNames = couples.map((c) => ({ ...c, _groom: splitName(c.groom), _bride: splitName(c.bride) }));
  const byString = (getter) => (a, b) => getter(a).localeCompare(getter(b));
  switch (sortKey) {
    case "groomFirst": return withNames.sort(byString((c) => c._groom.first));
    case "groomLast": return withNames.sort(byString((c) => c._groom.last));
    case "brideFirst": return withNames.sort(byString((c) => c._bride.first));
    case "brideLast": return withNames.sort(byString((c) => c._bride.last));
    case "prepStart": return withNames.sort((a, b) => new Date(a.prepStartDate) - new Date(b.prepStartDate));
    case "weddingClosest":
    default: {
      const today = new Date();
      return withNames.sort((a, b) => {
        const da = a.weddingDate ? Math.abs(new Date(a.weddingDate) - today) : Infinity;
        const db = b.weddingDate ? Math.abs(new Date(b.weddingDate) - today) : Infinity;
        return da - db;
      });
    }
  }
}