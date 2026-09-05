# Marriage Preparation — full prototype (React + Node + Google)

A priest-facing app for Catholic marriage prep counseling sessions. Priests
sign in with their real Google account. In **Settings**, they upload any
fillable PDF (diocesan form, canonical form, whatever) and give it a title.
At intake, they check off which of those forms a couple needs. In the
form-filling screen, the app reads that PDF's *real* fields — whatever they
are — and builds an editor for them on the spot, with a live "Preview PDF"
that fills the actual file using `pdf-lib`, without flattening it, so it
stays editable in Adobe/Drive afterward.

Couples and templates are stored in a real Google Sheet. Uploaded PDFs live
in a real Google Drive folder. Login is real Google OAuth.

---

## 1. Why this needed a backend

GitHub Pages only serves static files — it can't hold your Google OAuth
client secret or safely talk to the Sheets/Drive APIs on your behalf. So
this is now two pieces:

- **`web/`** — the React/Vite frontend. Deploys to GitHub Pages (or
  anywhere static).
- **`server/`** — a small Express backend. Handles Google login, and is
  the only thing that talks to Sheets/Drive. **This needs a real Node
  host** — GitHub Pages cannot run it. See section 6.

---

## 2. Project structure

```
.
├── .github/workflows/deploy.yml   # builds & deploys web/ to GitHub Pages
├── web/                            # React frontend
│   ├── vite.config.js              # READ before deploying (base path)
│   ├── .env.example                # VITE_API_URL — where the backend lives
│   └── src/
│       ├── App.jsx                 # screen routing + data loading
│       ├── api.js                  # the ONLY file that knows backend URLs
│       ├── theme.js                # colors/fonts — edit here to re-skin
│       ├── data/helpers.js         # dates, name-splitting, sorting
│       ├── lib/pdfForm.js          # generic PDF field read/fill (pdf-lib)
│       ├── hooks/
│       │   ├── useTemplatePdf.js   # loads a couple's PDF copy + live preview
│       │   └── useRoute.js         # ~40-line router (no react-router dep)
│       └── components/
│           ├── LoginScreen.jsx
│           ├── DirectoryScreen.jsx
│           ├── CoupleCard.jsx
│           ├── CoupleProfileScreen.jsx   # /couples/<slug> — the profile card
│           ├── IntakeModal.jsx           # assigns uploaded templates
│           ├── SettingsScreen.jsx        # templates + priest roster
│           ├── FormFillingScreen.jsx     # /couples/<slug>/forms
│           ├── DynamicFieldForm.jsx      # renders whatever fields a PDF has
│           ├── PdfPreviewModal.jsx
│           ├── CalendarModal.jsx         # real Google Calendar event creator
│           ├── ArchiveCoupleModal.jsx
│           ├── TopBar.jsx
│           └── Shared.jsx                # Field, ToggleSwitch, StatusPill
└── server/                          # Express backend
    ├── .env.example                 # Google credentials + Sheet/Drive IDs
    └── src/
        ├── index.js                 # app entry
        ├── googleClient.js          # OAuth2 client + scopes
        ├── sheets.js                # the "database" — reads/writes the Sheet
        ├── drive.js                 # uploads/copies/downloads files
        ├── calendar.js              # creates Calendar events
        ├── middleware/
        │   ├── requireAuth.js
        │   └── requireAdmin.js
        └── routes/
            ├── auth.js              # /api/auth/google, /callback, /me, /logout
            ├── templates.js         # /api/templates (list/upload/delete/file)
            ├── priests.js           # the Pastor/Parochial Vicar roster
            └── couples.js           # couples, their own PDF copies,
                                     # documents, and calendar events
```

**Where to make common edits:**

| I want to... | Edit this file |
|---|---|
| Change colors/fonts | `web/src/theme.js` |
| Change filter tabs or sort options | `web/src/data/helpers.js`, `web/src/components/DirectoryScreen.jsx` |
| Change how a PDF field is labeled/rendered | `web/src/components/DynamicFieldForm.jsx` |
| Change what's stored per couple | `server/src/routes/couples.js` (`HEADER`) + matching Sheet columns |
| Add a new API endpoint | `server/src/routes/*.js` |

---

## 3. How data flows (so editing it later is easy)

- **Templates** = one row per uploaded PDF in the "Templates" sheet tab:
  `id, title, driveFileId, createdAt`. The actual PDF bytes live in Drive;
  the Sheet just points to them.
- **Couples** = one row per couple in the "Couples" sheet tab:
  `id, slug, groom, bride, email, phone, weddingDate, prepStartDate,
  lastAppointment, status, drivePath, templateIds, templateData, priest,
  archived, archivedReason, archivedAt, templateCopies, documents`.
  - `slug` is the URL-safe id used in each couple's own address —
    `groomlastname-bridelastname` (e.g. `alvarez-nguyen`). It's generated
    from their names, de-duplicated with a `-2`, `-3` suffix if two
    couples share both surnames, and regenerated if you rename them.
  - `priest` records who's *responsible* for the couple, not who may look:
    the Pastor, Parochial Vicar, and admin all see every couple.
  - `archived` is `"true"`/`"false"`. Archiving (with a required reason)
    hides them from the normal directory tabs but keeps the record under
    the "Archived" tab — nothing is deleted.
  - `templateIds` is a comma-separated list of assigned template ids.
  - `templateData` is **one JSON blob**: `{ "<templateId>": { "<pdf field
    name>": "value" } }` — what the priest has typed, used to repopulate
    the on-screen form instantly.
  - `templateCopies` is **another JSON blob**: `{ "<templateId>":
    "<driveFileId>" }` — the id of this couple's *own* Drive copy of that
    template, made on first open. Fills only ever write to that copy; the
    master uploaded in Settings is never touched.
  - `documents` is **a JSON array**: `[ { id, name, driveFileId,
    webViewLink, uploadedAt } ]` — supporting files the priest uploads to
    the couple (baptismal certificates, dispensations, scans).

- **No hardcoded field maps.** Older prototypes of this app hand-transcribed
  every field name out of one specific diocesan PDF. That doesn't scale to
  "upload any PDF," so `web/src/lib/pdfForm.js` now asks `pdf-lib` what
  fields a PDF actually has, at runtime, and builds the editor from that.
  This is both the feature you asked for and a real simplification — it
  deleted roughly 250 lines of hand-maintained mapping tables.

---

## 4. Google Cloud setup (do this once)

1. Go to [console.cloud.google.com](https://console.cloud.google.com) and
   create a new project (or use an existing one).
2. **APIs & Services → Library** — enable:
   - Google Drive API
   - Google Sheets API
   - Google Calendar API
3. **APIs & Services → OAuth consent screen**
   - User type: External (or Internal if you're on Google Workspace and
     only parish staff will use it).
   - Fill in app name, support email, developer email.
   - Scopes: add `.../auth/drive.file`, `.../auth/spreadsheets`, and
     `.../auth/calendar.events` (openid/email/profile are included by
     default).
   - Add the priest's Google account(s) as test users if the app is in
     "Testing" publishing status (fine for a prototype).
4. **APIs & Services → Credentials → Create Credentials → OAuth client ID**
   - Application type: Web application.
   - Authorized redirect URI: `http://localhost:4000/api/auth/google/callback`
     for local dev (add your real backend URL's callback here too once deployed).
   - Save the Client ID and Client Secret — you'll put these in `server/.env`.

---

## 5. Set up the Google Sheet and Drive folder

1. Create a new Google Sheet. Rename its two default/added tabs to exactly
   **`Templates`** and **`Couples`**, and add these header rows:

   **Templates** tab, row 1:
   ```
   id | title | driveFileId | createdAt
   ```

   **Couples** tab, row 1:
   ```
   id | slug | groom | bride | email | phone | weddingDate | prepStartDate | lastAppointment | status | drivePath | templateIds | templateData | priest | archived | archivedReason | archivedAt | templateCopies | documents
   ```

   **Priests** tab, row 1:
   ```
   role | name | email
   ```
   Leave the rows under it empty for now — the admin fills in the Pastor
   and Parochial Vicar's name/email from the app's Settings screen (see
   section 6 below), and the app creates the two rows automatically.
2. Copy the Sheet's ID out of its URL:
   `https://docs.google.com/spreadsheets/d/`**`THIS_PART`**`/edit` → this is
   `GOOGLE_SHEET_ID`.
3. Create a Google Drive folder for uploaded PDFs. Copy its ID out of the
   URL the same way → this is `GOOGLE_DRIVE_FOLDER_ID`.
4. Make sure the Google account you'll sign in with (the priest's account)
   has edit access to both the Sheet and the Drive folder — since the app
   acts as that signed-in user, not a separate service account. **This
   applies to every priest, not just the admin** — even before a priest's
   name is filled in under Settings, they need at least Viewer access to
   the Sheet, because the login flow checks the "Priests" tab to figure
   out who's allowed in.
5. In `server/.env`, set `ADMIN_EMAIL` to the one Google account that
   should have full access (every couple, Settings, uploading/deleting
   templates, and editing the Priests roster). Everyone else can only
   sign in once the admin has added their email under Settings → Priests.

---

## 6. Roles, and who can see what

- **Admin** (the one email in `ADMIN_EMAIL`): the only one who can reach
  Settings — uploading/deleting PDF templates and setting the Pastor's and
  Parochial Vicar's name + email. Can also reassign a couple's priest.
- **Pastor / Parochial Vicar**: signs in with the email the admin set for
  them in Settings. **Both priests see every couple** — the parish runs as
  one office and they cover for each other, so "Priest in charge" records
  who's responsible, not who's permitted to look. They don't get a
  Settings button.
- Anyone whose email isn't the admin's and isn't one of the two configured
  priest emails is bounced back to the login screen after Google's consent
  screen — nothing in Sheets or Drive is exposed to them.
- The "Priest in charge" field is a dropdown built from the Priests sheet
  tab, not free text, so it can't drift out of sync with who can log in.

---

## 7. Each couple's own page

Every couple gets a permanent, shareable URL built from their surnames:

```
https://<your-site>/couples/<groom-lastname>-<bride-lastname>
   e.g. https://<your-site>/couples/alvarez-nguyen
```

The slug is generated at intake, de-duplicated automatically if two
couples share both surnames (`alvarez-nguyen-2`), and regenerated if you
rename them. "Copy link" on the profile page grabs the URL.

Clicking a couple card opens their **profile card**, which holds:

- **Details** — names, email, phone, date they started prep, wedding date,
  last appointment. Every one of these is edit-in-place: tap the value,
  type, and it saves to the Sheet on blur.
- **Fillable forms** — the templates assigned to them. "Add form" picks
  from anything uploaded in Settings; "Fill out forms" opens the
  form-filling screen at `/couples/<slug>/forms`. Each row shows whether
  that form has been started, and links to the couple's own PDF copy.
- **Supporting documents** — upload baptismal or confirmation
  certificates, dispensations, prior-marriage paperwork, or scans. These
  go to the same Drive folder and are listed with a link to view and a
  button to remove.
- **Schedule next session**, **Mark Completed / In Progress**, and
  **Archive** (with a reason).

> **Deep links and GitHub Pages.** A static host has no server-side
> routing, so refreshing `/couples/alvarez-nguyen` would normally 404.
> The build script copies `index.html` to `404.html`, which is GitHub
> Pages' standard SPA fallback — the app boots and reads the path itself.
> Nothing extra to configure.

---

## 8. Scheduling sessions: the Google Calendar event creator

The "Schedule next session" button on a couple's profile creates a **real
event on the signed-in priest's primary Google Calendar** and emails the
couple an invitation.

### What gets created

| Part of the event | What it's filled with |
|---|---|
| **Title** | `Marriage prep — <Groom> & <Bride>`, editable before you create it |
| **Guests** | The couple's email address from their profile |
| **Description** | The URL of the couple's profile card, e.g. `Couple profile: https://<your-site>/couples/alvarez-nguyen` |
| **Start** | The date and time you pick |
| **End** | Start + the duration you pick (30 / 45 / 60 / 90 minutes) |
| **Time zone** | Detected from the priest's browser |
| **Calendar** | `primary` — the signed-in priest's own calendar |

Putting the profile URL in the description is the useful part: months
later, the priest can open the calendar entry on their phone and tap
straight through to that couple's paperwork.

### Setup required

1. **Enable the API.** Google Cloud Console → APIs & Services → Library →
   enable **Google Calendar API** (alongside Drive and Sheets from
   section 4).
2. **Add the scope.** The consent screen needs
   `https://www.googleapis.com/auth/calendar.events`. It's already in
   `SCOPES` in `server/src/googleClient.js`, but you must also add it in
   Google Cloud Console → OAuth consent screen → Scopes.
3. **Re-consent.** Anyone already signed in granted permissions *before*
   Calendar was added, so their stored token has no Calendar access and
   event creation will fail with a `403 insufficient scopes` error until
   they sign out and back in. Adding a scope never upgrades an existing
   token silently. If you hit that error, log out and log back in first.
4. **Set `CLIENT_URL` correctly** in `server/.env` — the description link
   is built from it, so if it's still `http://localhost:5173` in
   production, priests will get invitations pointing at their own laptop.

### How invitations are sent

The API call passes `sendUpdates: "all"`, which is what actually makes
Google email the guest. Without it, the couple is silently listed as an
attendee and never notified — a common and confusing failure, so don't
remove it from `server/src/calendar.js`.

### Notes and limits

- **A couple with no email on file** can't be invited. The modal shows the
  guest line in red and the event is created without a guest; add their
  email on the profile first.
- **The event lands on whichever priest is signed in**, not on the priest
  named in "Priest in charge". If Fr. A schedules on behalf of Fr. B, it
  appears on Fr. A's calendar with Fr. B nowhere on it.
- **Creating an event updates `lastAppointment`** on the couple's row, so
  the directory card stays accurate without extra bookkeeping.
- **Nothing syncs back.** If the priest later moves or cancels the event
  in Google Calendar, the app won't know. Two-way sync would mean storing
  the event id and either polling or registering a webhook — worth doing
  if rescheduling turns out to be common, but deliberately out of scope
  here.
- **Editing after the fact** is normal Google Calendar: the event is a
  real event, so it can be dragged, rescheduled, or cancelled there and
  the couple gets Google's own update emails.

---

## 9. Run it locally

**Backend:**
```bash
cd server
cp .env.example .env
# fill in .env with your real values from steps 4 & 5
npm install
npm run dev
```
It listens on `http://localhost:4000`.

**Frontend**, in a second terminal:
```bash
cd web
cp .env.example .env.local   # defaults to http://localhost:4000, fine for local dev
npm install
npm run dev
```
Open the URL it prints (usually `http://localhost:5173`). Click "Sign in
with Google" — this is a real OAuth flow now, so it'll actually ask you to
grant access.

---

## 10. Deploying the frontend to GitHub Pages, and pointing to it from Gantry

If you don't have DNS access for a custom domain, use the project-page URL
GitHub gives you for free (`https://<username>.github.io/<repo-name>/`)
and link/embed *that* from a Gantry article.

1. Push this repo to GitHub.
2. **Settings → Pages → Source: GitHub Actions.** The included
   `.github/workflows/deploy.yml` builds `web/` and publishes it whenever
   you push to `main`. Your site will be live at
   `https://<username>.github.io/<repo-name>/`.
3. In the repo's **Settings → Secrets and variables → Actions → Variables**,
   add a repository variable `VITE_API_URL` set to your deployed backend's
   URL (see section 11) — the workflow passes it into the build.
4. In `web/vite.config.js`, set `REPO_NAME` to match your actual GitHub
   repo name, and leave `USE_CUSTOM_DOMAIN = false` (this is the default —
   only flip it to `true` later if you get DNS access for a custom domain).

### Pointing to it from a Gantry article

**Don't embed it in an `<iframe>`.** Google actively blocks its own sign-in
screen from loading inside an iframe (an anti-clickjacking policy that
applies to every site using "Sign in with Google," not something specific
to this app) — so "Sign in with Google" would just fail silently inside an
embed. Instead, put a link/button in the article's HTML source that opens
the GitHub Pages URL directly:

```html
<a
  href="https://<username>.github.io/<repo-name>/"
  target="_blank"
  rel="noopener"
  style="display:inline-block;padding:14px 24px;background:#2B3A42;color:#FAF7F0;
         font-family:sans-serif;font-size:15px;text-decoration:none;border-radius:8px;"
>
  Open Marriage Preparation →
</a>
```

Opening in a new tab (`target="_blank"`) also sidesteps a second problem:
even without Google's iframe block, the backend's session cookie is set
for the backend's own domain, and browsers increasingly restrict
third-party cookies inside iframes — so an embedded copy could silently
log the priest out on every reload. A plain link doesn't have that
problem, since the app then runs as its own top-level page.

If you'd rather it not obviously "leave" your site, you can still keep it
feeling integrated with a small full-page redirect trick instead of an
iframe — a Gantry article whose HTML source is just:

```html
<script>window.location.replace("https://<username>.github.io/<repo-name>/");</script>
<noscript>
  <a href="https://<username>.github.io/<repo-name>/">Continue to Marriage Preparation</a>
</noscript>
```

That page immediately forwards the visitor on, so it reads as "part of the
site" via your nav/menu, but the app still loads as its own top-level page
once it gets there — Google sign-in and cookies work normally.

---

## 11. Deploying the backend

GitHub Pages **cannot** run `server/`. You need a real Node host. Any of
these work well for a prototype and have a free tier:

- **Render** (render.com) — easiest: "New Web Service," point it at this
  repo with root directory `server`, build command `npm install`, start
  command `npm start`, and add all the `server/.env.example` variables
  under its Environment tab.
- **Railway**, **Fly.io** — similar "point at a repo, add env vars" flow.

Whichever you use:
1. Set `GOOGLE_REDIRECT_URI` to `https://<your-backend-host>/api/auth/google/callback`
   and add that exact URL as an Authorized redirect URI in Google Cloud
   Console too (Credentials → your OAuth client → Authorized redirect URIs).
2. Set `CLIENT_URL` to your deployed frontend's URL (your Gantry domain, or
   the `github.io` URL).
3. Since your frontend and backend will be on **different domains**, set
   `COOKIE_SAMESITE=none` and `COOKIE_SECURE=true` in the backend's env —
   cross-site cookies require both, and require the backend to be served
   over HTTPS (all the hosts above give you HTTPS automatically).

---

## 12. What's real vs. still simulated

**Real:**
- Google OAuth login.
- Google Sheets as the couples/templates database (real reads/writes).
- Google Drive storage for uploaded PDF templates.
- **Each couple gets their own Drive copy of every template they're
  assigned** (made automatically the first time a priest opens that tab),
  so filling one couple's answers in can never overwrite the master file
  or bleed into another couple's copy.
- PDF field introspection and live-fill via `pdf-lib` — genuinely reads
  and writes whatever PDF you upload, not a mockup.
- Autosave of a couple's answers to the Sheet (debounced ~800ms) **and**
  to that couple's own Drive PDF copy (debounced ~350ms) whenever the
  priest stops typing.
- **Real Google Calendar events** for the next session — the couple is
  invited as a guest and the description links back to their profile card
  (see section 8).
- Per-couple URLs (`/couples/<groom>-<bride>`), an editable profile card,
  and supporting-document uploads to Drive.

**Still simulated / not built:**
- **Calendar changes don't sync back.** If a priest reschedules or cancels
  the event inside Google Calendar, the app won't notice (see section 8).
- **No reminder emails** beyond Google's own calendar notifications.
- **Documents aren't OCR'd or validated** — a baptismal certificate is
  just a file; nothing checks its date against canon 1065's six-month
  requirement.

---

## 13. Dependencies

**Frontend:** React 18, Vite 5, Tailwind 3, `lucide-react`, `pdf-lib`.

**Backend:** Express 4, `express-session`, `googleapis`, `multer`
(file upload handling), `uuid`, `cors`, `dotenv`.
