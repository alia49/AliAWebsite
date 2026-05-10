# What we need from you to finish the site

Ali, the new site is being rebuilt in a monochrome, sidebar-and-halftone style. Most of it can ship
with what's already on your current site and resume. This page lists what only you can give us or decide.

**Quickest path:** answer the 6 questions in [section 5](#5-top-questions-right-now) first. After that,
anything you skip gets the **default** shown next to it, so nothing here blocks launch forever.

**Sending files:** drop them at the listed path, or send the originals and we'll crop, resize and convert them.

Sources checked: your current `App.jsx`, `public/resume.pdf` (last saved 9 Apr 2026), the photos in
`src/assets/`, and your public GitHub (`alia49`, 15 repos, checked 25 Sep 2026).

---

## 1. Must-have to launch

| # | What | Where it shows | Spec | Default if you skip it |
|---|---|---|---|---|
| 1 | **Hero portrait**: pick a photo | Hero (top of page). Also the fallback while the gaze effect is off | `public/images/profile.webp`. Portrait **4:5**, **800×1000**, WebP, **< 150 KB**, metadata stripped. Head and shoulders, face centre about **45 % down** from the top. A plain background works best with the halftone fade | We crop the **Kyoto river photo** (the one on your live site now) to 4:5. See issue 3 |
| 2 | **Role, bio and a "now" line** | Hero, under your name | Role in 5 words or fewer. Bio of 2–3 sentences, **≤ 60 words**. Optional "currently: …" line (open to roles? building something?) | Role: *Software Engineer*. Bio condensed from your current site: *"Full-stack software engineer in San Jose, CA. SJSU CS grad (Dec 2025) building fast web apps and LLM-powered features, most recently BrainBoard, a real-time AI whiteboard."* No "now" line |
| 3 | **Three stats** | Stats row under the hero | Exactly 3. Value ≤ 6 characters, label ≤ 4 words, each backed by your resume | `4` projects shipped · `35+` daily users served · `1,000+` club members supported (becomes `7` projects if you add the GitHub repos in 2b) |
| 4 | **Highlights line** | Thin one-line strip under the hero | One line, about 90 characters, 3–4 items separated by `·` | *B.S. CS, San José State '25 · Full-stack + LLM integration · Freelance client work · SE Club officer '23–'25* |
| 5 | **Project links** | Project card deck | For each of BrainBoard, Voyage, LinkPulse and Abu Barista Coffee: a live URL and/or public repo URL, plus a yes/no that the dates and one-liner are still right | Cards show with **no link buttons** (none of the four has a public repo under that name) |
| 6 | **Missing dates** | Experience list | Start and end month/year for *Student Worker, Mission College Welcome Center* and *Volunteer, Second Harvest of Silicon Valley* | Listed without dates |
| 7 | **Contact email** | Sidebar and "say hello" modal | Confirm `alialtimimiwork@proton.me` is the address you check | That address. **Phone not shown** |
| 8 | **Resume PDF** | "resume" link | `public/resume.pdf`, PDF, < 1 MB (the current one is 139 KB, saved 9 Apr 2026). Ideally a copy **without your phone number** | Current file as is |

---

## 2. Nice to have

### 2a. The 9 "gaze" photos (your portrait follows the cursor)

The effect swaps between 9 photos of you looking in different directions. It stays **off** until all 9
exist; a partial set can't be used. Put them in `public/images/gaze/` with these exact names:

`center.webp` · `up.webp` · `up-right.webp` · `right.webp` · `down-right.webp` · `down.webp` · `down-left.webp` · `left.webp` · `up-left.webp`

**How to shoot them (about 15 minutes; your X-T3 on a tripod is ideal):**
- **Everything identical except where you look.** Use a tripod (or a stack of books) at eye level, about 1–1.5 m away, portrait orientation, and a head-and-shoulders frame with a little space above your head.
- **Lock the camera:** manual focus, exposure and white balance, so brightness doesn't jump between frames. Use the self-timer or a remote/phone app so you don't touch the camera.
- **Soft, even light:** face a window or shoot on an overcast day. No direct sun, no mixed lamps. A plain wall behind you.
- **Sit still.** Keep your shoulders and chair where they are. Turn only your **head slightly (about 15–20°) plus your eyes**, and keep the same expression in every shot.
- **Stick 8 notes around the camera** about 40–60 cm from the lens, labelled with the filenames. Place them **as seen from behind the camera**:
  ```
  up-left      up       up-right
  left      [CAMERA]    right
  down-left    down     down-right
  ```
  Look at each note in turn, and straight into the lens for `center`. Take 2–3 frames per direction and keep the best.
- **Test first:** in the `right` shot your gaze should point to the **right edge of the image**. If it's flipped (mirrored preview), swap the labels.

**Export:** crop all 9 with the **same crop box**, then 4:5, **800×1000**, WebP at quality about 75, **< 150 KB each**,
metadata stripped (camera EXIF includes the body serial number). [squoosh.app](https://squoosh.app) does this for free.
Or send us the 9 originals and we'll do it. `center.webp` also becomes your `profile.webp`.

### 2b. Everything else

| Item | Path / format | Default if you skip it |
|---|---|---|
| **More projects (please confirm):** your public repos [envlens](https://github.com/alia49/envlens) (Python CLI for `.env` drift, Sep 2026), [RateLimiter](https://github.com/alia49/RateLimiter) (4 algorithms plus an HTTP service, Sep 2026) and [Tiktok-Summary](https://github.com/alia49/Tiktok-Summary) (FastAPI + Whisper + Claude summaries, Apr 2026) look deck-worthy, and they have real repo links | Same `projects` fields as the others | Not added |
| **Project screenshots** | `public/images/projects/<slug>.jpg`. Slugs: `brainboard`, `voyage`, `linkpulse`, `abu-barista-coffee` (plus `envlens`, `ratelimiter`, `tiktok-summary`). **1200×750** (16:10) JPEG, **< 250 KB**. No real customer names, emails or orders visible | A generated monochrome title card per project |
| **Recommendations** | Quote (about 60 words max; it's clipped at 5 lines), name, title or relationship, and **their OK to publish**. Ideas: the Abu Barista Coffee owner (a client quote is gold for freelance work), your club advisor or fellow officers, a professor, a BrainBoard/Voyage teammate. Existing LinkedIn recommendations work, with permission | Section hidden |
| **Certifications** | Title, issuer, verify URL, logo at `public/images/certs/<slug>.png`. If your site claims AWS skills and you hold an AWS cert, this is where it goes | Section hidden |
| **Affiliation logos** | `public/images/affiliations/<slug>.png`, e.g. SJSU Software Engineering Club, Second Harvest. Square, transparent PNG, ≥ 128×128, **< 30 KB**, ideally a one-colour version (the site is greyscale) | Affiliations shown as text only |
| **Blog posts / links** | Title, `YYYY-MM`, one-sentence summary, URL. External posts are fine (LinkedIn, dev.to, Medium). Easy first posts: your RateLimiter README, how Voyage cut Gemini costs 20 %, LinkPulse's sub-10 ms caching | Section hidden |
| **Share image (OG)** | `public/og-image.png`, **1200×630** PNG, < 300 KB. It's the preview when your link is shared on LinkedIn, Slack or iMessage | Generated card: name, role and halftone |
| **Favicon / app icons** | `public/favicon.ico` (16/32/48 px), `public/logo192.png`, `public/logo512.png`. They're still the default React logo | An "AA" monogram |
| **Skills list** | Confirm or edit. The resume lists Python, Java and SQL, which the site doesn't | The resume's list |
| **GitHub profile tidy-up** (off-site, 5 min) | The site links there. Change display name "AliA" to "Ali Altimimi" and location "SJ" to "San Jose, CA", add a bio, pin your best repos, delete or archive the 4 empty repos (FoodiesForLess, Quick-and-Easy-Weather, Tip, WebMe), and turn on *Settings → Public profile → Include private contributions* | Unchanged |

---

## 3. Decisions

| Decision | Options and trade-offs | Our recommendation | Default if no answer |
|---|---|---|---|
| **Backend hosting** (needed for chat, live presence and Ask; the rest of the site is static on GitHub Pages) | **None**: $0, those three features hidden. **Railway**: small usage-based plan with volumes. **Fly.io**: small VM plus a 1 GB volume, a few $/month. **Render**: works only on a *paid* instance with a disk; free instances sleep and have no persistent disk, so SQLite chat history would be wiped. Prices change, so check before signing up | Launch static first. Add Railway or Fly.io when you want the live features | **Static only.** Chat, presence and Ask are hidden (not shown as "offline") |
| **AI "Ask me" box (⌘K)** | Needs your own **Anthropic API key** (make a separate key just for the site) and a **monthly spend limit** in the Anthropic Console. At current list prices a question (about 4k tokens in, 300 out) costs about **$0.006 on Haiku 4.5**, **$0.011 on Sonnet 5** or **$0.03+ on Opus 5**, so 1,000 questions a month is about $6 / $11 / $30+. Per-visitor rate limiting is built in. It answers **only** from your profile content | Haiku 4.5 or Sonnet 5, with a **$10/month cap** | **Off.** Falls back to "email me" |
| **Community chat** | An anonymous guestbook-style chat. Links and profanity are blocked, there's a 15 s cooldown, only the latest 200 messages are kept, and no location is collected. **But** the current plan has **no moderator delete** (only authors can delete their own messages), and what visitors post appears on your site | Keep it only if you'll host the backend, and ask for an admin delete key first | **Off** |
| **Site URL** | Keep `alia49.github.io/websiteDemo/`. Or rename the repo to `alia49.github.io` for a clean root URL (free). Or buy a custom domain (about $10–20/year). Any change updates `homepage` in `package.json` and the backend's allowed origins | Rename the repo, or buy a domain if you'll keep it | Keep the current URL |
| **Socials** | Now: GitHub and LinkedIn. Add Instagram (for your photography?), X, or others? | Only accounts you'd be happy for a recruiter to open | `github ↗` `linkedin ↗` plus email |
| **Phone number** | Show or hide on the site. The resume PDF is public too | Hide it, and keep it out of the profile data entirely (see issue 10) | **Hidden** and not stored |
| **GitHub contribution graph** | Your public graph shows **25 contributions in the last year** (11 active days), probably because most of your work is in private repos | Turn on "Include private contributions" (2b), then show it | Shown |

No input needed for the theme switch, the ⌘J typing test or UI sounds (muted until a visitor clicks).

---

## 4. Content issues found

1. **The stats are template leftovers.** "7 projects · 5 yrs · Nationality" hasn't changed since the first template in Aug 2025, when the project list was 6 placeholder cards. Four projects are listed now. Your dated experience runs from Aug 2023 (club officer) and Sep 2025 (freelance), with graduation in Dec 2025, so "5 yrs experience" will read as five years in industry. If it means years of coding, label it "yrs coding". The "American 🇺🇸" stat doesn't suit a monochrome design. If the point is work authorisation, *"US citizen, no sponsorship needed"* in the highlights line says it more clearly.
2. **Your phone number is public.** The live Contact page shows +1 (703) 672-0111 as a clickable link, and it's also in the downloadable `resume.pdf`. Scrapers harvest both, which leads to spam calls. We recommend removing it from the site, and optionally publishing a resume copy with just email and LinkedIn.
3. **The portrait.** The new Fuji photo (`DSCF4669.JPEG`, a local change that hasn't been committed or deployed) is **10.7 MB at 6240×4160**. Shipped as is, it would be the heaviest thing on the page by far. It's a lovely Shanghai skyline shot, but you're small in the frame, looking to the side, with strangers' faces behind you. The Kyoto photo on the live site faces the camera and crops well to 4:5. It's only 1108×844 (and is really a PNG named `.jpeg`), so send the full-resolution original if you have it. Either way we ship a WebP under 150 KB. No GPS data was found in the photo. Please keep the 10.7 MB original out of the repo.
4. **The resume and the site disagree:**
   - The resume lists **Python, Java and SQL**, which the site doesn't. Python is also what your recent public repos use.
   - The resume's strongest club facts (**1,000+ members, 20+ events, you built the club website's front end**) aren't on the site.
   - The site lists Mission College Welcome Center and Second Harvest (with no dates); the resume doesn't.
   - The resume summary says "web **and mobile** applications", but no mobile project appears anywhere.
   - The site names specific AWS services (EC2, S3, Lambda, IAM), but no listed project uses AWS. Expect interview questions about it.
   - The hero calls you a club officer in the present tense; the role ended Dec 2025.
5. **Nothing is dated after March 2026.** The latest entry (BrainBoard) ends in Mar 2026. envlens, RateLimiter and Tiktok-Summary are newer, and they aren't on the site or the resume. One "currently …" line fixes this.
6. **Every project leads with a metric** (3×, 90 % contextual relevance, sub-2 s, 20 %, 60 %, 500+ req/min). That's strong, but the Ask box will repeat these numbers and interviewers will probe them. Have a one-line "how it was measured" for each, especially "90 % contextual relevance".
7. **No public code for the four featured projects.** Anyone clicking through to GitHub mostly finds coursework and empty repos. Making even one featured repo public, or adding a short demo video, helps a lot.
8. **Template leftovers on the live site:** the tab title "React App", the meta description "Web site created using create-react-app", the manifest name "Create React App Sample", the default React favicon, and an "S" logo in the top bar. The rebuild fixes the text; the icon is your call (2b).
9. **Abu Barista Coffee** is dated Sep 2025 – Jan 2026 but described in the present tense ("serving 35+ daily active users"). If it's still live, link it; if not, use the past tense. Also confirm the client is happy to be named, and to appear in screenshots.
10. **The Ask box can repeat anything in your profile data.** Your page content is the AI's only source. If the phone number is stored there, even hidden, the AI could hand it out. By default we won't store it.
11. **Housekeeping.** There are two deploy paths: a GitHub Action on every push to `main`, and an old `npm run deploy` script with a `gh-pages` branch. Check *Settings → Pages → Source* is "GitHub Actions" so the stale branch never goes live.

---

## 5. Top questions right now

1. **Hero photo:** Kyoto river (live site), Shanghai skyline (your new one), or will you send a new headshot or the 9 gaze photos?
2. **Projects:** Should we add envlens, RateLimiter and Tiktok-Summary to the deck (that makes 7)? And do any of the four existing projects have a public link?
3. **Stats:** Are "7 projects · 35+ daily users served · 1,000+ club members supported" OK in place of "7 projects · 5 yrs · Nationality"?
4. **Now:** In one line, what are you doing now or looking for (e.g. "open to full-stack roles in the Bay Area")?
5. **Phone:** OK to remove it from the site? And do you want a phone-free copy of the resume?
6. **Live features:** Launch static first, or set up the backend now? If now, is about $5–15/month (hosting plus a capped AI budget) OK?
