import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// See README.md, "Deploying the frontend to GitHub Pages", for what
// these two settings mean and when to flip them.
//
// You're using a project-page URL (https://<user>.github.io/<repo>/)
// embedded/linked from Gantry rather than a custom domain, so this
// defaults to USE_CUSTOM_DOMAIN = false. Set REPO_NAME to your actual
// GitHub repo name below.
const REPO_NAME = "marriage-prep-stmarygc"; // <-- change to your actual repo name
const USE_CUSTOM_DOMAIN = false;

export default defineConfig({
  plugins: [react()],
  base: USE_CUSTOM_DOMAIN ? "/" : `/${REPO_NAME}/`,
});
