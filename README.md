# Ali Altimimi — portfolio

Personal site of Ali Altimimi, software engineer. Live at <https://alia49.github.io/AliAWebsite/>.

A single page with anchor sections: hero, highlights, stats, projects (a spotlight card deck),
experience/education/stack, GitHub contributions and contact. The optional extras are an
**Ask me anything** overlay (⌘K / Ctrl+K), a **typing test** (⌘J / Ctrl+J), a **community chat** with
live presence and a small pixel room, and synthesised UI sounds. Light, dark and system themes.

Built with Create React App, React 19 and Tailwind 3. The design brief is in
[`docs/redesign-plan.md`](docs/redesign-plan.md).

## Run it

```bash
npm install
npm start          # http://localhost:3000/AliAWebsite
npm test           # Jest + Testing Library smoke tests
npm run build      # production build in build/
```

## Backend (optional)

Chat, presence and Ask come from the separate API in [`server/`](server/README.md). The site works
without it: presence is hidden, chat shows "chat is offline" and Ask offers an email link instead.

To use a local API, start it (`cd server && npm install && npm start`, port 8787), then create
`.env.development.local` in the repo root:

```
REACT_APP_API_URL=http://localhost:8787
```

Restart `npm start` afterwards. Use the bare origin: no trailing slash and no `/api`, because the client adds `/api`.
`REACT_APP_*` values are inlined at build time, so production builds need the variable set to the
deployed API URL.

## Where things live

| Path | What |
|---|---|
| `src/content/profile.json` | **All content**: bio, projects, experience, stack, links and so on. The API also reads it to ground Ask. Empty arrays (`posts`, `certifications`, `recommendations`, `affiliations`) hide their sections. |
| `public/images/profile.webp` | Hero portrait (1000 px WebP, made from `src/assets/DSCF4669.JPEG`). |
| `public/images/gaze/*.webp` | Optional "gaze" portrait: nine photos named `center`, `up`, `up-right`, `right`, `down-right`, `down`, `down-left`, `left` and `up-left` (the direction the face looks). Then set `gaze.enabled` to `true`. |
| `public/images/projects/<slug>.jpg` | Optional project screenshots (about 1200×750). Set each project's `image`. |
| `public/og-image.jpg`, `favicon.svg`, `favicon.ico`, `logo*.png` | Social card and icons. |
| `src/components/` | Layout and sections (sidebar, hero, deck, timeline, GitHub graph, modals). |
| `src/features/` | `ask/`, `typing/`, `chat/` (chat, presence, pixel room), `sounds/`, `gaze/`. |
| `src/lib/` | API client (`api.js`: base URL, `visitorId`, `X-Client-Id`), theme, storage, helpers. |
| `src/index.css`, `src/styles/effects.css` | Colour tokens (light and dark grey ramps), halftone, masks, dither, deck and motion. |

## Build and deploy

A push to `main` runs `.github/workflows/static.yml`, which runs `npm ci && npm run build` on Node 18 and
publishes `build/` to GitHub Pages. CI sets `CI=true`, so **any ESLint warning fails the build**. Run
`CI=true npm run build` locally before you push. `package.json`'s `homepage` makes `PUBLIC_URL`
`/AliAWebsite`, so reference assets with `process.env.PUBLIC_URL` (see `src/lib/asset.js`).

To enable the live features on the deployed site, add `REACT_APP_API_URL` to the workflow's build step
(for example `env: REACT_APP_API_URL: https://your-api.example.com`), and allow
`https://alia49.github.io` in the API's `ALLOWED_ORIGINS`.
