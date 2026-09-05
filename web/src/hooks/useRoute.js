import { useState, useEffect, useCallback } from "react";

// The app has three routes, so a ~40-line router beats pulling in
// react-router. BASE_URL is Vite's build-time base ("/" locally,
// "/<repo-name>/" on GitHub Pages) — we strip it so route matching is
// the same in both places.
const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

function currentPath() {
  const p = window.location.pathname;
  return (BASE && p.startsWith(BASE) ? p.slice(BASE.length) : p) || "/";
}

export function navigate(path) {
  window.history.pushState({}, "", `${BASE}${path}`);
  window.dispatchEvent(new PopStateEvent("popstate"));
}

export function useRoute() {
  const [path, setPath] = useState(currentPath);

  useEffect(() => {
    const onPop = () => setPath(currentPath());
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const go = useCallback((to) => navigate(to), []);

  // /couples/alvarez-nguyen        -> profile
  // /couples/alvarez-nguyen/forms  -> PDF filling for that couple
  // /settings                      -> settings
  // anything else                  -> directory
  const coupleMatch = path.match(/^\/couples\/([^/]+)(\/forms)?\/?$/);
  const route = coupleMatch
    ? { name: coupleMatch[2] ? "forms" : "profile", slug: coupleMatch[1] }
    : path.replace(/\/$/, "") === "/settings"
    ? { name: "settings" }
    : { name: "directory" };

  return { route, go, path };
}
