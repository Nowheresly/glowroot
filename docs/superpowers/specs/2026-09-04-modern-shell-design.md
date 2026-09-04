# Design: Glowroot `/modern` shell 2026

**Date:** 2026-09-04  
**Status:** Approved for planning  
**Branch context:** `ui/modern-parity-1242` · React app `ui/react-app/`  
**Ambition:** Shell reorg (not a third UI, not full product redesign)

## Goal

Make the React `/modern` UI feel like a 2026 ops product while keeping the same routes, data, and behavior. Replace the 2010-era top-nav + boxed chrome with a hybrid app shell and shared page chrome, plus light/dark tokens.

## Decisions (locked)

| Topic | Choice |
|-------|--------|
| Ambition | **B** — Shell 2026 (frame + IA), pages/data unchanged |
| Navigation | **C** — Icon rail (collapsible) + top bar (agent / time / actions) |
| Density | **B** — Balanced (instrumental, not sparse SaaS) |
| Theme | **B** — Light default + optional dark |
| Scope of first pass | **B** — Global shell + shared page chrome |
| Visual approach | **A** — Evolve existing kit (`--gr-*`, IBM Plex, emerald) |

## Non-goals

- New features or closing `#1242` parity gaps (trace tree, incidents, etc.)
- Rewriting chart/D3 logic, trace modal internals, or form submit flows
- Changing AngularJS classic UI (keep “Classic UI” link only)
- Full design-system rewrite or new component library
- Dropping AngularJS / webdriver migration
- Backend, wire-api, or agent changes

## Architecture

### AppShell (global)

Replaces the current role of `AppLayout` + `Navbar`.

```
┌────────┬─────────────────────────────────────────────┐
│ Rail   │ Top bar                                     │
│ icons  │ section title · agent · time range ·        │
│        │ Classic UI · theme · settings/account       │
│        ├─────────────────────────────────────────────┤
│        │ Main (full-bleed)                           │
│        │   Page chrome + outlet                      │
└────────┴─────────────────────────────────────────────┘
```

**Icon rail**

- Global sections: Transactions, Errors, JVM, Synthetic (central), Incidents, Reporting
- Config / Admin (and login affordances) at the bottom, respecting existing `layout` permissions from `LayoutContext`
- Collapsed icon-only by default; tooltips on hover; optional expand later if needed
- Active section uses emerald accent (not Bootstrap blue)

**Top bar**

- Section title (and optional page context)
- `AgentSelector` when `layout.central`
- **Time range** lifted from in-page `ChartRangeSelector` into the shell where the transaction/error (and other ranged) views need it
- “Classic UI” link (path mapping unchanged)
- Theme toggle (`data-theme` on `html`, preference in `localStorage`, default light)
- Settings / account / sign-out (same destinations as today’s gears menu)

**Main**

- Drop the tight `max-w-7xl` center column for the shell content area (use comfortable horizontal padding; allow wide charts)
- Footer: demote or fold into settings; do not compete with the top bar

### Page chrome (shared)

Primitives under `components/layout/` or `components/chrome/`:

| Primitive | Role |
|-----------|------|
| `PageHeader` | Title, type dropdown / filters, page action slot |
| `SideList` | Scrollable nav or summary list (active = emerald left border + tint) |
| `SectionTabs` | Horizontal tabs for sub-routes (Response time, Traces, …) |
| `PageFrame` (optional thin wrapper) | Composes header + optional side list + tabs + outlet |

**Layout migration**

- `TransactionLayout` / error layout → `SideList` (summaries + sort) + `SectionTabs`
- `JvmLayout`, `ConfigLayout`, `AdminLayout` → `SideList` for section nav + `PageHeader`; tabs only where already needed
- Existing `Sidebar.tsx` becomes `SideList` or is absorbed by it

Page **data hooks and outlets stay**; only structural markup and class tokens change.

### Tokens & theme

Extend CSS variables in `index.css` (names illustrative):

- `--gr-bg`, `--gr-surface`, `--gr-surface-2`, `--gr-border`
- `--gr-text`, `--gr-muted`
- `--gr-accent`, `--gr-accent-muted`, `--gr-danger`
- `--gr-rail`, `--gr-rail-fg`

Dark theme overrides the same variables under `html[data-theme="dark"]`.

Rules:

- Keep **IBM Plex Sans** and Glowroot **emerald** accent
- Eliminate leftover blue active states (tabs/summaries today mix blue and green)
- Existing `Button` / `Input` / etc. bind to variables — no new UI library
- Typography scale: balanced compact (page title ~18–20px, body ~13–14px)

### Time range ownership

- Shell top bar owns the visible time-range control for views that currently mount `ChartRangeSelector`
- Same query-string / context behavior as today (no API contract change)
- Pages that do not use a chart range simply omit the control (shell shows it only when the active route registers a range — e.g. via context or a small slot API)

Exact slot API is an implementation detail for the plan; the requirement is: **one place in the chrome**, not duplicated per page.

## Data & behavior

- No backend changes
- Routes and query params remain parity-compatible with classic where they already are
- Auth / agent / layout flags continue to drive visibility
- Theme preference is client-only

## Error handling

- Unchanged HTTP error / spinner patterns
- Theme toggle and rail must not break if `localStorage` is unavailable (fall back to light)

## Testing / verification

Manual smoke (light + dark):

1. Transactions: average + traces
2. JVM gauges
3. Config general
4. Admin general
5. Central: agent selector + Synthetic/Incidents rail entries still gated correctly
6. Time range in top bar still drives the same fetches as before
7. Classic UI link still lands on the matching classic path

No new automated suite required in this pass; do not block on webdriver migration.

## Done when

- Hybrid shell live on all mounted section layouts
- Shared page chrome in use (no blue leftover actives)
- Dark toggle persists across reload
- Smoke checklist above passes

## Explicitly not done

- `#1242` feature parity gaps
- Webdriver port
- AngularJS removal

## Coordination note

This is a visual/IA pass on Sylvere’s React `/modern` fork path. Keep PRs focused on shell + chrome; call out look changes in the PR description so maintainer review stays easy. Do not invent a parallel UI stack.
