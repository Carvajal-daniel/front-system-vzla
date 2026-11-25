---
name: "Atelier Agenda (Provisional)"
description: "Calm, high-clarity operational SaaS design system for barbershops and beauty salons across Brazil and Venezuela."
colors:
  royal-cobalt: "#1d4ed8"
  royal-cobalt-hover: "#1e40af"
  royal-cobalt-soft: "#dbeafe"
  royal-cobalt-dark: "#60a5fa"
  editorial-ink: "#0d0d0f"
  editorial-ink-hover: "#27272a"
  cool-canvas: "#f8fafc"
  pure-surface: "#ffffff"
  slate-subtle: "#f1f5f9"
  navy-rail: "#162036"
  navy-rail-hover: "#1e2b44"
  hairline-slate: "#cbd5e1"
  strong-slate: "#94a3b8"
  ink-primary: "#0f172a"
  ink-secondary: "#334155"
  ink-muted: "#64748b"
  dark-canvas: "#09090b"
  dark-surface: "#111114"
  dark-subtle: "#1c1c21"
  dark-border: "#27272a"
  dark-ink: "#fafafa"
  status-success: "#16a34a"
  status-success-bg: "#ecfdf5"
  status-success-ink: "#065f46"
  status-warning: "#b45309"
  status-warning-bg: "#fffbeb"
  status-warning-ink: "#92400e"
  status-danger: "#dc2626"
  status-danger-bg: "#fef2f2"
  status-danger-ink: "#991b1b"
typography:
  display:
    fontFamily: "Poppins, ui-sans-serif, system-ui, sans-serif"
    fontSize: "clamp(2.25rem, 1.55rem + 3vw, 4.25rem)"
    fontWeight: 600
    lineHeight: 1.02
    letterSpacing: "-0.02em"
  headline:
    fontFamily: "Poppins, ui-sans-serif, system-ui, sans-serif"
    fontSize: "clamp(1.75rem, 1.35rem + 1.5vw, 2.75rem)"
    fontWeight: 600
    lineHeight: 1.08
    letterSpacing: "-0.015em"
  title:
    fontFamily: "Poppins, ui-sans-serif, system-ui, sans-serif"
    fontSize: "clamp(1.0625rem, 0.98rem + 0.35vw, 1.25rem)"
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: "-0.015em"
  body:
    fontFamily: "Poppins, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "0em"
  label:
    fontFamily: "Poppins, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 600
    lineHeight: 1.33
    letterSpacing: "0.02em"
  mono-data:
    fontFamily: "Geist Mono, ui-monospace, monospace"
    fontSize: "0.75rem"
    fontWeight: 500
    lineHeight: 1.33
    letterSpacing: "0em"
    fontFeature: "tnum"
rounded:
  sm: "7.2px"
  md: "9.6px"
  lg: "12px"
  xl: "16.8px"
  2xl: "21.6px"
  full: "9999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "20px"
  2xl: "24px"
  3xl: "32px"
components:
  button-primary:
    backgroundColor: "{colors.royal-cobalt}"
    textColor: "{colors.pure-surface}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    padding: "6px 12px"
    height: "32px"
  button-primary-hover:
    backgroundColor: "{colors.royal-cobalt-hover}"
    textColor: "{colors.pure-surface}"
  button-outline:
    backgroundColor: "{colors.cool-canvas}"
    textColor: "{colors.ink-primary}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    padding: "6px 12px"
    height: "32px"
  button-secondary:
    backgroundColor: "{colors.slate-subtle}"
    textColor: "{colors.ink-primary}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    padding: "6px 12px"
    height: "32px"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.ink-primary}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    padding: "6px 10px"
    height: "32px"
  button-destructive:
    backgroundColor: "{colors.status-danger-bg}"
    textColor: "{colors.status-danger}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    padding: "6px 12px"
    height: "32px"
  button-editorial-pill:
    backgroundColor: "{colors.editorial-ink}"
    textColor: "{colors.pure-surface}"
    typography: "{typography.body}"
    rounded: "{rounded.full}"
    padding: "12px 28px"
    height: "48px"
  card-surface:
    backgroundColor: "{colors.pure-surface}"
    textColor: "{colors.ink-primary}"
    rounded: "{rounded.lg}"
    padding: "16px"
  input-field:
    backgroundColor: "transparent"
    textColor: "{colors.ink-primary}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    padding: "4px 10px"
    height: "32px"
  badge-status:
    backgroundColor: "{colors.status-success-bg}"
    textColor: "{colors.status-success-ink}"
    typography: "{typography.label}"
    rounded: "{rounded.full}"
    padding: "2px 10px"
---

# Design System: Atelier Agenda (Provisional)

## Overview

**Creative North Star: "The Calm Control Desk"**

This design system powers a unified SaaS platform for barbershops and beauty salons across Brazil and Venezuela, balancing two distinct yet cohesive registers. Public and authentication surfaces use a crisp monochrome editorial voice that communicates immediate clarity and trust, while operational dashboards (`/owner/*` and `/collaborator/*`) act as a calm, ultra-legible control desk where scheduling, finances, comandas, commissions, and inventory coexist without visual noise.

Precision and serenity govern every control. Buttons feel compact and grounded, cards rest cleanly against a cool neutral canvas with restrained hairline borders, and form inputs stay sharp and unadorned so numerical data, appointment times, and operational statuses remain the focal point. Elevation is subtle and selective—flat surfaces form the base while soft shadows lift financial cards, KPI summaries, and active operational blocks to establish clear visual hierarchy.

Decorative gradients, heavy drop shadows, oversaturated cards, and unnecessary chrome are explicitly rejected. Every surface maintains strict consistency across Light and Dark modes and honors all eleven user-selectable dashboard accent palettes without sacrificing WCAG 2.2 AA contrast.

**Key Characteristics:**
- **Calm, uncluttered operational density:** High-information financial and scheduling screens remain scannable and fast rather than overloaded.
- **Dual-register coherence:** Fixed monochrome editorial identity on landing and auth; customizable Light/Dark + 11-palette system inside dashboards.
- **Subtle, selective elevation:** Flat tonal canvas paired with soft shadows only on financial KPIs, key operational blocks, hover states, and overlays.
- **Precision tabular data:** Monospace `tabular-nums` alignment for all hours, prices, durations, and commissions.
- **Accessible by construction:** WCAG 2.2 AA contrast, icons paired with every status color, 44px mobile touch targets, and strict `prefers-reduced-motion` compliance.

## Colors

A cool-neutral architectural canvas anchored by high-contrast slate inks, paired with a customizable primary accent layer for dashboards and semantic status tokens that never rely on color alone.

### Primary
- **Royal Cobalt** (`royal-cobalt` / `royal-cobalt-dark`): Default dashboard primary accent used for primary actions, active focus rings, selected states, and key operational highlights. Shifts to a lighter sky-blue tone in Dark mode to preserve AA contrast on dark surfaces.
- **Editorial Ink** (`editorial-ink` / `editorial-ink-hover`): Primary action and brand anchor on public landing and authentication surfaces, delivering stark monochrome contrast against white backgrounds.

### Secondary
- **Multi-Palette Dashboard Accent System:** Inside `/owner/*` and `/collaborator/*`, `data-palette` dynamically swaps `--accent-primary`, `--accent-primary-hover`, `--accent-soft`, and `--accent-ink` across 11 curated palettes (`royal`, `ruby`, `emerald`, `violet`, `matte`, `cyan`, `gold`, `terracotta`, `teal`, `indigo`, `graphite`), each calibrated for both Light and Dark modes.
- **Semantic Status & Agenda Tokens:**
  - **Success / Confirmed** (`status-success`, `status-success-bg`, `status-success-ink`): Confirmed and completed appointments, positive financial confirmations, and active states.
  - **Warning / Pending** (`status-warning`, `status-warning-bg`, `status-warning-ink`): Pending appointments, expiring items, and operational cautions.
  - **Danger / Canceled** (`status-danger`, `status-danger-bg`, `status-danger-ink`): Canceled appointments, no-shows, destructive actions, and validation errors.
  - **Agenda Event Mix:** Calendar events blend their status accent at 17% (light) or 20% (dark) over `--surface-elevated` with a solid left indicator border.

### Neutral
- **Cool Canvas** (`cool-canvas`): Primary Light-mode page background that gently separates elevated white cards from the workspace floor.
- **Pure Surface** (`pure-surface`): Card, modal, drawer, and popover background in Light mode.
- **Slate Subtle** (`slate-subtle`): Secondary button fills, muted table headers, hover backdrops, and soft neutral badges.
- **Navy Rail** (`navy-rail` / `navy-rail-hover`): Dedicated deep-navy owner sidebar surface providing calm structural framing and clear separation from the main operational canvas.
- **Hairline & Strong Slate** (`hairline-slate`, `strong-slate`): Structural card/section dividers and form input borders.
- **Ink Hierarchy** (`ink-primary`, `ink-secondary`, `ink-muted`): Primary headings/values, body/labels, and metadata/timestamps.
- **Dark Mode Neutrals** (`dark-canvas`, `dark-surface`, `dark-subtle`, `dark-border`, `dark-ink`): Deep charcoal-obsidian surfaces with crisp near-white text for low-glare dark-mode sessions.

### Named Rules
**The Palette-Respect Rule.** Dashboard components must always consume semantic tokens (`--accent-primary`, `--surface-elevated`, `--ink-primary`, `--border-subtle`) rather than hardcoded palette hex values, so all 11 user palettes and Light/Dark modes stay consistent everywhere.

**The Icon-Plus-Color Rule.** Status colors never carry meaning alone; every `StatusBadge` and agenda status indicator pairs its semantic tint with an explicit icon and text label.

**The Uncluttered Accent Rule.** Accent colors mark primary actions, active indicators, and key focus states—never full-bleed saturated card backgrounds or decorative gradients.

## Typography

**Display Font:** Poppins (with `ui-sans-serif, system-ui, sans-serif` fallback)
**Body Font:** Poppins (with `ui-sans-serif, system-ui, sans-serif` fallback)
**Label/Mono Font:** Geist Mono (with `ui-monospace, monospace` fallback)

**Character:** Geometric warmth meets operational clarity. `Poppins` gives headings and UI controls a clean, modern, approachable structure without feeling ornamental, while `Geist Mono` locks every timestamp, price, duration, and commission percentage into crisp vertical alignment.

### Hierarchy
- **Display** (`600`, `clamp(2.25rem, 1.55rem + 3vw, 4.25rem)`, `1.02` line-height, `-0.02em` tracking): Public hero headlines with balanced wrapping (`text-wrap: balance`).
- **Headline** (`600`, `clamp(1.75rem, 1.35rem + 1.5vw, 2.75rem)`, `1.08` line-height, `-0.015em` tracking): Section titles on public and onboarding surfaces.
- **Title** (`600`–`700`, `clamp(1.0625rem, 0.98rem + 0.35vw, 1.25rem)`, `1.3` line-height, `-0.015em` tracking): Dashboard page headers, drawer titles, and modal headings.
- **Body** (`400`–`500`, `14px`–`16px`, `1.5` line-height): Operational tables, form labels, descriptions, and list items.
- **Label** (`600`, `12px`, `1.33` line-height, `0.02em` tracking): Badges, table column headers, and compact action triggers.
- **Mono Data** (`500`–`600`, `12px`–`14px`, `1.33` line-height, `tabular-nums`): Appointment slots, currency values, durations, percentages, and international phone prefixes (`+55` / `+58`).

### Named Rules
**The Tabular Money & Time Rule.** Every time slot, currency amount, duration, commission rate, and KPI counter uses `Geist Mono` with `tabular-nums` so columns align effortlessly when scanning financial reports or daily agendas.

**The Balanced Heading Rule.** Fluid display and section titles apply `text-wrap: balance` to prevent awkward single-word orphans on narrow mobile screens (`320px`–`390px`).

## Layout

- **Public & Auth Surfaces:** Centered `max-w-6xl` (`1152px`) container with `16px` (`px-4`) mobile and `24px` (`sm:px-6`) desktop horizontal padding, sticky translucent header (`backdrop-blur-md`), and generous vertical rhythm.
- **Dashboard Shell (`/owner/*` & `/collaborator/*`):** Fixed collapsible left sidebar on desktop (`navy-rail` in Owner shell) paired with a clean topbar (quick create, global search `Ctrl+K`, privacy toggle, notifications, theme/palette customizer) and a bottom tab bar (≤ 5 primary items) on mobile.
- **Operational Flow:** KPI cards anchor the top of analytical and financial views, followed by scannable tables, agenda grids, or list views. Contextual creation, editing, and inspection open in a right-hand `SlideOverDrawer` (`max-w-md`, `448px`) so users never lose list context.
- **Spacing Rhythm:** Built on a `4px` base grid (`4px`, `8px`, `12px`, `16px`, `20px`, `24px`, `32px`), with `16px` default card padding (`12px` in compact `size="sm"` cards) and `20px` drawer padding.
- **Responsive & Mobile-First:** Designed cleanly from `320px` upward with `overflow-x: clip` at the document root, internal scroll containers for dense tables, and ≥ `44px` touch targets on mobile public booking and navigation controls.

## Elevation & Depth

Subtle and selective elevation. Flat surfaces form the calm baseline—cool-gray canvas (`#f8fafc` light / `#09090b` dark) with hairline borders (`1px`)—while soft, restrained shadows lift financial KPI cards, key operational blocks, interactive hover states, dropdown popovers, and slide-over overlays to clarify hierarchy without visual heaviness.

### Shadow Vocabulary
- **Subtle Card Lift** (`0 1px 3px 0 rgb(15 23 42 / 0.06), 0 1px 2px -1px rgb(15 23 42 / 0.04)`): Soft separation for financial summary cards, KPI indicators, and primary operational blocks.
- **Interactive Hover Lift** (`0 12px 28px -12px rgb(15 23 42 / 0.16)` with `translateY(-2px)`): Applied on `.card-interactive:hover` for clickable bento and KPI cards.
- **Elevated Popover** (`0 20px 25px -5px rgb(15 23 42 / 0.10), 0 8px 10px -6px rgb(15 23 42 / 0.08)`): Quick-create menus, selects, and floating popovers.
- **Overlay Drawer / Modal** (`0 25px 50px -12px rgb(15 23 42 / 0.25)` over `bg-ink/45 backdrop-blur-[2px]`): Slide-over drawers and confirmation dialogs.

### Named Rules
**The Selective Elevation Rule.** Use flat tonal borders for routine containers and reserve soft shadows for financial cards, KPI indicators, interactive hover lift, and floating overlays. Never stack heavy drop shadows or colored neon glows.

**The Quiet Motion Rule.** Dashboard transitions stay crisp and functional (`160ms` fast / `260ms` base with `cubic-bezier(0.23, 1, 0.32, 1)`), animating only `transform`, `opacity`, and subtle color shifts—and collapsing to `0.01ms` under `prefers-reduced-motion: reduce`.

## Shapes

A restrained, modern radius system derived from a `12px` (`0.75rem`) base (`--radius`):
- **Compact Controls (`8px`–`9.6px`):** Standard dashboard buttons, text inputs, and dropdown menu items use crisp rounded corners (`rounded-lg` / `--radius-md`).
- **Cards & Containers (`12px`–`16.8px`):** Operational cards, popovers, and quick-create triggers use smooth, friendly corners (`rounded-xl` / `--radius-lg`–`xl`).
- **Editorial Pills & Status Badges (`9999px`):** Full pill geometry is reserved for public landing CTAs, `StatusBadge` chips, and circular icon close buttons.
- **Agenda Accent Strip:** Appointment cards and calendar blocks use a solid `border-inline-start` status bar paired with a `container-type: inline-size` layout so compact labels hide gracefully in narrow calendar columns.

## Components

### Buttons
Compact, grounded, and unambiguous—firm click targets with subtle `1px` active press feedback and crisp focus rings.
- **Shape:** Gently rounded corners (`8px`–`9.6px`) in dashboards; full pill (`9999px`) on public landing CTAs.
- **Primary:** Solid accent fill (`--primary`) with high-contrast foreground (`--primary-foreground`), `32px` default height (`36px` large, `28px` small, `44px+` on mobile booking/public CTAs), `px-2.5`–`px-3` horizontal padding.
- **Hover / Focus:** Smooth `160ms` opacity/shade shift on hover; `2px`–`3px` visible focus ring using `--ring` (`:focus-visible`).
- **Secondary / Outline / Ghost / Destructive:** Outline uses `--border` on `--background`; secondary uses `--secondary` (`slate-subtle`); ghost stays transparent until hover; destructive uses a soft 10%–20% danger tint with `--destructive` text rather than harsh solid red blocks.

### Chips & Status Badges
Compact pill indicators designed for rapid scanning in agendas, client lists, and financial tables.
- **Style:** Full pill (`9999px`), `1px` semantic border, soft tinted background (`--status-*-bg`), high-contrast text (`--status-*-ink`), `2px 10px` padding, `12px` semibold text.
- **State:** Every `StatusBadge` renders a `14px` semantic icon (`CheckCircle2`, `Clock`, `XCircle`, `CircleDot`, `AlertCircle`) alongside its label so status is immediately readable without relying solely on color.

### Cards / Containers
Clean, crisp information containers that separate financial and operational blocks without visual clutter.
- **Corner Style:** Smoothly rounded (`12px` / `rounded-xl`).
- **Background:** `--card` (`#ffffff` light / `#111114` dark) over `--background` (`#f8fafc` light / `#09090b` dark).
- **Shadow Strategy:** `1px` hairline ring (`ring-foreground/10` or `--border-subtle`) at rest, with subtle card shadow on financial/KPI blocks and `translateY(-2px)` soft elevation on `.card-interactive:hover`.
- **Internal Padding:** `16px` (`--card-spacing`) default, `12px` for compact `size="sm"` cards, with muted footer band (`bg-muted/50 border-t`) when actions are anchored below.

### Inputs / Fields
Sharp, quiet form controls that keep focus on user data and validation clarity.
- **Style:** `1px` border (`--input` / `#94a3b8` light, `#3f3f46` dark), transparent light fill (`bg-input/30` in dark), `8px` radius, `32px` height (`h-8`), `16px` mobile / `14px` desktop text size to prevent iOS zoom.
- **Focus:** Border shifts to `--ring` with a `3px` translucent focus halo (`ring-ring/50`).
- **Error / Disabled:** `aria-invalid` applies `--destructive` border and soft red focus ring; disabled dims to 50% opacity with muted fill.

### Navigation
- **Owner Desktop Sidebar:** Deep navy container (`.owner-sidebar`, `#162036`) with crisp off-white active text (`#ffffff`), muted slate inactive links (`#cbd5e1`), subtle translucent hover (`rgba(255,255,255,0.08)`), a compact cyan active dot (`8px`), and collapsible rail state.
- **Mobile Navigation:** Compact bottom tab bar (≤ 5 primary items) with `44px+` touch targets plus drawer access to secondary modules.

### Slide-Over Drawer (Signature Component)
Right-anchored contextual panel (`max-w-md`, full `100dvh` height) over a `45%` ink backdrop with subtle `2px` blur. Slides in via `drawer-slide-in` (`260ms`, `cubic-bezier(0.23, 1, 0.32, 1)`), closes on `Escape` or backdrop click, and lets owners create/edit appointments, comandas, and services without losing sight of the underlying list.

### Agenda Event Card (Signature Component)
Status-driven appointment block using CSS `color-mix()` (`17%` light / `20%` dark accent over `--surface-elevated`), a solid left status border, and CSS container queries (`@container (max-width: 4.5rem)`) that gracefully hide secondary paid badges in narrow multi-column calendar slots.

## Do's and Don'ts

### Do:
- **Do** use CSS custom properties (`--surface-canvas`, `--surface-elevated`, `--accent-primary`, `--ink-primary`, `--border-subtle`) for every dashboard surface so Light/Dark mode and all 11 palettes work seamlessly.
- **Do** apply `Geist Mono` with `tabular-nums` to all times, prices, durations, commissions, and financial KPIs.
- **Do** pair every status color with an icon and text label (`StatusBadge` pattern) to preserve WCAG 2.2 AA accessibility.
- **Do** apply subtle, selective elevation on financial cards, KPI indicators, and key operational blocks while keeping routine containers flat on the neutral canvas.
- **Do** open contextual dashboard forms in `SlideOverDrawer` to preserve list context and keep screens calm.
- **Do** keep mobile touch targets at least `44px` and honor `prefers-reduced-motion` on all transitions.

### Don't:
- **Don't** use exaggerated drop shadows, decorative background gradients, or heavily saturated full-card fills inside operational dashboards.
- **Don't** hardcode a single palette hex (e.g., `#1d4ed8` or `#00a8c6`) on themed dashboard controls where `--accent-primary` belongs.
- **Don't** overload financial or scheduling views with unnecessary widgets, chrome, or visual noise that competes with core numbers and actions.
- **Don't** leak dashboard dark-mode or palette styling onto the fixed monochrome editorial landing and auth pages (`/` , `/login`, `/register`).
- **Don't** convey appointment or financial status by color alone without an accompanying icon or label.
