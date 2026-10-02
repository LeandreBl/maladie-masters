# Handoff: Maladie Masters — player frontend

## Overview
Full visual design for `frontend/` of `LeandreBl/maladie-masters` (React 19 + Vite + Firebase). It covers every screen in `frontend/DESIGN_BRIEF.md`: Login, Packs (home + card-by-card reveal), Collection, Card detail modal, History, Leaderboard, Profile (with the Discord link section folded inside), plus the live notices stack. Light/dark theme and fr / en / zh are built in.

## About the design files
The files here are **design references written in HTML** (a prototype with fake data), not production code. Recreate them inside the existing `frontend/` app with its own patterns: keep `src/api/client.ts`, `src/api/types.ts`, `AuthProvider`, `I18nProvider` and `dictionaries.ts`, and replace the placeholder `styles.css` and the page/component markup. Open `Maladie Masters.dc.html` in a browser to see it running (it loads `support.js` and `MMCard.dc.html` next to it). The **Tweaks** panel (or the props at the bottom of the file) switches the start screen, theme, language, the best card in the next pack (cycle / random / legendary / epic / rare), forced shiny, flip duration, the Discord state (enabled / unlinked / code / linked) and a trigger for each live notice.

## Fidelity
**High fidelity.** Colors, type, spacing, radii and animation timings are final. Match them.

## Design tokens
Define them as CSS custom properties on `:root` and switch with `html[data-mm-theme="light"]`. Every component reads `var(--…)`, so changing the theme is one attribute.

| Token | Dark | Light |
|---|---|---|
| `--bg` | `oklch(0.165 0.005 20)` | `oklch(0.975 0.003 20)` |
| `--surface` | `oklch(0.205 0.006 20)` | `oklch(0.995 0.002 20)` |
| `--surface2` | `oklch(0.25 0.007 20)` | `oklch(0.945 0.004 20)` |
| `--line` | `oklch(0.31 0.008 20)` | `oklch(0.885 0.006 20)` |
| `--text` | `oklch(0.96 0.004 20)` | `oklch(0.2 0.01 20)` |
| `--muted` | `oklch(0.72 0.01 20)` | `oklch(0.47 0.012 20)` |
| `--accent` (crimson) | `oklch(0.62 0.2 22)` | `oklch(0.55 0.2 22)` |
| `--accent-deep` (hover / pack shading) | `oklch(0.5 0.18 22)` | `oklch(0.46 0.18 22)` |
| `--card-bg` | `oklch(0.225 0.006 20)` | `oklch(0.995 0.002 20)` |
| `--r-common` | `#a39b8f` | `#8a8378` |
| `--r-uncommon` | `#86a95f` | `#5f7d3f` |
| `--r-rare` | `#5f95d6` | `#3b6ea8` |
| `--r-epic` | `#b07ee0` | `#8a4fb8` |
| `--r-legendary` | `#e3a81a` | `#c48a00` |

The light-theme rarity colors are the ones already in `frontend/src/styles.css`. The dark ones are brightened versions.
Effect colors used by the reveal (JS, not themed): COMMON `#a39b8f`, UNCOMMON `#86a95f`, RARE `#5f95d6`, EPIC `#b07ee0`, LEGENDARY `#f0b429`. Shiny rainbow: `#ff7ab6 → #ffd36e → #7dffb0 → #7ab8ff`.

**Type**
- UI: `"Bricolage Grotesque", "Noto Sans SC", system-ui, sans-serif` (Google Fonts, weights 400/500/700/800). Noto Sans SC covers Chinese.
- Numbers, codes and timers: `"JetBrains Mono", ui-monospace, monospace` (400/500).
- Scale: page H1 44px/800/-0.03em/line-height 1. Login title clamp(52px, 7vw, 96px)/800/-0.035em/0.92. Wallet title 40px/800. Section H3 22px/800/-0.02em. Body 15–17px. Overline labels 13px/700, uppercase, letter-spacing 0.1em.

**Radii:** 999px (pills) · 10–12px (buttons, inputs) · 14–16px (CTA, tiles) · 18px (pack, rarity tiles) · 22–28px (panels) · card 0.9em.
**Shadows:** CTA `0 14px 34px -14px var(--accent)`. Legendary card `0 0 0 1px col, 0 20px 60px -16px col`. Epic card `0 18px 48px -18px col`. Other cards `0 10px 30px -18px rgba(0,0,0,.5)`.
**Layout:** content max-width 1240px (leaderboard 980px, profile 880px), padding 40px 32px 80px. Sticky header with blur, `color-mix(in oklch, var(--bg) 85%, transparent)` + `backdrop-filter: blur(12px)`.

## Card component (`MMCard.dc.html` → `CardTile`)
Everything is sized in `em` from one width prop: `font-size = width / 15`, aspect ratio 5:7.
- Frame: `--card-bg`, border 0.16em in the rarity color, radius 0.9em, padding 0.7em, gap 0.55em. Epic and Legendary get a second inner border (inset 0.3em, 1px, 55% opacity).
- Top row: `#0042` (mono 0.68em, muted, zero-padded to 4) on the left; on the right a diamond (0.6em square rotated 45°) in the rarity color.
- Art: 4:3, radius 0.55em, 1px `--line`. **Default visual when `imageUrl` is null (about 40% of cards):** diagonal stripes `repeating-linear-gradient(135deg, color-mix(in oklch, <rarity> 18%, transparent) 0 .4em, transparent .4em .8em)`. In the prototype that box also holds the "Wikimedia thumbnail" placeholder text. With a real image, use `object-fit: cover`.
- Badges inside the art: **NEW** top-left (accent background, white, 0.55em/800). **SHINY** top-right (rainbow gradient, dark ink). **×N** bottom-right when quantity > 1 (mono, `--text` background).
- Name: 1.12em/700/line-height 1.08, `text-wrap: balance`, clamped to 3 lines (handles "Encéphalomyélite myalgique/syndrome de fatigue chronique"). When `card.lang !== locale`, a small mono pill follows the name (`EN`, 0.45em, 1px `--line` border). This is the "shown in another language" indicator from the brief.
- Description: 0.7em, muted, clamped to 3 lines.
- Footer (border-top 1px `--line`): rarity label (0.62em/800, uppercase, letter-spacing 0.12em, rarity color) and pageviews (`Intl.NumberFormat(locale, {notation:'compact'})` + "vues / views / 次浏览").
- **Not owned (`quantity === 0`):** 55% opacity, name `???`, no description, views or badges, and a large "?" (2.6em/800) in the rarity color over the stripes.
- **Legendary holo:** an overlay `linear-gradient(115deg, transparent 25%, rgba(255,255,255,.3) 42%, rgba(255,214,120,.24) 50%, rgba(160,200,255,.2) 58%, transparent 75%)`, `background-size: 260% 100%`, animated by `@keyframes mmHolo { from {background-position:130% 0} to {background-position:-130% 0} }` over 2.8s, linear, infinite.
- **Shiny** (`isShiny` / `shinyQuantity > 0`), following the brief:
  - **Inverted art:** an overlay on the art box with `backdrop-filter: invert(1) hue-rotate(180deg)`. With a real `<img>`, put `filter: invert(1) hue-rotate(180deg)` on the image itself.
  - **Iridescent frame:** an absolute layer at inset 0 with radius 0.75em and padding 0.22em. Its background is `linear-gradient(120deg, #ff5fa2, #ffcf5c, #5cffa0, #5cb8ff, #c45cff, #ff5fa2)` at `background-size: 300%`, animated with `mmHolo` over 3s, linear, infinite. The mask keeps only the border: `mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0); mask-composite: exclude`.
  - **Tint:** a rainbow overlay with `mix-blend-mode: color` at 18% opacity, `mmHolo` over 4s.
  - **Badge:** `✦ SHINY` top-right (rainbow gradient, dark ink `#1a1215`).

## Screens

### Header (all signed-in screens)
From left to right, flex with wrap and gap 28px:
- Logo: a 14px crimson diamond plus "Maladie Masters" (18px/800).
- Nav: Paquets / Collection / Historique / Classement. These are buttons, 8×14 padding, radius 10px, 15px/700. The active one uses `--surface2` with `--text`; the others are muted.
- Right group, gap 10px:
  - Pack chip: `--surface2` pill with a crimson 16×22 rectangle, the `available` count (800) and the mono countdown `m:ss`.
  - Language segmented control (FR / EN / 中文): a pill on `--surface2`; the active segment is inverted (`--text` background, `--bg` text).
  - Theme toggle: 34px circle with a half-filled circle glyph.
  - Avatar initial (34px): opens Profile, with an accent ring when Profile is active.
  - "Déconnexion" text button.

### Login
- Top bar: logo on the left; language control and theme toggle on the right.
- Two columns, `repeat(auto-fit, minmax(min(100%, 440px), 1fr))`, gap 48px, max-width 1280px.
- Left column: big title `appName`, `tagline` (21px, muted), and the Google button (accent, 16×26 padding, radius 14px, 17px/700, with a white 22px circle holding a "G"). Below it, a row of 5 rarity chips (diamond + label).
- Right column, 500px tall: three fanned cards. Epic on the left (240px, rotated -12°, x -170px). Rare on the right (240px, rotated 12°, x +170px). Legendary in front (290px, holo, floating with `translate 0 → -10px`, 5s ease-in-out, infinite).

### Packs (home)
- Hero grid, 2 columns (`minmax(min(100%,420px),1fr)`), gap 32px.
  - **Pack panel:** `--surface`, radius 28px, min-height 460px, with a soft radial accent glow behind. The pack button is 230×340 with radius 18px, crimson.
    - Top crimp: 34px of vertical stripes in `--accent-deep`, then a dashed white rule.
    - Body: subtle 45° stripes, an "MM" seal (86px circle, 3px white border) and `appName`.
    - Bottom band: 22px.
    - Behind it, 1 or 2 ghost packs offset +11/+22px and rotated 3°/6° when `available` > 1 or > 2.
    - Hover lifts it 6px and rotates it -1°. With no pack it drops to 35% opacity and is disabled.
  - **Wallet panel:** padding 36px, gap 26px.
    - `packs.available(n)` (40px/800), then `packs.timer(natural, max)` + `packs.bonus(bonus)`.
    - 10 pips (`grid repeat(10, 1fr)`, 28px tall, radius 6px), filled with accent for each `natural`.
    - A `--surface2` box with `packs.nextIn` and a 30px mono countdown, plus a 6px progress bar of the elapsed interval. When `nextPackAt === null` it shows `packs.full(intervalMinutes)` instead.
    - Full-width CTA (20px padding, 19px/800): `packs.open`, or `packs.openAnother` once a pack has been opened this session. Disabled at 40% opacity when `available === 0`.
- **Last pack** (after at least one opening): H3 "Dernier paquet" and the 5 cards at 176px, clickable to open the modal.
- **Progress:** H3 `packs.progress` with `packs.summary(...)` aligned right, then 5 tiles (`auto-fit minmax(200px,1fr)`). Each tile has a diamond with the rarity label, mono `owned / total`, and a 6px bar in the rarity color (minimum width 1.5%).

### Pack reveal (fixed full-screen overlay, the key moment)
- The backdrop is always dark, whatever the theme: `rgba(10,8,10,.94)` with `blur(8px)` and text `#f4f0f1`.
- Top bar: logo on the left; "Tout révéler" link (underlined, 70% opacity) on the right.
- Stage row (wrap, gap 56px):
  - **Card slot** 330×462 with `perspective: 1400px`. Before the first flip it shows a dashed outline.
  - **Stack** 180×252: one card back per remaining card, offset `translate(i*3px, -i*3px) rotate((i-2)*0.8deg)`. Card back: 45° stripes in `--accent` / `--accent-deep`, a 2px white border at 22%, and an "MM" seal (62px).
  - Under the stack: `packs.tapToReveal · packs.remaining(n)`.
- Below: one 12px dot per card, filled with the card's rarity color once revealed.
- Effect layers, all `pointer-events: none`:
  - `dim`: black, over the whole overlay.
  - `rays`: 1500px circle, `repeating-conic-gradient(<hex>55 0 5deg, transparent 5deg 15deg)`, radially masked.
  - `glow`: a radial gradient behind the card.
  - `ring1` and `ring2`: 300px circles, 3px border, with a matching box-shadow glow.
  - `fx`: a zero-size div at the card's center that holds the particles.
  - `stamp`: the rarity name, 64px above the card, 30px/800, letter-spacing 0.22em.
  - `flash`: white, fixed over the whole screen.
- **Input:** tap the stack, or press Space / Enter. The order stays most common → rarest (sort by `RARITIES_DESC`, as `PackReveal.tsx` already does). The open button and progress counters stay hidden or stale until the summary (call `refresh()` only on done).

### Animation spec
Use the Web Animations API (`el.animate`), driven by refs. Let S = 300ms, the base flip duration.

| Step | Common / Uncommon | Rare | Epic | Legendary |
|---|---|---|---|---|
| Tear (open button → overlay) | pack wobbles ±4°, scales to 1.25 and fades, 380ms ease-in; the stack then drops in from -120px, 340ms `cubic-bezier(.2,.9,.25,1.15)` | same | same | same |
| Charge (before the flip; input locked) | none | none | 560ms: stack shakes, amplitude ramping 0→5px with up to 6% scale; stack glow (radial, rarity color) goes 0→0.8 and grows to 1.35×; dim 0→0.5 | 1150ms: shake amplitude up to 9px; glow to 1; dim 0→0.85; rays fade to 0.35 at 0.9× scale while rotating 40°; 10 sparks drift up-left from the stack |
| Flip | from `translateX(300px) rotateY(-90deg) scale(.55)` to none, S, `cubic-bezier(.2,.8,.2,1)` | 1.15·S | 1.5·S, overshoot keyframe at 60%: `rotateY(12deg) scale(1.18)` | 1.9·S, same overshoot |
| Glow behind card | none | pulses 0→1→0.5 | same (alpha 77) | same (alpha aa), settles at 0.8 |
| Shockwave rings | none | 1 ring to 2×, 700ms | 1 ring to 3.2×, 700ms, delayed 0.45·dur | ring to 4.5× (900ms), then a white ring to 3.2× (1100ms, delay 0.55·dur) |
| Particles | none | 8, spread 220px | 22, spread 360px | 46 at 520px, then 26 pale-gold `#ffe08a` at 420px (delay 0.5·dur). Size 3–10px, 1 in 4 white, 700–1300ms `cubic-bezier(.1,.75,.3,1)` |
| Flash | none | none | white 0.55→0 over 320ms | white 0.95→0 over 520ms |
| Stamp | none | none | the rarity name scales 1.8→1 and letter-spacing goes 0.6em→0.22em, 420ms, delay 0.5·dur, glowing in the rarity color | same |
| Afterglow | none | none | dim eases to 0.35 | dim to 0.35; rays keep spinning (360° every 16s) for as long as the card is shown; card holo on |

- **Shiny** (`isShiny`, any rarity, 1 in 10,000) is the **biggest moment, above Legendary** (per the brief). It runs the full Legendary sequence, plus:
  - **Charge:** 1550ms. Shake amplitude goes up to 11px. The stack glow becomes a spinning rainbow conic gradient (`#ff7ab6, #ffd36e, #7dffb0, #7ab8ff, #c47aff`) with `blur(30px)`, one turn every 1.2s. The rays alternate pink, blue and gold. 22 white sparks.
  - **Flip:** 2.2·S. Four bursts of 12 particles in the rainbow colors, staggered 60ms. An extra blue ring to 5.5× (1100ms). A second, pink flash `#ffd6ec` 280ms after the first.
  - **Stamp:** `✦ card.shinyDrawn ✦` in white with `0 0 18px #ff7ab6, 0 0 36px #7ab8ff`.
  - **Timing:** the summary opens on its own after 3.0s.
- **After the last card:** the summary opens on its own after 1.1s (2.0s for Epic, 2.6s for Legendary). "Tout révéler" skips there immediately and cancels any running effects.
- **Summary:** `packs.newCount(new, 5)` (clamp 28–44px/800), plus a rainbow `packs.shinyCount(n)` pill if any card is shiny. The 5 cards at 200px stagger in (`translateY(40px) scale(.9)` → none, 320ms, 60ms apart). Buttons: `packs.openAnother` (accent, shown only if `available > 0`, starts the next pack directly without the tear) and `close`.
- Respect `prefers-reduced-motion`: skip charge, particles, rays and flash; keep a 150ms fade.

### Card detail modal (`CardModal`)
- Backdrop `rgba(0,0,0,.6)` with blur(6px); click outside or press Esc to close.
- Panel: max-width 880px, radius 26px, padding 32px, `--surface`. Two columns: `repeat(auto-fit, minmax(min(100%,280px),1fr))`, gap 36px. Enters with `translateY(12px) scale(.97)` → none over 200ms.
- Left: the card at 300px (`???` style when not owned).
- Right column, top to bottom:
  - mono `#0042` and a rarity pill (outlined in the rarity color, uppercase).
  - H2 name (36px/800).
  - Description (18px, italic, muted).
  - `card.shownIn(languageName)` in a `--surface2` note when `lang !== locale`.
  - `card.notOwned` (bold) when quantity is 0.
  - `card.owned(qty, owners, rank)`.
  - `card.shinyOwned(n)` when `shinyQuantity > 0`.
  - `CIM-10 : <codes>` (codes in mono).
  - `card.readOnWikipedia` link (accent, 700) on the left and a `close` button on the right.
- Show `extract` under the description when owned. The prototype has no extract data.

### Collection (`GET /v1/me/collection`)
- H1 with `packs.summary(...)` on the right.
- **Rarity filter tiles** (`auto-fit minmax(150px,1fr)`): "Toutes les raretés", then the 5 rarities. Each tile shows a diamond + label, mono `owned / total` and a 4px bar. The active tile uses `--surface2` with a border in the rarity color. Clicking sets the `rarity` query param.
- **Toolbar** (`--surface` panel, radius 18px):
  - Owned segmented control: owned / missing / all / shiny (matches the API `owned` filter). The active segment is raised on `--surface` with a small shadow.
  - Search input (flex 1, focus border accent, debounced 250ms as today).
  - Sort `<select>`: number / name / rarity / popularity / recent.
  - Mono `collection.count(total)`.
- Grid: `repeat(auto-fill, 176px)`, `justify-content: space-between`, gap 22px 16px, page size 48. Cards lift 6px on hover and open the modal.
- Pager: 42px ← / → buttons (35% opacity when disabled) with mono `page / pages`.

### History (`GET /v1/me/packs/history`, pageSize 10)
- One row per opening: a `--surface` card with radius 22px and padding 20px, flex-wrap.
  - Left, 200px wide: the date (`Intl.DateTimeFormat(locale, {dateStyle:'medium', timeStyle:'short'})`); a source pill ("Minuterie" muted for NATURAL, "Bonus" in accent for BONUS); `packs.newCount(...)`.
  - Right: the 5 cards at 128px, scrolling horizontally on narrow screens, clickable.
- Add the same pager as Collection when `total > pageSize`.

### Leaderboard (`GET /v1/leaderboard?limit=50`)
- H1 with `leaderboard.scoring` (muted).
- **Podium** (`auto-fit minmax(220px,1fr)`): one tile each for ranks 1–3.
  - Tile: radius 24px, padding 24px. The border uses the legendary color for #1, epic for #2 and rare for #3; #1 also gets a gold drop shadow.
  - Content: the rank (54px/800 in that color), a 52px initial avatar (`photoUrl` when present), the name (20px/800) and mono `leaderboard.entry(score, uniqueOwned)`.
- **Table** for rank 4 onward: rows on a `48px 38px 1fr auto` grid with padding 13×22, separated by 1px `--line`. Each row: mono rank, 36px avatar, name with ellipsis, mono entry.
- The current player's row is tinted `color-mix(in oklch, var(--accent) 12%, transparent)` and labelled "Name (toi)". A null `displayName` shows `leaderboard.anonymous`.

### Profile (`PATCH /v1/me`) — also the account settings
Sections are `--surface` cards with radius 24px and padding 28px. Section labels are 13px/700, uppercase, muted.
1. Identity: an 88px accent avatar with a white initial, a `displayName` input (max 40) with a Save button (it switches to "Enregistré" until the next edit), and the email in muted text.
2. Language: three option buttons showing `languageName` and the code (2px border, accent when active). This calls `setLocale`, which already PATCHes `locale` and refreshes. The interface and the card language both follow it.
3. Theme: Light / Dark buttons, each with a mini swatch. Store it in `localStorage` (`mm-theme`). Default to `prefers-color-scheme`. Apply it via `document.documentElement.dataset.mmTheme`.
4. **Discord** (`GET/PATCH/DELETE /v1/me/discord`, `POST /v1/me/discord/link-code`). This section replaces the scaffold's separate `/discord` route and nav link: remove both and redirect `/discord` to the profile.
   **Folded by default.** The header is a full-width `<button aria-expanded>` (padding 20×28, hover `--surface2`) containing:
   - the 44px bot icon (radius 14px);
   - the "DISCORD" overline;
   - a status line with a 9px dot and the text, ellipsized on one line;
   - a 32px chevron tile that rotates 180° when open.

   | State | Dot | Status text |
   |---|---|---|
   | linked | `--r-uncommon` | `discord.linkedAs(username)` |
   | code pending | `--r-legendary` | `discord.notLinked` |
   | not linked | `--muted` | `discord.notLinked` |
   | `enabled === false` | `--line` | `discord.disabled` |

   Clicking toggles the panel, which fades in from `translateY(-6px)` over 180ms. Open contents (padding 0 28px 28px, gap 18px):
   - `discord.intro` (muted).
   - **Account panel** (`--bg`, radius 18px, padding 20px):
     - **Linked:**
       - Avatar (52px) with a green status dot, then `discord.linkedAs(username)` (18px/700) and a ghost `discord.unlink` button (DELETE).
       - Below, a full-width switch row (`role="switch"`) with `discord.announce` (PATCH `{announce}`). Track 46×28: accent when on, `--line` when off. Knob 22px, slides over 180ms.
     - **Not linked:**
       - `discord.notLinked` (18px/700).
       - When there is a code: `discord.codeHelp`, then a code block (`--surface`, radius 16px). In it, `/maladie link code:` in muted mono 20px followed by the code in accent, and a `Copier` button that writes the full command to the clipboard and shows `Copié` for 1.5s.
       - Under the block, a pulsing accent dot (WAAPI, scale 1 → 1.8, 1.4s, infinite) and `discord.expiresAt(time)`.
       - Then the accent CTA: `discord.getCode`, or `discord.newCode` when a code exists (POST link-code). Keep the scaffold's 5s polling while a code is pending.
   - **Announcement preview** (overline "Aperçu d'une annonce"):
     - The 42px bot avatar, `appName`, an accent `BOT` tag and the time in mono.
     - The bot's announce line from `backend/src/discord/discord-messages.ts`, with `**…**` rendered bold and the mention as an accent pill (`color-mix(accent 16%)`).
     - A 132px holo Legendary card.
   - **Add the bot to a server:** H3 `discord.serverTitle` (18px), `discord.serverHelp` (muted), then an inverted button (`--text` background, `--bg` text) with a 22px bot icon and `discord.invite`, linking to `inviteUrl`.
   - **Command list** below it: rows on a `minmax(0,240px) 1fr` grid, mono command plus muted description. The descriptions are the localized `description_localizations` from `backend/src/discord/discord-commands.ts` (fr / en / zh-CN):
     - `/maladie link code:`
     - `/maladie unlink`
     - `/maladie-setup channel`
     - `/maladie-setup off`
     - `/maladie-setup list`
5. Stat tiles (`auto-fit minmax(170px,1fr)`): distinct cards (`uniqueOwned`), copies (`totalCopies`), shiny (`shinyOwned`), score, member since (`createdAt`).
6. Sign-out button.

### Live notices (`Notices.tsx`)
The visual skin for the existing realtime component; its logic stays as is.
- **Stack:** fixed at top 72px, right 20px, width `min(360px, 100vw - 40px)`, gap 10px, z-index 70, `role="status" aria-live="polite"`.
- **Each notice:**
  - `--surface` background, 1px `--line` border, radius 16px, padding 14×14×16×16, shadow `0 18px 40px -18px rgba(0,0,0,.55)`.
  - `text` in 15px/700; the optional `detail` (the admin note) in muted 13px.
  - A 28px `×` close button on `--surface2`.
  - A 3px accent bar along the bottom that shrinks `scaleX(1 → 0)` linearly over 10s, the same TTL as `NOTICE_TTL_MS`.
- **Motion:** enters from `translateX(60px) scale(.96)` over 260ms with `cubic-bezier(.2,.9,.25,1.1)`. Leaves to `translateX(40px)` with opacity 0 over 180ms, before it is removed from state.
- **Copy:** `notices.packsGranted`, `notices.packsRefilled` and `notices.cardGranted`, verbatim (emoji included).

## Interactions & states
- The countdown uses the existing `Countdown` with the `serverTime` offset. At 0, call `refresh()`.
- `NO_PACK_AVAILABLE` (409): keep the countdown and the disabled CTA, and show `errors.*` in accent under the wallet.
- Other states:
  - Loading: skeleton cards (striped art at 50% opacity) and the `loading` copy.
  - `EMPTY_CATALOG`, `ACCOUNT_SUSPENDED`, `EMAIL_NOT_VERIFIED`: centered message on `--bg` with a sign-out button.
- Hover: cards translateY(-6px) over 150ms; accent buttons go to `--accent-deep`; muted nav goes to `--text`.
- Keyboard: Space / Enter flips; Esc closes the modal; the stack is a `<button>` labelled with `packs.tapToReveal`.
- Set `lang={card.lang}` on card names (already done in the scaffold).

## i18n: keys to add to `dictionaries.ts`
All other copy is already in `dictionaries.ts` and is used verbatim. These keys are new (fr / en / zh):
- `nav.history`: Historique / History / 历史
- `nav.profile`: Profil / Profile / 个人资料
- `card.views`: vues / views / 次浏览
- `packs.last`: Dernier paquet / Last pack / 上一个卡包
- `collection.sortBy`: Trier / Sort / 排序
- `collection.sorts`:
  - fr: Numéro, Nom, Rareté, Popularité, Récentes
  - en: Number, Name, Rarity, Popularity, Recent
  - zh: 编号, 名称, 稀有度, 热度, 最近
- `history.source.NATURAL`: Minuterie / Timer / 计时器
- `history.source.BONUS`: Bonus / Bonus / 奖励
- `profile.displayName`: Pseudo / Display name / 昵称
- `profile.save`: Enregistrer / Save / 保存
- `profile.saved`: Enregistré / Saved / 已保存
- `profile.theme`: Thème / Theme / 主题
- `profile.light`: Clair / Light / 浅色
- `profile.dark`: Sombre / Dark / 深色
- `profile.distinct`: Cartes distinctes / Distinct cards / 不同卡牌
- `profile.copies`: Exemplaires / Copies / 张数
- `profile.shiny`: Shiny / Shiny / 闪卡
- `profile.score`: Score / Score / 积分
- `profile.memberSince`: Membre depuis / Member since / 注册于
- `leaderboard.you`: toi / you / 你
- `profile.copy`: Copier / Copy / 复制
- `profile.copied`: Copié / Copied / 已复制
- `discord.preview`: Aperçu d'une annonce / Announcement preview / 公布预览
- `card.thumbFallback` (only if you want a label on the image fallback): vignette Wikimedia / Wikimedia thumbnail / 维基共享资源缩略图

## State (per screen)
- **Packs:** `opening: PackOpening | null`; `phase: 'idle' | 'reveal' | 'summary'`; `revealed: number`; a `locked` flag while charging; refs for every effect layer. Charge and flip are imperative calls on refs, so React re-renders never restart animations.
- **Collection:** `owned`, `rarity`, `search`, `sort`, `page`. Re-fetch when `me.locale` changes, as today.
- **Profile:** `discordOpen: boolean`, false on every visit. Plus the scaffold's `status`, `code` and `error` from `DiscordPage.tsx`.
- **Theme:** context + localStorage. **Locale:** the existing `I18nProvider`.

## Assets
- `assets/discord/bot-icon.png` (from the repo's `assets/discord/`): bot avatar in the Discord section, the preview message and the invite button.
- No other images are bundled. Card art is `card.imageUrl` (Wikimedia), with the striped fallback above.
- Fonts come from Google Fonts: Bricolage Grotesque, JetBrains Mono, Noto Sans SC.
- No icon set is used. The diamond, pack and seal are plain CSS shapes.

## Files
- `Maladie Masters.dc.html`: all screens, the reveal choreography (see the `charge`, `doFlip`, `burst`, `ring` and `toSummary` methods) and the copy.
- `MMCard.dc.html`: the card component.
- `support.js`: runtime needed to open the prototype locally (not for production).
