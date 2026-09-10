// Where the Express backend lives.
//
// Order of precedence:
//   1. VITE_API_URL, set at build time (GitHub Actions variable/secret,
//      or web/.env.local for local dev)
//   2. the deployed Render backend, so a plain `npm run build` with no
//      configuration still produces a working site
//
// For local development against a local server, create web/.env.local
// containing: VITE_API_URL=http://localhost:4000
export const API_URL =
  import.meta.env.VITE_API_URL || "https://marriage-prep-st-mary-catholic-church-d3d8.onrender.com";

/** Pulls the real `{ "error": "..." }` message out of a failed response
 *  instead of just reporting a bare status code, so specific, actionable
 *  backend errors (e.g. "Set a Couples folder in Settings first") reach
 *  the person instead of being replaced with something generic. */
async function readErrorMessage(res) {
  const text = await res.text().catch(() => "");
  try {
    const parsed = JSON.parse(text);
    if (parsed?.error) return parsed.error;
  } catch (_) {
    // not JSON — fall through to raw text below
  }
  return text || `${res.status} ${res.statusText}`;
}
 
async function apiFetch(path, opts = {}) {
  const isFormData = opts.body instanceof FormData;
  let res;
  try {
    res = await fetch(`${API_URL}${path}`, {
      credentials: "include",
      ...opts,
      headers: {
        ...(isFormData ? {} : { "Content-Type": "application/json" }),
        ...(opts.headers || {}),
      },
    });
  } catch (e) {
    // The request never reached the server at all (offline, DNS, or the
    // Render instance still spinning up). Status 0 distinguishes this
    // from a real answer like 401, which callers need to tell apart —
    // see isServerWaking below.
    const err = new Error("Could not reach the server.");
    err.status = 0;
    throw err;
  }
  if (!res.ok) {
    const err = new Error(await readErrorMessage(res));
    err.status = res.status;
    throw err;
  }
  const contentType = res.headers.get("content-type") || "";
  return contentType.includes("application/json") ? res.json() : res;
}
 
/** True when a failure looks like "the backend isn't up yet" rather than
 *  a real answer from it. Render free/starter instances sleep when idle
 *  and take a while to boot, during which requests either never connect
 *  (status 0) or come back from the proxy as 502/503/504. A 401 is a
 *  genuine reply and must NOT be retried — that's just "not signed in". */
export function isServerWaking(err) {
  return err?.status === 0 || err?.status === 502 || err?.status === 503 || err?.status === 504;
}

export const api = {
  loginUrl: () => `${API_URL}/api/auth/google`,
  me: () => apiFetch("/api/auth/me"),
  logout: () => apiFetch("/api/auth/logout", { method: "POST" }),
 
  templates: {
    list: () => apiFetch("/api/templates"),
    upload: (title, file) => {
      const fd = new FormData();
      fd.append("title", title);
      fd.append("file", file);
      return apiFetch("/api/templates", { method: "POST", body: fd });
    },
    // `rename` is kept as a thin wrapper so existing callers don't change;
    // `update` is the general form and is what carries the per-template
    // booklet print setting.
    update: (id, payload) => apiFetch(`/api/templates/${id}`, { method: "PUT", body: JSON.stringify(payload) }),
    rename: (id, title) => apiFetch(`/api/templates/${id}`, { method: "PUT", body: JSON.stringify({ title }) }),
    remove: (id) => apiFetch(`/api/templates/${id}`, { method: "DELETE" }),
    fetchBytes: async (id) => {
      const res = await fetch(`${API_URL}/api/templates/${id}/file`, { credentials: "include" });
      if (!res.ok) throw new Error(await readErrorMessage(res));
      return res.arrayBuffer();
    },
  },
 
  priests: {
    list: () => apiFetch("/api/priests"),
    create: (payload) => apiFetch("/api/priests", { method: "POST", body: JSON.stringify(payload) }),
    update: (id, payload) => apiFetch(`/api/priests/${id}`, { method: "PUT", body: JSON.stringify(payload) }),
    remove: (id) => apiFetch(`/api/priests/${id}`, { method: "DELETE" }),
  },
 
  settings: {
    get: () => apiFetch("/api/settings"),
    update: (payload) => apiFetch("/api/settings", { method: "PUT", body: JSON.stringify(payload) }),
  },
 
  couples: {
    list: () => apiFetch("/api/couples"),
    get: (idOrSlug) => apiFetch(`/api/couples/${idOrSlug}`),
    create: (payload) => apiFetch("/api/couples", { method: "POST", body: JSON.stringify(payload) }),
    update: (id, payload) => apiFetch(`/api/couples/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),
    remove: (id) => apiFetch(`/api/couples/${id}`, { method: "DELETE" }),
    import: (payload) => apiFetch("/api/couples/import", { method: "POST", body: JSON.stringify(payload) }),
 
    documents: {
      upload: (coupleId, name, file) => {
        const fd = new FormData();
        fd.append("name", name);
        fd.append("file", file);
        return apiFetch(`/api/couples/${coupleId}/documents`, { method: "POST", body: fd });
      },
      remove: (coupleId, docId) => apiFetch(`/api/couples/${coupleId}/documents/${docId}`, { method: "DELETE" }),
    },
 
    // Creates a real Google Calendar event: the couple is the guest, and
    // the description links back to their profile card.
    createEvent: (coupleId, payload) =>
      apiFetch(`/api/couples/${coupleId}/events`, { method: "POST", body: JSON.stringify(payload) }),
 
    // Each couple gets their OWN Drive copy of any template PDF they're
    // assigned — created transparently the first time it's fetched — so
    // filling it in never touches the shared master file from Settings.
    templateFile: {
      fetchBytes: async (coupleId, templateId) => {
        const res = await fetch(`${API_URL}/api/couples/${coupleId}/templates/${templateId}/file`, { credentials: "include" });
        if (!res.ok) throw new Error(await readErrorMessage(res));
        return res.arrayBuffer();
      },
      save: async (coupleId, templateId, bytes) => {
        const res = await fetch(`${API_URL}/api/couples/${coupleId}/templates/${templateId}/file`, {
          method: "PUT",
          credentials: "include",
          headers: { "Content-Type": "application/pdf" },
          body: bytes,
        });
        if (!res.ok) throw new Error(await readErrorMessage(res));
        return res.json();
      },
    },
 
    // Files pulled in directly from a couple's own pre-existing Drive
    // folder at import time — not tied to any shared Settings template.
    customFormFile: {
      fetchBytes: async (coupleId, formId) => {
        const res = await fetch(`${API_URL}/api/couples/${coupleId}/customForms/${formId}/file`, { credentials: "include" });
        if (!res.ok) throw new Error(await readErrorMessage(res));
        return res.arrayBuffer();
      },
      save: async (coupleId, formId, bytes) => {
        const res = await fetch(`${API_URL}/api/couples/${coupleId}/customForms/${formId}/file`, {
          method: "PUT",
          credentials: "include",
          headers: { "Content-Type": "application/pdf" },
          body: bytes,
        });
        if (!res.ok) throw new Error(await readErrorMessage(res));
        return res.json();
      },
    },
  },
};