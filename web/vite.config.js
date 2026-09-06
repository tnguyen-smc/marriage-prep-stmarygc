import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Deployed at https://tnguyen-smc.github.io/marriage-prep-stmarygc/
// so the app lives under the /marriage-prep-stmarygc/ subpath and Vite
// must prefix every built asset URL with it.
//
// If you ever move to a custom domain at the root, flip
// USE_CUSTOM_DOMAIN to true (and add web/public/CNAME) — see README.md,
// "Deploying the frontend to GitHub Pages".
const REPO_NAME = "marriage-prep-stmarygc";
const USE_CUSTOM_DOMAIN = false;

export default defineConfig({
  plugins: [react()],
  base: USE_CUSTOM_DOMAIN ? "/" : `/${REPO_NAME}/`,
});
