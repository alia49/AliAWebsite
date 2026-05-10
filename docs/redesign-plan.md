# Redesign plan: a bryllim.com-inspired portfolio

This plan maps how bryllim.com is built and turns that into a plan for this site.
The goal is the same **feel and interaction design**, built with our own code and
the site owner's content. We do **not** copy Bryl Lim's code, text, photos, sprite art,
sounds or icons. Everything below describes behaviour, and we rebuild it ourselves.

---

## 1. How bryllim.com is built

| Layer | What it uses |
|---|---|
| Server | Laravel (PHP 8.3) on Hostinger. Server-rendered HTML with a CSRF token and a session cookie. |
| Styling | Tailwind (compiled `site.css`) plus about 30 KB of hand-written CSS in inline `<style>` blocks. |
| Scripts | About 10 inline vanilla-JS modules, one per feature, wired through `onclick="openX()"` globals. |
| Fonts | Geist (UI), Geist Mono (labels and numbers), Source Serif 4 (quotes), Geist Pixel (accents). All are open-licensed. |
| Backend features | Blog with RSS and JSON feeds and `llms.txt`, community chat (`/chat`), live presence (`/presence`). |
| Extras | UI sounds (Web Audio, synthesised with no audio files), a GitHub contribution graph, SEO (JSON-LD, OG and Twitter cards, canonical). |

### Layout
- **Desktop (lg+):** a fixed left sidebar (`w-56`, right border) holds the name, section links, shortcut hints
  ("Ask anything ⌘K", "Typing test ⌘J"), a presence pill ("1 person viewing now" plus avatars), a
  "community chat" button, the email address and a light/dark/system theme switch. The content column sits beside it (`lg:pl-56`).
- **Mobile:** a sticky top header (`bg-white/90 backdrop-blur-md`) with a hamburger button that opens a full-screen nav.
- **Content column (one page, anchor sections):**
  1. **Hero:** portrait, name (h1), a 2–3 sentence bio, social links written as `github ↗`.
  2. **Highlights strip:** a single line of credentials between thin top and bottom borders.
  3. **Stats:** a 3-column grid with `divide-x` rules (big number over a small label).
  4. **Numbered sections:** each heading reads `01 — blog`, `02 — projects`, and so on, with a
     right-aligned "all … →" link. Sections: blog, projects, experience (plus a stack sub-block),
     certifications, recommendations, affiliations, github.
  5. **Modal:** a "say hello" panel with a copy-email button.

### Design system
- **Colour tokens** are stored as RGB channel triplets, so opacity can be applied: `--bg: 255 255 255`,
  `--ink`, and a grey ramp `--g50 … --g950`. `html.dark` redefines the whole ramp. The palette is
  monochrome, almost no colour. `::selection` is inverted ink.
- **No flash on load:** a small inline script in `<head>` reads the saved theme before first paint, and `html`/`body`
  get their background from the tokens straight away.
- **Theme switch:** a pill with three icon buttons (light, dark, system). Switching uses the **View Transitions API**
  with a circular reveal that starts at the click point. The fallback is a 0.5 s colour crossfade, applied only
  while `html.theme-anim` is set. Both honour `prefers-reduced-motion`.

### Signature creative CSS (reimplement from these descriptions)
- **Halftone dot fields:** `background-image: radial-gradient(circle, ink 1px, transparent 1.6px)`
  with `background-size` of 9 px (default), 6 px (dense), 13 px (wide) or 5 px (fine, 0.8 px dots). In dark mode the
  dots switch to a light, low-opacity ink.
- **Masks that fade the dots:** radial `mask-image` from a corner (top-right, bottom-left, left),
  a circle, `mask-fade-x` (fades at both sides), and up/down linear fades. The hero photo uses a
  bottom-edge dissolve mask, so a fine halftone field shows through where the photo fades out.
- **Dither textures:** decorative corner PNGs, inverted with `filter: invert(1)` in dark mode. We make our own
  or draw them with CSS/SVG.
- **Entrance motion:** `fadeUp` (opacity 0 → 1, 12 px → 0) with `cubic-bezier(.16,1,.3,1)`, staggered through
  delay classes `d1…d6` (+70 ms each). A pulsing dot marks live things (presence).
- **Spotlight card deck (projects):** three absolutely positioned cards on a stage about 17–19 rem tall.
  - center: `translateY(0) rotate(0) scale(1)`, top z-index, deep soft shadow.
  - left/right: `translateX(∓40%) translateY(14px) rotate(∓16deg) scale(.88)`, dimmed by a
    `::after` veil in the page background colour at 40 % opacity.
  - hover: the center card lifts about 7 px; side cards rotate in to about 12° and lose the veil.
  - clicking a side card swaps it into the center. Links on the side cards are inert. On mobile the deck bleeds to full width
    (`margin-inline: calc(50% - 50vw)` plus `overflow-x: clip`).
  - transitions: `transform .5s cubic-bezier(.22,1,.36,1)`.
- **Gaze portrait:** nine photos (center plus 8 directions). On pointer move, take the angle from the
  face (about 45 % down the image) to the cursor, snap it to 45° sectors, and swap `src`. Show `center` when the cursor is close
  or has left the window. Throttle with requestAnimationFrame, and turn the effect off under reduced motion.
- **Recommendations:** serif quotes, `line-clamp-5`, and cards with a light top-to-bottom grey gradient.

### Interactive overlays
| Feature | bryllim.com behaviour | Our version |
|---|---|---|
| ⌘K "Ask anything" | Shows a typed prompt, then **reveals the visitor's own IP, city, ISP and device** (a privacy "gotcha"). | **Not copied.** It's a privacy anti-pattern and his signature gag. Ours is a real **"Ask me anything about <name>"** AI answerer backed by `/api/ask`, grounded only in `profile.json`. |
| ⌘J Typing test | A monkeytype-style test: word stream, caret, live WPM, accuracy and time, on-screen keyboard highlighting, results screen with a verdict. | Rebuilt with our own word bank and wording. |
| Community chat | A guestbook-style chat: name, messages, edit/delete your own, cooldown, link and profanity blocking. It shows the **visitor's city** next to each message. | Rebuilt with **no location collection**. Device type (desktop/mobile) only. |
| Chat "playground" | A pixel-art canvas room: your avatar walks with the arrow keys, recent chatters appear as NPCs, with footstep sounds. | Stretch goal (P2): procedurally drawn pixel avatars, no sprite sheets. |
| Presence | Heartbeat to `/presence` and a "N people viewing now" count with avatars. | Rebuilt with `POST /api/presence`. |
| Sounds | Small synthesised UI sounds (chime, tick, and so on) through Web Audio. | Our own tiny Web Audio synth, with a mute toggle. Sounds start only after a user gesture. |

---

## 2. Target architecture for this repo

- **Frontend:** stays Create React App plus **Tailwind 3** (turn it on: add the `@tailwind` directives to
  `src/index.css` and fix `tailwind.config.js` content globs to `./public/index.html` and `./src/**/*.{js,jsx}`).
  It's a single page with anchor sections, no router needed. It deploys unchanged to GitHub Pages at
  `https://alia49.github.io/AliAWebsite/` (so `PUBLIC_URL` is `/AliAWebsite`).
- **Backend:** a new standalone Node ≥ 22 service in `server/` (Express plus the built-in `node:sqlite`). It is
  hosted separately (Render, Railway, Fly and so on), because GitHub Pages is static-only.
- **Graceful degradation:** the frontend reads `process.env.REACT_APP_API_URL`. If it's unset or the
  API is unreachable, the site still works fully. Presence is hidden, chat shows "chat is offline", and Ask falls back
  to "email me". The GitHub graph calls a public API directly, so it doesn't need our backend.

### Content: a single source of truth
All owner content lives in **`src/content/profile.json`**. The frontend imports it, and the backend
reads it (`PROFILE_PATH`, default `../src/content/profile.json`) to ground `/api/ask`.

```jsonc
{
  "name": "", "role": "", "location": "", "email": "", "phone": "",   // phone kept but not shown by default
  "bio": "", "resume": "resume.pdf",                                  // relative to PUBLIC_URL
  "socials": [{ "label": "github", "url": "" }],
  "highlights": [""],                                                 // the one-line credentials strip
  "stats": [{ "value": "", "label": "" }],                            // exactly 3
  "posts": [{ "title": "", "date": "YYYY-MM", "summary": "", "url": "" }],  // section hidden if empty
  "projects": [{ "slug": "", "title": "", "category": "", "badge": "", "date": "", "desc": "",
                 "bullets": [""], "stack": [""], "image": "images/projects/<slug>.jpg",
                 "links": { "demo": "", "repo": "" } }],
  "experience": [{ "year": "", "role": "", "org": "", "dates": "" }],
  "education": [{ "degree": "", "school": "", "date": "" }],
  "stack": [""],
  "certifications": [{ "title": "", "issuer": "", "url": "", "logo": "" }],  // hidden if empty
  "recommendations": [{ "quote": "", "name": "", "title": "" }],           // hidden if empty
  "affiliations": [{ "name": "", "role": "", "logo": "" }],               // hidden if empty
  "githubUser": "alia49",
  "gaze": { "enabled": false, "dir": "images/gaze" }                    // needs 9 photos, see below
}
```

**Asset locations** (all under `public/`, referenced through `process.env.PUBLIC_URL`):
- `images/profile.webp` is the main portrait (fallback when gaze is off).
- `images/gaze/{center,right,down-right,down,down-left,left,up-left,up,up-right}.webp` are the 9 gaze photos.
- `images/projects/<slug>.jpg` are project screenshots (about 1200×750).
- `images/certs/*.png` and `images/affiliations/*.png` are logos.
- `og-image.png` (1200×630), `favicon.ico`, `logo192.png`, `logo512.png`.

---

## 3. API contract (the frontend and backend must match this exactly)

Base: `${REACT_APP_API_URL}/api`. All bodies are JSON. Errors are always `{ "error": "<code>" }`.
Visitor identity is a random UUID kept in `localStorage` (`visitorId`) and sent as the **`X-Client-Id`** header.
The server stores only a hash of it and never echoes another visitor's id.

| Method & path | Request | Success | Errors |
|---|---|---|---|
| `GET /health` | none | `200 {"ok":true,"features":{"chat":true,"presence":true,"ask":bool}}` | none |
| `GET /chat?after=<id>` | `X-Client-Id` (optional) | `200 {"messages":[Message],"total":n}`: latest 50 ascending, or only `id > after` | none |
| `POST /chat` | `{"name","body"}` + `X-Client-Id` | `201 {"message":Message}` | `400 empty\|too_long\|link\|offensive\|bad_name\|no_client`, `429 {"error":"cooldown","retryAfter":s}` |
| `PATCH /chat/:id` | `{"body"}` + `X-Client-Id` | `200 {"message":Message}` | `400 …`, `403 forbidden`, `404 not_found` |
| `DELETE /chat/:id` | `X-Client-Id` | `204` | `403 forbidden`, `404 not_found` |
| `GET /chat/identity` | `X-Client-Id` | `200 {"name":string\|null}` | none |
| `POST /presence` | `X-Client-Id` | `200 {"count":n,"avatars":[seed,…≤5]}` | `400 no_client` |
| `POST /ask` | `{"question", "history":[{"role":"user"\|"assistant","content"}] ≤6}` | `200 {"answer":string}` | `400 bad_question`, `429 {"error":"rate_limited","retryAfter":s}`, `503 ask_disabled`, `502 upstream` |

`Message = {"id":int,"name":str,"body":str,"device":"desktop"|"mobile"|"unknown","createdAt":ISO,"editedAt":ISO|null,"mine":bool}`

Rules: name is 1–24 characters and body is 1–280 characters, both trimmed. Links are rejected. A small profanity list is enforced. Each client has a 15 s
cooldown. Only the latest 200 messages are kept. Presence heartbeats every 20 s while the tab is visible and expires after 45 s.
Avatar seeds are stable, non-reversible hashes. The frontend draws the avatars (no third-party avatar service).
CORS comes from `ALLOWED_ORIGINS` (default `http://localhost:3000,https://alia49.github.io`). Allowed headers are
`Content-Type` and `X-Client-Id`, and allowed methods are GET, POST, PATCH and DELETE.

---

## 4. Work split

| Agent | Owns | Must not touch |
|---|---|---|
| Frontend | `src/**`, `public/**` (except `resume.pdf`), root `package.json`/lockfile, Tailwind/PostCSS config | `server/**`, `docs/needs-from-owner.md` |
| Backend | `server/**` (including its own README, `.env.example`, `.gitignore`, tests) | everything outside `server/` |
| Needs audit | `docs/needs-from-owner.md` (read-only everywhere else) | all code |

Frontend priorities: **P0** layout, tokens, theme, hero, stats, sections, deck, modal, motion, a11y, and a passing build.
**P1** gaze, ⌘K Ask, ⌘J typing test, chat and presence UI, sounds. **P2** the pixel room.

## 5. Ground rules for everyone
- Write original code. Don't download or reuse bryllim.com's code, text, images, sprites or sounds. Open-licensed
  fonts and libraries are fine.
- Don't commit, push or deploy. **Pushing to `main` auto-deploys the live site.** Work stays on the `redesign` branch.
- Respect `prefers-reduced-motion`, keyboard access (Esc closes overlays, focus is trapped and restored) and colour contrast in both themes.
- Collect no visitor location or IP-derived data.
