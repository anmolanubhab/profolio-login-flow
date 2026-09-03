# Profolio Resume Builder — live audit + native build

**Date:** 2026-09-03
**Reference audited:** ResumeBuilder.com "Resume Builder App", inspected live in the
pinned Chrome session (desktop flow end-to-end; mobile onboarding). Deep mobile
builder steps were partly blocked by tooling (notes below).
**Rule followed:** UX patterns / IA / workflow used as reference only. No proprietary
source, assets, logos, trademarks, or template artwork copied. Everything below is
built natively in Profolio's React + Vite + Tailwind + shadcn stack.

---

## 1. What the live ResumeBuilder.com flow actually does

Walked the real app: `resumebuilder.com` → **Create My Resume Now** → onboarding
(*Easy as 1‑2‑3* / experience level) → **template gallery** (filters: Headshot,
Columns; per‑card colour swatches; "Recommended" badges) → **upload vs start from
scratch** → interstitial *"Why do you need a resume?"* → **section wizard**.

**Wizard (left rail stepper): Heading → Work history → Education → Skills → Summary →
Finalize**, with a "Resume Completeness %" meter that climbs as sections fill.

| Screen | Key behaviour observed live |
|---|---|
| **Heading** | First/last name, city/country/pin, phone, email\*. "Add additional information" chips (LinkedIn, Website, Driving licence) inject extra fields. Right side shows a live mini‑preview + green ticks on valid fields. |
| **Work history** | Per‑role form: title\*, employer\*, location, Remote checkbox, month/year start + end dropdowns, "I currently work here". Then a **two‑panel description editor**: left = searchable **pre‑written "Expert Recommended" phrase library** keyed to the job title (toggle a phrase in/out with a check); right = **rich‑text editor** (bold, italic, bullet list, spellcheck, clear‑format, link, undo/redo) + **"Enhance with AI"**. A modal offers to bulk‑add 4 recommended bullets. "Enhance with AI" opens per‑bullet rewrites in 4 modes: **Simplify / Elevate impact / Highlight result / Managed** — pick one via radio, Apply. Section ends on a **summary list** of entries (numbered, edit/delete icons, "Show more details", "+ Add another position") + an upsell modal to add more. |
| **Education** | Highest level chooser → school\*, location, degree dropdown, field, grad month/year, collapsible "additional coursework". Summary list with a "Missing additional coursework" nudge pill. |
| **Skills** | Same two‑panel pattern. Modal: "We found N top skills for *title*". **Text Editor** tab (bullet list) **or** **Skills Rating** tab (per‑skill 5‑dot rating + inline rename + remove + "Add one more"). A "Skills: N" strength meter. |
| **Summary** | Modal with **3 AI‑generated summaries** ("Design Leadership" / "User‑Centric Design" / …), each expandable; "Use this version" or "I'll add my own" → same rich‑text editor. |
| **Extra sections** | Checklist: Personal Details, Websites/Portfolios, Certifications, Languages (NEW), Accomplishments, Additional Information, Affiliations + free "Add your own". |
| **Finalize** | Full‑screen dark review: zoomable page preview + a right rail of **Tips & fixes** cards (Best practices / Spelling & grammar / Missing details) with Accept/Dismiss; then a **document editor**: left icon rail (Templates, Design & formatting, Add section, Spell check), centre live A4 preview, right actions **Download / Print / Email / Finish**, a circular **Resume Score** gauge, "More options → Duplicate / Delete", editable file name, undo/redo, zoom. |
| **Design & formatting** | Recommended colours + "See all"; **drag‑to‑reorder section order**; Font style Small/Normal/Large; Font family dropdown; **Section / Paragraph / Line spacing sliders**; Reset to default; Advanced. |
| **Templates (in editor)** | Colour‑filtered thumbnail grid, live swap, content preserved. |
| **Download** | Modal: **Adobe PDF / MS Word (.docx) / Plain Text (.txt)** + file‑name field. (Paywalled on the real site.) |
| **Back / Save / Refresh** | "Go Back" returns a step without losing data; autosave ("Saved" chip); deep links (`/section/expr` etc.) require wizard state and otherwise bounce to start. |
| **Mobile** | Onboarding restyled ("*Just three simple steps*"), single column, full‑width sticky CTA. Deep builder steps could not be fully driven in the automation harness (real Chrome window won't resize below OS size; the isolated browser lost wizard state and its synthetic clicks timed out on that SPA). Profolio's mobile design below is therefore an **intentional** design, informed by the mobile onboarding that was captured plus the desktop IA — not a shrunk desktop. |

---

## 2. Current Profolio resume implementation (before this change)

| Area | State found |
|---|---|
| Component | `src/components/ResumeBuilder.tsx` (529 lines) — one long form. |
| Fields | Title + Personal Info (name/email/phone/location) + **four free‑text `<textarea>`s**: Summary, Experience, Education, Skills. No structured entries, no dates, no bullets. |
| Storage | `resumes` table — `id, user_id, title, content jsonb, pdf_url (unused), created_at, updated_at`. RLS: per‑user on all four ops (correct). 3 existing rows, **three different historical `content` shapes** (flat strings; a richer `{personalInfo, projects[], education[]}` shape; and a `{type:"upload"}` recruiter‑file marker). |
| Templates | None. |
| Live preview | None. |
| Customisation | None (no fonts / colours / spacing / order). |
| AI | None. **No AI edge function exists** in the project, no LLM key, and none is in scope to add. |
| Export | `jsPDF` — dumps section labels + raw text, no layout. |
| Import from profile | `prefillFromProfile()` pulled `profiles` + `education`/`experience`/`skills` tables into the textareas. |
| Reusable infra found | `@tiptap/react` + starter‑kit already in the project (used by Insights); `jspdf`; shadcn `tabs/slider/radio-group/progress/sheet/dialog/alert-dialog`; `dompurify`. No drag‑and‑drop library. |

---

## 3. Audit table — reference ▸ current Profolio ▸ what was built

| Capability | ResumeBuilder.com (reference) | Profolio *before* | Profolio *now* (this change) |
|---|---|---|---|
| **Template selection** | Gallery, filters (headshot/columns), colour swatches, recommended, live swap | — | **`TemplateGallery`** — 4 original templates (Aurora / Ledger / Sidebar / Minimal), filters (1‑col / 2‑col / has‑photo), live `ResumePreview` thumbnails, "good for" tags, swap keeps content |
| **Editor shell** | Left stepper, centre form, right live preview, completeness % | Single scroll form | **`ResumeEditor`** — step rail (Heading → Summary → Experience → Education → Skills → Projects → More → Design), centre form, right sticky live preview (desktop) / bottom‑sheet preview (mobile), **"Resume strength %"** meter with next‑action hint |
| **Structured sections** | Per‑entry forms, summary lists, add/remove/reorder | Textareas | **`sectionEditors.tsx`** — Experience / Education / Projects / Custom as entry lists: add, delete, **reorder (↑/↓, accessible)**, per‑entry fields incl. dates + "currently work here" |
| **Rich‑text bullets** | Bold/italic/list/link/undo/redo + spellcheck | — | **`BulletEditor`** (Tiptap) — bold, italic, bullet list, link, undo/redo; sanitised HTML out |
| **Phrase library** | Pre‑written "Expert Recommended" phrases per job title, toggle in/out | — | **`PhraseDrawer`** — hand‑written phrase buckets (design / engineering / data / sales / marketing / management + generic), matched to the entry's job title, searchable, tap to add/remove, shows "added" state |
| **AI writing** | LLM rewrites (Simplify / Elevate / Highlight) + AI summaries | — | **No LLM available/approved.** Instead: **`polishBullet()`** — deterministic, offline rewrite (weak‑opener → strong verb, filler removal, casing) exposed as a **"Polish"** button. Honestly labelled "Suggestions"/"Polish", not "AI". AI rewrite/summaries are a documented future item (needs an LLM key). |
| **Skills** | Bullet list *or* per‑skill 5‑dot rating | Textarea | **`SkillsEditor`** — chip list, Enter‑to‑add, reorder, remove, **optional 5‑dot proficiency** per skill, suggestions drawer |
| **Live preview** | Real‑time A4 render of the chosen template | — | **`ResumePreview`** — one parametric renderer drives all 4 templates + the gallery thumbnails + the PDF, so *what you pick is what you download*. Reads accent / font / size / spacing / section order live |
| **Design & formatting** | Colours, section order (drag), font, 3 spacing sliders | — | **`DesignPanel`** — template switch, 8 accent swatches, font family (4), text size (compact/normal/roomy), section‑spacing slider, section reorder, "Reset design" |
| **Export** | PDF / DOCX / TXT + file name | jsPDF text dump | **`ExportDialog`** — **PDF** (`buildResumePdf`, styled to the template: accent header/band, heading rules, bullet dots, page breaks, zero‑decimal‑safe) + **Plain text** (ATS‑paste) + file‑name field. DOCX noted as future (needs a docx lib). |
| **Import** | Upload & parse an existing resume | prefill from profile → textareas | **`importFromProfile`** — pulls `profiles` + `experience`/`education`/`skills` into the structured model, **fills blanks only** (never overwrites typed content). File‑upload parsing kept as future; existing `{type:"upload"}` rows are detected and shown read‑only with a clear explanation. |
| **List / manage** | Duplicate, delete, rename, more‑options | list + edit/pdf/delete | **`ResumeWorkspace`** — cards with Edit / quick‑PDF / Duplicate / Delete (confirm dialog), inline rename, empty state, autosave ("Saved" / "Unsaved changes" / "Saving…") |
| **Mobile** | Restyled onboarding, stacked, sticky CTA | inherited desktop | Intentional: step rail becomes a horizontal scroller, preview becomes a full‑height bottom sheet toggled by a "Preview" button, single‑column forms, action bar sits above the app's bottom nav, no horizontal overflow |
| **Data model** | proprietary | 3 incompatible shapes | **`schema.ts`** — one `ResumeDoc` v2 + **`normalizeResume()`** that upgrades every historical shape (flat strings, arrays, `projects`, recruiter‑upload marker) losslessly on open |
| **Back / refresh / deep link** | step back keeps data; deep links need state | n/a | Browser back and full refresh keep the open resume (it autosaves); the workspace is view‑state driven inside `/resume` |

---

## 4. Files added / changed

**New — `src/lib/resume/`**
- `schema.ts` — `ResumeDoc` v2, entry factories, `normalizeResume()` (back‑compat for all 3 historical shapes + upload marker), `completeness()`.
- `templates.ts` — 4 template definitions, accent swatches, font stacks, size scale.
- `phrases.ts` — phrase buckets by role, `suggestBullets` / `suggestSkills`, deterministic `polishBullet()`, HTML↔bullet helpers.
- `export.ts` — `buildResumePdf()` (styled jsPDF), `resumeToPlainText()`, `downloadResumePdf` / `downloadResumeText`.

**New — `src/components/resume/`**
- `ResumeWorkspace.tsx` — list ▸ template‑gallery ▸ editor; load/save/duplicate/delete; autosave; upload‑row notice.
- `ResumeEditor.tsx` — stepper + active section + completeness + desktop preview + mobile preview sheet + export/import actions.
- `ResumePreview.tsx` — parametric renderer for all templates (single & sidebar layouts).
- `TemplateGallery.tsx` — picker with filters + live thumbnails.
- `DesignPanel.tsx` — colours / font / size / spacing / section order.
- `sectionEditors.tsx` — Basics / Summary / Experience / Education / Skills / Projects / Custom editors.
- `BulletEditor.tsx` — Tiptap rich‑text with Polish + Suggestions.
- `PhraseDrawer.tsx` — phrase / skill suggestion sheet.
- `ExportDialog.tsx` — format + file‑name.
- `profileImport.ts` — merge Profolio profile into a `ResumeDoc` (blanks only).
- `sampleDoc.ts` — filler content for template thumbnails.

**Changed**
- `src/pages/Resume.tsx` — renders `<ResumeWorkspace />` (was `<ResumeBuilder />`), wider `fullWidth` layout; keeps `ProfessionalResourcesManager` below.
- `src/index.css` — appended scoped `.resume-rt` / `.resume-editor-rt` styles (bullet markers, editor placeholder). Nothing else touched.

**Removed**
- `src/components/ResumeBuilder.tsx` — the old textarea form, fully superseded, nothing else imported it.

**Not touched:** `resumes` RLS/policies/columns (no migration needed — `content` is jsonb), any ads/billing/settings code, `pdf_url` semantics, `get-recruiter-resume-url`.

---

## 5. Tested live (Chrome, `localhost:8080`, signed in as the account owner)

- List shows the 3 real rows; `{type:"upload"}` row → Edit disabled with an explanatory dialog; editable rows → Edit / PDF / Duplicate / Delete.
- Opening the legacy **"new"** row: `normalizeResume()` mapped `personalInfo`, `experience:"20 years"` (→ one entry), `education[]`, `projects[]`, `summary` — all rendered correctly in the preview.
- Stepper navigation (mobile horizontal scroll); no horizontal page overflow (`scrollWidth == clientWidth`).
- Experience: **Add position** (2nd entry, live card title from the role), date fields, "currently work here".
- **Suggestions** drawer opened for "Software Engineer" → engineering phrase bucket, `{n}`→`3` substitution, added 2 phrases → appeared as bullets in the editor **and** the live preview (with markers).
- **Design**: switched Aurora → Sidebar (two‑column tinted‑rail layout rendered), accent → teal (applied throughout), moved Skills above Experience (order changed in preview).
- **Template gallery**: "Two column" filter → only Sidebar; live thumbnails render.
- **New resume**: template pick → editor → **Import from profile** pulled the owner's real profile (name, headline, "27 Years continuously working." summary, "Sr. Manager · Viswanath Automobile Pvt Ltd", 2 education entries, 6 skill chips) → strength 88% → autosave created a row.
- **Export**: PDF → "Download started · *name*.pdf", no console errors from the jsPDF build; Plain‑text option present.
- **Delete**: confirm dialog → row removed, toast shown.
- `tsc --noEmit` = 0, `eslint --max-warnings 0` on the new/changed files = 0, `vite build` = success.

### Test‑data handling (disclosure)
- The **"new"** resume row (`b4d8edfd…`, a smoke‑test row: "ajit" / "bab hishor ssss" / "Socila") was opened in the editor during testing, so autosave re‑serialised its `content` into the v2 schema and I added then removed a scratch experience entry. **No data was lost** — every original field (basics, summary, 1 experience entry "Experience / 20 years", 1 education, 1 project) is intact and it renders identically; only the JSON shape changed (which any open of that row would do). Template/accent/order were reset to defaults. If you'd rather it keep its exact old JSON bytes, say so and I'll hand you the one‑line restore.
- The **"Test Build Resume"** row I created to exercise the create flow was **deleted** afterwards. The DB is back to the original 3 rows; the two untouched rows keep their old `updated_at`.

---

## 6. Known gaps / deliberate scope calls

1. **AI rewrite & AI summaries** — reference uses an LLM; the project has no AI backend and adding an API key wasn't in scope. Shipped a deterministic **Polish** + a curated **phrase/summary‑phrase library** instead, honestly labelled. Wiring a real LLM is a clean follow‑up (one edge function + a key).
2. **DOCX export** — needs a `.docx` library; PDF + TXT shipped, DOCX is a follow‑up.
3. **Resume file upload + parse** ("upload an existing resume") — not built; existing upload rows are handled read‑only.
4. **Drag‑to‑reorder** — sections and entries reorder via accessible ↑/↓ buttons (no DnD dependency in the project). A drag handle is shown; adding pointer‑drag is cosmetic follow‑up.
5. **Mobile deep‑flow automated test** — blocked by the browser harness (see §1). Layout was verified at ~375–549 px: stepper scroller, bottom‑sheet preview, sticky actions clear of the app nav, no overflow.
6. Pre‑existing, unrelated: a stale HMR error for `AdvertisingDataDetailPage`/`summarise` in the dev console (from the earlier Advertising work; clears on hard reload, not in the built output) and some `400`s from other dashboard widgets — none from resume code.
