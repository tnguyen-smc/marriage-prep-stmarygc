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

async function apiFetch(path, opts = {}) {
  const isFormData = opts.body instanceof FormData;
  const res = await fetch(`${API_URL}${path}`, {
    credentials: "include",
    ...opts,
    headers: {
      ...(isFormData ? {} : { "Content-Type": "application/json" }),
      ...(opts.headers || {}),
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`${res.status} ${text || res.statusText}`);
  }
  const contentType = res.headers.get("content-type") || "";
  return contentType.includes("application/json") ? res.json() : res;
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
    remove: (id) => apiFetch(`/api/templates/${id}`, { method: "DELETE" }),
    fetchBytes: async (id) => {
      const res = await fetch(`${API_URL}/api/templates/${id}/file`, { credentials: "include" });
      if (!res.ok) throw new Error(`Could not load template ${id} (${res.status})`);
      return res.arrayBuffer();
    },
  },

  priests: {
    list: () => apiFetch("/api/priests"),
    create: (payload) => apiFetch("/api/priests", { method: "POST", body: JSON.stringify(payload) }),
    update: (id, payload) => apiFetch(`/api/priests/${id}`, { method: "PUT", body: JSON.stringify(payload) }),
    remove: (id) => apiFetch(`/api/priests/${id}`, { method: "DELETE" }),
  },

  couples: {
    list: () => apiFetch("/api/couples"),
    get: (idOrSlug) => apiFetch(`/api/couples/${idOrSlug}`),
    create: (payload) => apiFetch("/api/couples", { method: "POST", body: JSON.stringify(payload) }),
    update: (id, payload) => apiFetch(`/api/couples/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),

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
        if (!res.ok) throw new Error(`Could not load this couple's copy (${res.status})`);
        return res.arrayBuffer();
      },
      save: async (coupleId, templateId, bytes) => {
        const res = await fetch(`${API_URL}/api/couples/${coupleId}/templates/${templateId}/file`, {
          method: "PUT",
          credentials: "include",
          headers: { "Content-Type": "application/pdf" },
          body: bytes,
        });
        if (!res.ok) throw new Error(`Could not save this couple's copy (${res.status})`);
        return res.json();
      },
    },
  },
};