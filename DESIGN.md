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

<!-- impeccable:design-map -->
Name: Atelier Agenda (Provisional)
Colors: primary: royal-cobalt #1d4ed8; secondary: status-success #16a34a; neutral: cool-canvas #f8fafc; primary: editorial-ink #0d0d0f; secondary: status-warning #b45309 (+4 more in the sidecar)
Fonts: Poppins (display, headline, title, body, label); Geist Mono (mono-data)
Spacing: xs 4px, sm 8px, md 12px, lg 16px, xl 20px, 2xl 24px, 3xl 32px
Radius: sm 7.2px, md 9.6px, lg 12px, xl 16.8px, 2xl 21.6px, full 9999px
North Star: "The Calm Control Desk"
Rules:
- The Palette-Respect Rule. Dashboard components must always consume semantic tokens (`--accent-primary`, `--surface-elevated`, `--ink-primary`, `--border-subtle`) rather than hardcoded palette hex values, so all 11 user palettes and Light/Dark modes stay consistent everywhere.
- The Icon-Plus-Color Rule. Status colors never carry meaning alone; every `StatusBadge` and agenda status indicator pairs its semantic tint with an explicit icon and text label.
- The Uncluttered Accent Rule. Accent colors mark primary actions, active indicators, and key focus states—never full-bleed saturated card backgrounds or decorative gradients.
- (+4 more)
Elevation:
- Subtle Card Lift: 0 1px 3px 0 rgb(15 23 42 / 0.06), 0 1px 2px -1px rgb(15 23 42 / 0.04)
- Interactive Hover Lift: 0 12px 28px -12px rgb(15 23 42 / 0.16)
- Elevated Popover: 0 20px 25px -5px rgb(15 23 42 / 0.10), 0 8px 10px -6px rgb(15 23 42 / 0.08)
- Overlay Drawer / Modal: 0 25px 50px -12px rgb(15 23 42 / 0.25)
Don't:
- Don't use exaggerated drop shadows, decorative background gradients, or heavily saturated full-card fills inside operational dashboards.
- Don't hardcode a single palette hex (e.g., `#1d4ed8` or `#00a8c6`) on themed dashboard controls where `--accent-primary` belongs.
- Don't overload financial or scheduling views with unnecessary widgets, chrome, or visual noise that competes with core numbers and actions.
- Don't leak dashboard dark-mode or palette styling onto the fixed monochrome editorial landing and auth pages (`/` , `/login`, `/register`).
- Don't convey appointment or financial status by color alone without an accompanying icon or label.
Full: .impeccable/design-full.md (read a section when you need its detail)
