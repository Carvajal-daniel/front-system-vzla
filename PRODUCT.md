# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Barbershop and beauty salon owners (`OWNER`):** Run daily operations, team management, finances, inventory, and client retention. Their job is to reduce administrative overhead, make better business decisions, increase profitability, and manage the entire business from one place without relying on multiple disconnected tools.
- **Service professionals / collaborators (`COLLABORATOR`):** Barbers, stylists, and specialists working inside the business. Their job is to track their own schedule, update appointment statuses, manage personal time blocks, and review their assigned services, commissions, and work hours without administrative clutter.
- **End clients (public booking):** Customers receiving a booking link via WhatsApp or Instagram bio. Their job is to pick a service, professional (or any available), date, and time quickly on mobile without creating an account, cancel when needed, and leave post-service satisfaction reviews.

## Product Purpose

Centralize the complete operation, administration, and growth of barbershops and beauty salons in a single SaaS platform adapted to Brazil and Venezuela. Success means owners run scheduling, finances, inventory, team, and client retention from one clear, fast, reliable tool—saving administrative time, improving decision-making, and growing profitability.

## Positioning

Unlike fragmented scheduling apps that force salons and barbershops to combine separate tools for booking, cash flow, commissions, stock, and retention, this platform unifies end-to-end daily operations, advanced financial control, and client growth in one binational SaaS (Brazil and Venezuela), combining scheduling, frictionless public booking, comandas/orders, commissions, inventory, performance indicators, loyalty/client recovery, and AI + WhatsApp automation (partially implemented, partially in development) while keeping even advanced workflows simple, fast, and uncluttered.

## Operating Context

- **Binational markets:** Brazil (`pt-BR`, WhatsApp `+55`, e.g., `America/Sao_Paulo`, `America/Fortaleza`) and Venezuela (`es`, WhatsApp `+58`, `America/Caracas`).
- **Timezone truth:** Every business operates under an explicit IANA timezone; all schedules, public slots, and records render strictly in the company's timezone regardless of the visitor's browser timezone.
- **Everyday workflows & artifacts:** Public booking links (`/book/[companyId]`) shared via WhatsApp and Instagram; QR codes; spreadsheet imports (`read-excel-file`); printable receipts and financial reports; privacy mode for hiding sensitive financial figures on shared screens; post-service review links (`/review/[token]`).
- **Device reality:** Mobile-first for end clients and on-the-floor professionals; full desktop + mobile responsiveness for owners running administrative, financial, and reporting workflows.
- **Backend integration:** Connected to an external Fastify REST API (`NEXT_PUBLIC_API_URL`).

## Capabilities and Constraints

- **Implemented capabilities in the web app:**
  - Public mobile-first booking wizard without login (`/book/[companyId]`), cancellation (`/book/[companyId]/cancel`), and satisfaction reviews (`/review/[token]`).
  - Role-based authentication and route isolation (`/login`, `/register`, `/owner/*`, `/collaborator/*`).
  - Owner operations: agenda and appointment management (list, restore, manual booking, rescheduling), individual and global time blocks with affected-appointment conflict visibility, client management (birthdays, churn, loyalty, returns, profile), team/collaborator management, services/categories/packages, advanced finance (orders/comandas, statement, commissions, payables, payment methods, online payments), inventory (items, categories, suppliers, purchase orders), and agenda/finance reports.
  - Collaborator portal: personal appointments, personal blocks, schedule, and profile.
  - Full `pt-BR` and `es` localization.
- **In-development capabilities:** Additional AI capabilities and WhatsApp automations (some already implemented, others actively in development; do not present unbuilt automations as live features without verification).
- **Product & UX constraints:**
  - Simplicity must be preserved even in advanced financial, inventory, and operational screens—avoid overloaded interfaces and prioritize clarity, operational efficiency, and consistency.
  - Multi-country phone validation (`+55` / `+58`) and zero hydration mismatches on dates/times.
- **Explicitly undecided product facts:**
  - Final brand name is not yet decided (`"Atelier Agenda"` is currently a provisional working name).

## Brand Commitments

- **Working name (provisional):** `"Atelier Agenda"` — treat as a temporary placeholder until the final brand name is confirmed.
- **Final logo:** Not yet defined.
- **Tone & product character:** Modern, intuitive, fast, professional, and clear—avoiding visual clutter or unnecessary complexity even as capabilities scale.

## Evidence on Hand

- **Real product implementation:** Live Next.js App Router frontend covering landing (`/`), auth, public booking/review flows, owner dashboard (`/owner/*`), and collaborator portal (`/collaborator/*`).
- **Explicit absences (do not fabricate):** No final brand logo, no published customer logos, no testimonials, no case studies, no third-party press, and no invented metrics or benchmarks.

## Product Principles

1. **One platform, zero tool sprawl:** Unify scheduling, comandas, finances, commissions, inventory, retention, and automation so owners never have to stitch together separate apps.
2. **Advanced power, effortless clarity:** Keep complex financial, operational, and analytical workflows clean, scannable, and fast—never overloaded.
3. **Frictionless client entry:** Public booking must work immediately on mobile without login, clearly showing real availability in the business's timezone.
4. **Binational by design:** Treat Brazil (`pt-BR`, `+55`) and Venezuela (`es`, `+58`) languages, phone formats, and IANA timezones as core product behavior everywhere.
5. **Focused role autonomy:** Equip owners for full operational control and decision-making while giving collaborators a focused workspace for their own schedule and blocks.

## Accessibility & Inclusion

- Target **WCAG 2.2 AA** contrast and keyboard accessibility across public and authenticated surfaces.
- Respect `prefers-reduced-motion` across all transitions and animations.
- Maintain mobile-first touch targets of at least `44px` and prevent accidental horizontal scroll down to `320px`.
- Maintain full bilingual parity between Brazilian Portuguese (`pt-BR`) and Spanish (`es`).
