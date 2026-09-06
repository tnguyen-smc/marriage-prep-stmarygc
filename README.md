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

## 0. Quickstart for this deployment

This copy is **pre-configured** for:

| | |
|---|---|
| Frontend (GitHub Pages) | `https://tnguyen-smc.github.io/marriage-prep-stmarygc/` |
| Backend (Render) | `https://marriage-prep-st-mary-catholic-church.onrender.com` |

Both URLs are already set in `web/vite.config.js`, `web/src/api.js`, and
`render.yaml`, so you can drop these files into the repo as-is — no path
editing required.

**What you still have to do once:**

1. **Push to GitHub**, then Settings → Pages → Source: **GitHub Actions**.
   The frontend deploys itself on every push to `main`. You do *not* need
   to set `VITE_API_URL` — the Render URL is already the built-in default.
2. **Deploy the backend on Render** (New + → Blueprint → this repo;
   `render.yaml` configures it). Render will prompt you for the five
   secrets it can't guess: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`,
   `GOOGLE_SHEET_ID`, `GOOGLE_DRIVE_FOLDER_ID`, `ADMIN_EMAIL`.
3. **In Google Cloud Console**, add this exact Authorized redirect URI to
   your OAuth client:
   ```
   https://marriage-prep-st-mary-catholic-church.onrender.com/api/auth/google/callback
   ```
   and add this Authorized JavaScript origin:
   ```
   https://tnguyen-smc.github.io
   ```
4. **Create the Google Sheet tabs** (`Couples`, `Templates`, `Priests`)
   with the header rows in section 5, and share the Sheet + Drive folder
   with every priest's account.

> **Heads-up on Render's free plan:** the service sleeps after ~15 minutes
> idle, so the first sign-in after a quiet spell can take 30–60 seconds
> while it wakes. It isn't broken — but if a priest reports "the login
> button did nothing," this is usually why. Render's paid Starter tier
> removes the sleep.

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
├── render.yaml                     # Render blueprint for the backend
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
  `id, slug, groom, groomEmail, groomPhone, bride, brideEmail, bridePhone,
  weddingDate, prepStartDate, lastAppointment, status, drivePath,
  templateIds, templateData, priest, archived, archivedReason,
  archivedAt, templateCopies, documents, coupleDriveFolderId`.
  - `slug` is the URL-safe id used in each couple's own address —
    `groomlastname-bridelastname` (e.g. `alvarez-nguyen`). It's generated
    from their names, de-duplicated with a `-2`, `-3` suffix if two
    couples share both surnames, and regenerated if you rename them.
  - `priest` records who's *responsible* for the couple, not who may look:
    the Pastor, Parochial Vicar, and admin all see every couple.
  - `archived` is `"true"`/`"false"`. Archiving (with a required reason)
    hides them from the normal directory tabs but keeps the record under
    the "Archived" tab — nothing is deleted. **Deleting** a couple (a
    small, deliberately understated control on their profile page, admin
    only) removes their Sheet row permanently, but leaves their Drive
    subfolder and every file in it untouched — Archive is the everyday
    tool; Delete is for genuine mistakes (e.g. a duplicate test entry).
  - `templateIds` is a comma-separated list of assigned template ids.
  - `templateData` is **one JSON blob**: `{ "<templateId>": { "<pdf field
    name>": "value" } }` — what the priest has typed, used to repopulate
    the on-screen form instantly.
  - `coupleDriveFolderId` is this couple's own Drive subfolder, created
    the first time they need one (see section 5, "Drive folder
    structure"). Every file below is stored inside it.
  - `templateCopies` is **a JSON blob**: `{ "<templateId>": "<driveFileId>"
    }` — the id of this couple's *own* Drive copy of that template, made
    on first open, living in their subfolder. Fills only ever write to
    that copy; the master uploaded in Settings is never touched.
  - `documents` is **a JSON array**: `[ { id, name, driveFileId,
    webViewLink, uploadedAt } ]` — supporting files the priest uploads to
    the couple (baptismal certificates, dispensations, scans), stored in
    that same subfolder.

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
   - Scopes: add `.../auth/drive` (full Drive access — see the note in
     `server/src/googleClient.js` about why `drive.file` doesn't work
     here), `.../auth/spreadsheets`, and `.../auth/calendar.events`
     (openid/email/profile are included by default).
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
   `title` can be renamed any time from Settings — it only changes what's
   shown at intake and in the templates list; the underlying Drive file
   is untouched, so every couple's existing copy is unaffected.

   **Couples** tab, row 1:
   ```
   id | slug | groom | groomEmail | groomPhone | bride | brideEmail | bridePhone | weddingDate | prepStartDate | lastAppointment | status | drivePath | templateIds | templateData | priest | archived | archivedReason | archivedAt | templateCopies | documents | coupleDriveFolderId
   ```

   **Priests** tab, row 1:
   ```
   id | title | name | email
   ```
   Leave the rows under it empty — the admin adds each priest from the
   app's Settings screen (see section 6 below), which creates rows here
   automatically. `title` is free text (e.g. "Pastor", "Parochial Vicar",
   or anything else) and can be renamed any time; you're not limited to
   two priests.

   **Config** tab, row 1:
   ```
   key | value
   ```
   Leave the rows under it empty too — this holds small admin-editable
   settings: `templatesFolderId` and `couplesFolderId` (see the Drive
   folder structure just below). The app creates/updates these rows
   automatically the first time the admin sets them in Settings.
2. Copy the Sheet's ID out of its URL:
   `https://docs.google.com/spreadsheets/d/`**`THIS_PART`**`/edit` → this is
   `GOOGLE_SHEET_ID`.
3. Create Google Drive folders for uploaded PDFs. Copy each one's ID out
   of its URL the same way → this is `GOOGLE_DRIVE_FOLDER_ID`.

   **This env var is now just a starting fallback, not the only way to
   set it.** The real, day-to-day configuration lives in **Settings →
   Drive folders** in the app itself, which splits storage into two
   separate folders:

   ```
   Web App/                              (your Shared Drive, however you've set it up)
   ├── Master Templates PDF/             <- point "Master templates folder" here
   │   ├── Prenuptial Form.pdf           (the master; priests never edit this one)
   │   └── Baptismal Certificate Form.pdf
   └── Couples/                          <- point "Couples folder" here
       ├── Alvarez_Nguyen/               <- created automatically, one per couple
       │   ├── Prenuptial Form.pdf       (Alvarez_Nguyen's own copy, filled in)
       │   └── Baptismal Certificate — Michael Alvarez.pdf  (an uploaded document)
       ├── Whitfield_Simmons/
       │   └── ...
       └── ...
   ```

   The couple's own subfolder is created immediately at intake (named
   `Groom_Bride`, under whichever folder **Couples folder** points to) —
   its id is remembered as `coupleDriveFolderId` in the Sheet. Every file
   that belongs to that couple from then on, template copies and
   documents alike, lands in that one subfolder. Nothing ever gets
   uploaded flat into a shared folder alongside every other couple's
   files.

   Changing either folder in Settings takes effect immediately, no
   redeploy required — paste the folder's full URL or just its id,
   including a folder inside a Shared Drive. `GOOGLE_DRIVE_FOLDER_ID` in
   `server/.env` (or Render's Environment tab) only matters as a fallback
   until the admin sets both folders in Settings for the first time;
   after that, the values stored in the Sheet's `Config` tab win.

   > **If uploads fail with `500 {"error":"File not found: <some id>."}`**
   > — there are two independent, unrelated causes. Check both:
   >
   > 1. **Scope.** Google's `drive.file` scope only lets an app see
   >    files/folders *it created itself*; it cannot see a folder you made
   >    by hand in Drive's own UI, even with the correct ID and full
   >    ownership. This app requests the broader `drive` scope specifically
   >    to avoid that trap (see `googleClient.js`) — if you're hitting this
   >    error, either the consent screen in Cloud Console is still only
   >    offering `drive.file`, or everyone signed in before the scope was
   >    widened and needs to **log out and back in** to pick up the new
   >    permission (Google never upgrades a stored token silently — same
   >    issue as adding the Calendar scope in section 8).
   > 2. **Shared Drives.** If your folder lives inside a *Shared Drive*
   >    ("Team Drive") rather than someone's personal My Drive, the scope
   >    fix above isn't enough by itself — every Drive API call also needs
   >    `supportsAllDrives: true`, or the API pretends Shared Drive items
   >    don't exist at all, regardless of scope. This is already set on
   >    every call in `server/src/drive.js` — if you're on an older copy
   >    of this file without it, that's the fix. Widening the scope alone,
   >    without this flag, reproduces exactly this error.
   >
   > **On avoiding full Drive access:** the narrower `drive.file` scope
   > only works if the app never needs to touch a file it didn't create —
   > which isn't possible here, since the whole point of
   > `GOOGLE_DRIVE_FOLDER_ID` is pointing at a folder that already existed
   > before the app did. Google's real narrow-scope path for that case is
   > the **Google Picker**: the admin explicitly opens the existing folder
   > once through a Picker dialog (rather than the app just being told its
   > ID), which grants `drive.file` access to that specific folder from
   > then on. That's a real feature to add, not a config toggle — it needs
   > its own Google API key and a small frontend flow — so it isn't built
   > here yet. Ask if you want it added.
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
  Settings — uploading/deleting PDF templates, and adding, renaming, or
  removing priests on the roster. Can also reassign a couple's priest.
- **Priests**: the roster in Settings isn't limited to two — "Add another
  priest" adds as many as the parish needs, each with their own editable
  **title** (Pastor, Parochial Vicar, Associate Pastor, or your own
  wording), name, and sign-in email. **Every priest on the roster sees
  every couple** — the parish runs as one office and priests cover for
  each other, so "Priest in charge" records who's responsible, not who's
  permitted to look. Priests don't get a Settings button.
- Anyone whose email isn't the admin's and isn't on the Priests roster is
  bounced back to the login screen after Google's consent screen —
  nothing in Sheets or Drive is exposed to them.
- The "Priest in charge" field is a dropdown built from the Priests sheet
  tab, not free text, so it can't drift out of sync with who can log in.

---

## 7. Each couple's own page

Every couple gets a permanent, shareable URL built from their surnames:

```
https://tnguyen-smc.github.io/marriage-prep-stmarygc/couples/<groom>-<bride>
   e.g. .../marriage-prep-stmarygc/couples/alvarez-nguyen
```

The slug is generated at intake, de-duplicated automatically if two
couples share both surnames (`alvarez-nguyen-2`), and regenerated if you
rename them. "Copy link" on the profile page grabs the URL.

Clicking a couple card opens their **profile card**, which holds:

- **Details** — names, each partner's own email and phone, date they
  started prep, wedding date, last appointment. Every one of these is
  edit-in-place: tap the value, type, and it saves to the Sheet on blur.
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
| **Guests** | The groom's and bride's email addresses from their profile |
| **Description** | The URL of the couple's profile card, e.g. `Couple profile: https://tnguyen-smc.github.io/marriage-prep-stmarygc/couples/alvarez-nguyen` |
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

- **If neither partner has an email on file**, the event is created with
  no guests and the modal shows the guest line in red; add at least one
  email on the profile first. If only one has an email, only that person
  is invited.
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
GitHub gives you for free (`https://tnguyen-smc.github.io/marriage-prep-stmarygc/`)
and link/embed *that* from a Gantry article.

1. Push this repo to GitHub.
2. **Settings → Pages → Source: GitHub Actions.** The included
   `.github/workflows/deploy.yml` builds `web/` and publishes it whenever
   you push to `main`. Your site will be live at
   `https://tnguyen-smc.github.io/marriage-prep-stmarygc/`.
3. In the repo's **Settings → Secrets and variables → Actions**, add
   `VITE_API_URL` set to your deployed backend's URL — as a *variable* or
   a *secret*, either works. This is the only value that belongs in
   GitHub; every `GOOGLE_*` value goes on your backend host instead. See
   section 11 for the full breakdown and an important warning about
   `GOOGLE_CLIENT_SECRET`.
4. `web/vite.config.js` is **already set** to `REPO_NAME =
   "marriage-prep-stmarygc"` with `USE_CUSTOM_DOMAIN = false`, matching
   your Pages URL. Only change it if the repo is renamed or you later get
   DNS access for a custom domain.

### Pointing to it from a Gantry article

**Don't embed it in an `<iframe>`.** Google actively blocks its own sign-in
screen from loading inside an iframe (an anti-clickjacking policy that
applies to every site using "Sign in with Google," not something specific
to this app) — so "Sign in with Google" would just fail silently inside an
embed. Instead, put a link/button in the article's HTML source that opens
the GitHub Pages URL directly:

```html
<a
  href="https://tnguyen-smc.github.io/marriage-prep-stmarygc/"
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
<script>window.location.replace("https://tnguyen-smc.github.io/marriage-prep-stmarygc/");</script>
<noscript>
  <a href="https://tnguyen-smc.github.io/marriage-prep-stmarygc/">Continue to Marriage Preparation</a>
</noscript>
```

That page immediately forwards the visitor on, so it reads as "part of the
site" via your nav/menu, but the app still loads as its own top-level page
once it gets there — Google sign-in and cookies work normally.

---

## 11. Configuring env without .env files (GitHub Secrets, hosting panels)

`.env` files are only for running things **on your own machine**. You never
commit them, and in production nothing reads them — each half of the app
gets its configuration from a different place. This trips people up, so:

| Variable | Where it belongs in production | Why |
|---|---|---|
| `VITE_API_URL` | **Optional.** GitHub → Settings → Secrets and variables → Actions | Read at **build time**. Already defaults to the Render URL in `web/src/api.js`, so you only set this to point at a *different* backend |
| `GOOGLE_CLIENT_ID` | Your **backend host's** env panel (Render/Railway/Fly) | Read at **runtime** by the Express server |
| `GOOGLE_CLIENT_SECRET` | Your backend host's env panel | Same — and must never leave the server |
| `GOOGLE_REDIRECT_URI` | Your backend host's env panel | Same |
| `GOOGLE_SHEET_ID` | Your backend host's env panel | Same |
| `GOOGLE_DRIVE_FOLDER_ID` | Your backend host's env panel | **Optional fallback only** — read once until the admin sets both folders in Settings → Drive folders, which then takes over (stored in the Sheet's `Config` tab as `templatesFolderId` and `couplesFolderId`) |
| `ADMIN_EMAIL` | Your backend host's env panel | Same |
| `SESSION_SECRET` | Your backend host's env panel | Same |
| `CLIENT_URL` | Your backend host's env panel | Same |
| `COOKIE_SAMESITE` / `COOKIE_SECURE` | Your backend host's env panel | Same |

### The short version

**GitHub Secrets can only configure the frontend build.** GitHub Actions
runs, builds the static site, and stops — it isn't running your server, so
it has no way to hand values to Express. The backend lives on a completely
separate host, and that host has its own place to enter environment
variables (Render calls it "Environment", Railway calls it "Variables",
Fly uses `fly secrets set`). That's where every `GOOGLE_*` value goes.

### Serious warning about `GOOGLE_CLIENT_SECRET`

**Never put `GOOGLE_CLIENT_SECRET` (or any other real secret) into a
GitHub Actions variable/secret used by the `web/` build.** Anything the
Vite build can read gets compiled into `assets/index-*.js`, which is
downloaded by every visitor and publicly readable on GitHub Pages. Naming
it a "secret" in GitHub does not protect it once it's baked into a public
bundle — it only hides it from the Actions log.

A GitHub *secret* and a GitHub *variable* are equally exposed once built
into frontend code; the difference is only whether the value is masked in
CI logs. That's why `VITE_API_URL` is fine there (it's just a public URL)
and nothing else is.

If you ever do leak the client secret, rotate it immediately: Google Cloud
Console → Credentials → your OAuth client → **Add secret**, then delete
the old one and update your backend host's env.

### Setting the frontend variable

Either tab works — the workflow reads a variable first, then falls back to
a secret:

1. GitHub repo → **Settings → Secrets and variables → Actions**
2. **Variables** tab → *New repository variable* (recommended — it's not
   sensitive, and you can see its value later), or **Secrets** tab → *New
   repository secret*
3. Name: `VITE_API_URL`, value: your backend URL, e.g.
   `https://marriage-prep-api.onrender.com` (no trailing slash)
4. Re-run the deploy: **Actions** tab → latest run → *Re-run all jobs*.
   The value is read at build time, so changing it requires a rebuild —
   it will not take effect until the workflow runs again.

### Local development still uses .env

On your own machine, `.env` files are the easy path:

```bash
cd server && cp .env.example .env   # then fill it in
cd web    && cp .env.example .env.local
```

If you'd rather not create files even locally, you can pass values inline
instead:

```bash
cd server
GOOGLE_CLIENT_ID=... GOOGLE_CLIENT_SECRET=... GOOGLE_SHEET_ID=... \
GOOGLE_DRIVE_FOLDER_ID=... ADMIN_EMAIL=... SESSION_SECRET=dev \
CLIENT_URL=http://localhost:5173 \
GOOGLE_REDIRECT_URI=http://localhost:4000/api/auth/google/callback \
npm run dev
```

---

## 12. Deploying the backend

> Already handled for you in `render.yaml` and `server/src/index.js`, but
> worth knowing if you move hosts:
>
> - **`app.set("trust proxy", 1)`** — Render terminates HTTPS at its proxy
>   and forwards plain HTTP internally. Without trusting the proxy,
>   Express thinks the connection is insecure and refuses to set the
>   `Secure` session cookie, so login silently fails: the cookie never
>   stores and every request looks signed-out.
> - **CORS uses the *origin*, not `CLIENT_URL` verbatim.** On a project
>   Pages site `CLIENT_URL` contains a path
>   (`https://tnguyen-smc.github.io/marriage-prep-stmarygc`), but a
>   browser's `Origin` header is only `https://tnguyen-smc.github.io`.
>   The server strips the path before comparing, otherwise every request
>   would be rejected.


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

## 13. What's real vs. still simulated

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

## 14. Dependencies

**Frontend:** React 18, Vite 5, Tailwind 3, `lucide-react`, `pdf-lib`.

**Backend:** Express 4, `cookie-session`, `googleapis`, `multer`
(file upload handling), `uuid`, `cors`, `dotenv`.