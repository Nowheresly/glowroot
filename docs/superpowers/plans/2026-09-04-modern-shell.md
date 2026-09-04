# Modern Shell 2026 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the `/modern` top-nav chrome with a hybrid AppShell (icon rail + top bar), shared page chrome, and light/dark tokens — without changing routes, APIs, or page data logic.

**Architecture:** Extend `--gr-*` CSS variables for dual themes; add `ThemeProvider` + `RangeSlotProvider`; rebuild layout as `AppShell` (rail/topbar) wrapping existing providers; extract `PageHeader` / `SideList` / `SectionTabs` and migrate Transaction/JVM/Config/Admin layouts onto them; lift `ChartRangeSelector` into the top bar via a register/unregister slot.

**Tech Stack:** React 18, react-router-dom 6, Tailwind 4, existing CVA UI kit, lucide-react, TypeScript strict, Vite 6 (`base: '/modern/'`).

**Spec:** `docs/superpowers/specs/2026-09-04-modern-shell-design.md`

## Global Constraints

- Ambition = shell + shared page chrome only (no feature parity work, no chart/trace rewrite)
- Keep IBM Plex Sans + emerald accent; eliminate Bootstrap-blue actives
- Light default; dark via `html[data-theme="dark"]` + `localStorage` key `glowroot-theme`
- No new UI library; no new npm test runner in this pass (verify with `npm run build` + manual smoke)
- Do not commit local-only `vite.config.ts` proxy port tweaks or `handoff.md`
- PR English: human, no AI slop; never `Co-authored-by: Cursor`

## File map

| Path | Responsibility |
|------|----------------|
| `ui/react-app/src/index.css` | Light/dark `--gr-*` tokens |
| `ui/react-app/src/lib/theme.ts` | Read/write theme preference, apply to `document.documentElement` |
| `ui/react-app/src/contexts/ThemeContext.tsx` | React theme state + toggle |
| `ui/react-app/src/contexts/RangeSlotContext.tsx` | Register chart range into shell top bar |
| `ui/react-app/src/components/layout/AppShell.tsx` | Rail + top bar + main + demoted footer |
| `ui/react-app/src/components/layout/NavRail.tsx` | Icon rail sections |
| `ui/react-app/src/components/layout/TopBar.tsx` | Title, agent, range slot, classic, theme, settings |
| `ui/react-app/src/components/layout/PageHeader.tsx` | Page title row |
| `ui/react-app/src/components/layout/SideList.tsx` | Replaces/absorbs `Sidebar.tsx` |
| `ui/react-app/src/components/layout/SectionTabs.tsx` | Shared tab strip |
| `ui/react-app/src/components/layout/AppLayout.tsx` | Thin wrapper: providers + `AppShell` |
| `ui/react-app/src/components/layout/Navbar.tsx` | Delete after AppShell lands (or leave unused then delete) |
| `ui/react-app/src/routes/transaction/TransactionLayout.tsx` | Use page chrome; register range slot |
| `ui/react-app/src/routes/jvm/JvmLayout.tsx` | Use PageHeader + SideList |
| `ui/react-app/src/routes/jvm/JvmGaugesPage.tsx` | Register its local `useChartRange` into range slot |
| `ui/react-app/src/routes/config/ConfigLayout.tsx` | Use PageHeader + SideList |
| `ui/react-app/src/routes/admin/AdminLayout.tsx` | Use PageHeader + SideList |
| `ui/react-app/src/components/ui/button.tsx` | Ensure variants use `--gr-*` (already mostly does) |
| `ui/react-app/src/main.tsx` | Call `applyStoredTheme()` before render |

---

### Task 1: Theme tokens + apply-on-boot

**Files:**
- Modify: `ui/react-app/src/index.css`
- Create: `ui/react-app/src/lib/theme.ts`
- Modify: `ui/react-app/src/main.tsx`
- Create: `ui/react-app/src/contexts/ThemeContext.tsx`

**Interfaces:**
- Produces: `Theme = 'light' | 'dark'`; `STORAGE_KEY = 'glowroot-theme'`; `getStoredTheme(): Theme`; `applyTheme(theme: Theme): void`; `applyStoredTheme(): Theme`; `ThemeProvider`; `useTheme(): { theme: Theme; setTheme: (t: Theme) => void; toggleTheme: () => void }`

- [ ] **Step 1: Replace `:root` tokens and add dark overrides in `index.css`**

```css
@import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&display=swap');
@import "tailwindcss";

:root {
  --gr-font: 'IBM Plex Sans', ui-sans-serif, sans-serif;
  --gr-bg: #f0f2f5;
  --gr-surface: #ffffff;
  --gr-surface-2: #f9fafb;
  --gr-border: #e2e5ea;
  --gr-text: #111827;
  --gr-muted: #6b7280;
  --gr-accent: #059669;
  --gr-accent-bright: #10b981;
  --gr-accent-muted: #ecfdf5;
  --gr-danger: #dc2626;
  --gr-rail: #111827;
  --gr-rail-fg: #ffffff;
  --gr-nav: #111827; /* alias for any leftover refs */
}

html[data-theme="dark"] {
  --gr-bg: #0f1419;
  --gr-surface: #161b22;
  --gr-surface-2: #1a222d;
  --gr-border: #243041;
  --gr-text: #f3f4f6;
  --gr-muted: #9ca3af;
  --gr-accent: #10b981;
  --gr-accent-bright: #34d399;
  --gr-accent-muted: #064e3b;
  --gr-danger: #f87171;
  --gr-rail: #080b10;
  --gr-rail-fg: #e5e7eb;
  --gr-nav: #080b10;
}

html,
body,
#root {
  font-family: var(--gr-font);
  color: var(--gr-text);
  background-color: var(--gr-bg);
}

.gr-surface {
  background-color: var(--gr-surface);
  border-color: var(--gr-border);
}
```

- [ ] **Step 2: Add `lib/theme.ts`**

```ts
export type Theme = 'light' | 'dark'

export const THEME_STORAGE_KEY = 'glowroot-theme'

export function getStoredTheme(): Theme {
  try {
    const v = localStorage.getItem(THEME_STORAGE_KEY)
    return v === 'dark' ? 'dark' : 'light'
  } catch {
    return 'light'
  }
}

export function applyTheme(theme: Theme): void {
  document.documentElement.setAttribute('data-theme', theme)
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme)
  } catch {
    /* ignore */
  }
}

export function applyStoredTheme(): Theme {
  const theme = getStoredTheme()
  document.documentElement.setAttribute('data-theme', theme)
  return theme
}
```

- [ ] **Step 3: Call `applyStoredTheme()` in `main.tsx` before render**

```tsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import { AppRouter } from './routes/Router'
import { applyStoredTheme } from './lib/theme'
import './index.css'

applyStoredTheme()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AppRouter />
  </React.StrictMode>,
)
```

- [ ] **Step 4: Add `ThemeContext.tsx`**

```tsx
import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'
import { applyTheme, getStoredTheme, type Theme } from '../lib/theme'

interface ThemeContextValue {
  theme: Theme
  setTheme: (theme: Theme) => void
  toggleTheme: () => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => getStoredTheme())

  const value = useMemo<ThemeContextValue>(() => {
    function setTheme(next: Theme) {
      setThemeState(next)
      applyTheme(next)
    }
    return {
      theme,
      setTheme,
      toggleTheme: () => setTheme(theme === 'dark' ? 'light' : 'dark'),
    }
  }, [theme])

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider')
  return ctx
}
```

- [ ] **Step 5: Verify build**

Run: `cd ui/react-app; npm run build`  
Expected: `tsc` + vite succeed (no theme-related errors).

- [ ] **Step 6: Commit**

```bash
git add ui/react-app/src/index.css ui/react-app/src/lib/theme.ts ui/react-app/src/main.tsx ui/react-app/src/contexts/ThemeContext.tsx
git commit -m "UI: add light/dark theme tokens for /modern shell"
```

---

### Task 2: Page chrome primitives

**Files:**
- Create: `ui/react-app/src/components/layout/PageHeader.tsx`
- Create: `ui/react-app/src/components/layout/SectionTabs.tsx`
- Create: `ui/react-app/src/components/layout/SideList.tsx`
- Modify: keep `Sidebar.tsx` as a thin re-export of `SideList` temporarily (or update all imports in Task 5–6 and delete)

**Interfaces:**
- Produces:
  - `PageHeader({ title: ReactNode; actions?: ReactNode; children?: ReactNode })`
  - `SectionTab { id: string; label: ReactNode; href: string; active: boolean }`
  - `SectionTabs({ tabs: SectionTab[] })`
  - `SideListItem` / `SideListGroup` (same shape as current `SidebarItem` / `SidebarGroup`)
  - `SideList({ groups: SideListGroup[]; header?: ReactNode })`

- [ ] **Step 1: Create `PageHeader.tsx`**

```tsx
import type { ReactNode } from 'react'
import { cn } from '../../lib/utils'

export function PageHeader({
  title,
  actions,
  children,
  className,
}: {
  title: ReactNode
  actions?: ReactNode
  children?: ReactNode
  className?: string
}) {
  return (
    <div className={cn('mb-4 flex flex-wrap items-center gap-3', className)}>
      <div className="text-lg font-semibold text-[var(--gr-text)]">{title}</div>
      {children}
      {actions && <div className="ml-auto flex items-center gap-2">{actions}</div>}
    </div>
  )
}
```

- [ ] **Step 2: Create `SectionTabs.tsx`**

```tsx
import { Link } from 'react-router-dom'
import type { ReactNode } from 'react'
import { cn } from '../../lib/utils'

export interface SectionTab {
  id: string
  label: ReactNode
  href: string
  active: boolean
}

export function SectionTabs({ tabs }: { tabs: SectionTab[] }) {
  return (
    <nav className="mb-4 flex border-b border-[var(--gr-border)]">
      {tabs.map((tab) => (
        <Link
          key={tab.id}
          to={tab.href}
          className={cn(
            'border-b-2 -mb-px px-4 py-2 text-sm no-underline transition-colors',
            tab.active
              ? 'border-[var(--gr-accent)] font-medium text-[var(--gr-accent)]'
              : 'border-transparent text-[var(--gr-muted)] hover:text-[var(--gr-text)]'
          )}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  )
}
```

- [ ] **Step 3: Create `SideList.tsx` (emerald active — no blue)**

Copy behavior from current `Sidebar.tsx`, but:

- Active classes: `border-l-[3px] border-l-[var(--gr-accent)] bg-[var(--gr-accent-muted)] … text-[var(--gr-accent)]`
- Inactive: `text-[var(--gr-text)] hover:bg-[var(--gr-surface-2)]`
- Accept optional `header?: ReactNode` rendered above the list inside the same card
- Export types as `SideListItem` / `SideListGroup` (fields identical to today’s `SidebarItem` / `SidebarGroup`)

- [ ] **Step 4: Make `Sidebar.tsx` re-export for one transition commit**

```tsx
export { SideList as Sidebar, type SideListGroup as SidebarGroup, type SideListItem as SidebarItem } from './SideList'
```

- [ ] **Step 5: Build**

Run: `cd ui/react-app; npm run build`  
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add ui/react-app/src/components/layout/PageHeader.tsx ui/react-app/src/components/layout/SectionTabs.tsx ui/react-app/src/components/layout/SideList.tsx ui/react-app/src/components/layout/Sidebar.tsx
git commit -m "UI: add shared page chrome primitives for /modern"
```

---

### Task 3: RangeSlot context

**Files:**
- Create: `ui/react-app/src/contexts/RangeSlotContext.tsx`

**Interfaces:**
- Consumes: `ChartRange`, `ChartRangeActions` from `hooks/useChartRange`
- Produces: `RangeSlotProvider`; `useRangeSlot(): { range, actions } | null`; `useRegisterRangeSlot(range, actions): void`

- [ ] **Step 1: Implement register/unregister slot**

```tsx
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { ChartRange, ChartRangeActions } from '../hooks/useChartRange'

export interface RangeSlotValue {
  range: ChartRange
  actions: ChartRangeActions
}

interface RangeSlotContextValue {
  slot: RangeSlotValue | null
  setSlot: (slot: RangeSlotValue | null) => void
}

const RangeSlotContext = createContext<RangeSlotContextValue | null>(null)

export function RangeSlotProvider({ children }: { children: ReactNode }) {
  const [slot, setSlot] = useState<RangeSlotValue | null>(null)
  const value = useMemo(() => ({ slot, setSlot }), [slot])
  return (
    <RangeSlotContext.Provider value={value}>{children}</RangeSlotContext.Provider>
  )
}

function useRangeSlotContext(): RangeSlotContextValue {
  const ctx = useContext(RangeSlotContext)
  if (!ctx) throw new Error('RangeSlot hooks require RangeSlotProvider')
  return ctx
}

export function useRangeSlot(): RangeSlotValue | null {
  return useRangeSlotContext().slot
}

/** Register this page/layout's chart range into the AppShell top bar. */
export function useRegisterRangeSlot(
  range: ChartRange,
  actions: ChartRangeActions
): void {
  const { setSlot } = useRangeSlotContext()
  useEffect(() => {
    setSlot({ range, actions })
    return () => setSlot(null)
  }, [range, actions, setSlot])
}
```

Note: if `range` / `actions` identities churn every render, stabilize in callers (TransactionContext already memoizes; JvmGaugesPage may need wrapping the register args carefully — depend on `refreshCounter` + stable actions from `useChartRange`).

- [ ] **Step 2: Build**

Run: `cd ui/react-app; npm run build`  
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add ui/react-app/src/contexts/RangeSlotContext.tsx
git commit -m "UI: add chart range slot for AppShell top bar"
```

---

### Task 4: AppShell (rail + top bar)

**Files:**
- Create: `ui/react-app/src/components/layout/NavRail.tsx`
- Create: `ui/react-app/src/components/layout/TopBar.tsx`
- Create: `ui/react-app/src/components/layout/AppShell.tsx`
- Modify: `ui/react-app/src/components/layout/AppLayout.tsx`
- Delete (after wiring): `ui/react-app/src/components/layout/Navbar.tsx` usage

**Interfaces:**
- Consumes: `useLayout`, `useAgent`, `useAuth`, `useTheme`, `useRangeSlot`, `AgentSelector`, `ChartRangeSelector`, `Footer`
- Produces: `AppShell` with `<Outlet />` in main

- [ ] **Step 1: Implement `NavRail.tsx`**

Icon-only rail (`w-14`), `bg-[var(--gr-rail)] text-[var(--gr-rail-fg)]`.

Sections (mirror current Navbar visibility flags):

| id | label | path prefix | show when |
|----|-------|-------------|-----------|
| transaction | Transactions | `/modern/transaction/...` | `layout.showNavbarTransaction` |
| error | Errors | `/modern/error/...` | `layout.showNavbarError` |
| jvm | JVM | `/modern/jvm/...` | `layout.showNavbarJvm` |
| syntheticMonitor | Synthetic | `/modern/synthetic-monitors` | `layout.central && layout.showNavbarSyntheticMonitor` |
| incidents | Incidents | `/modern/incidents` | `layout.showNavbarIncident` |
| report | Reporting | `/modern/report/...` | `layout.showNavbarReport` |

Bottom: gear dropdown or links for Configuration / Administration / Login / Change password (same rules as current Navbar `showGears`).

Use lucide icons (`Activity`, `AlertTriangle`, `Cpu`, `Radar`, `Siren`, `FileBarChart`, `Settings`). `title` attribute for tooltip.

Active: `bg-[var(--gr-accent)]/20 text-[var(--gr-accent-bright)]`.

Logo mark top: link to `/modern/` + agent qs.

- [ ] **Step 2: Implement `TopBar.tsx`**

Height `h-12`, `bg-[var(--gr-surface)] border-b border-[var(--gr-border)]`.

Left: section title derived from `location.pathname` (Transactions / Errors / JVM / Configuration / Administration / …).

Center-left: `{layout.central && <AgentSelector />}`.

Right cluster:

1. If `useRangeSlot()` non-null → render compact `ChartRangeSelector` (reuse component; optionally add a `compact` prop later — for v1 wrapping in a scrollable flex row is fine)
2. Classic UI `<a href={classicPath(...)}>`
3. Theme toggle button calling `useTheme().toggleTheme` (Moon/Sun icons)
4. Sign out if logged in

Port `classicPath()` helper from current Navbar.

- [ ] **Step 3: Implement `AppShell.tsx`**

```tsx
import { Outlet } from 'react-router-dom'
import { NavRail } from './NavRail'
import { TopBar } from './TopBar'
import { Footer } from './Footer'

export function AppShell() {
  return (
    <div className="flex min-h-screen bg-[var(--gr-bg)]">
      <NavRail />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar />
        <main className="flex-1 px-4 py-4 md:px-6">
          <Outlet />
        </main>
        <Footer />
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Rewire `AppLayout.tsx`**

```tsx
import { AuthProvider } from '../../contexts/AuthContext'
import { AgentProvider } from '../../contexts/AgentContext'
import { ThemeProvider } from '../../contexts/ThemeContext'
import { RangeSlotProvider } from '../../contexts/RangeSlotContext'
import { AppShell } from './AppShell'

export function AppLayout() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <AgentProvider>
          <RangeSlotProvider>
            <AppShell />
          </RangeSlotProvider>
        </AgentProvider>
      </AuthProvider>
    </ThemeProvider>
  )
}
```

Remove old Navbar-based markup.

- [ ] **Step 5: Delete `Navbar.tsx` if unused; fix any imports**

- [ ] **Step 6: Manual smoke + build**

Run: `cd ui/react-app; npm run build`  
Dev: `npm run dev` — open `/modern/`, confirm rail + top bar render, theme toggle flips tokens, Classic UI link works.

- [ ] **Step 7: Commit**

```bash
git add ui/react-app/src/components/layout/ ui/react-app/src/contexts/
git commit -m "UI: replace /modern navbar with hybrid AppShell"
```

---

### Task 5: Migrate Transaction (+ Error) layout

**Files:**
- Modify: `ui/react-app/src/routes/transaction/TransactionLayout.tsx`

**Interfaces:**
- Consumes: `PageHeader`, `SideList`, `SectionTabs`, `useRegisterRangeSlot`
- Removes in-page `ChartRangeSelector` (now in top bar)

- [ ] **Step 1: Register range into shell**

Near top of `TransactionLayout` (inside provider tree that already has range):

```tsx
const txn = useTransaction()
useRegisterRangeSlot(txn.range, txn.rangeActions)
```

- [ ] **Step 2: Replace header / sidebar / tabs markup**

- Header → `PageHeader` with title `txn.headerDisplay` (+ agent displayName) and type `<select>` as `children`
- Summary list → `SideList` with a `header` slot for the sort-order `<select>`; map “All …” + each summary to items (`href` via existing `sidebarQs`). For active styling, pass `active` boolean per item (Overall when `!txn.transactionName`, else name match). **Do not use blue classes.**
- Tabs → build `SectionTab[]` from existing `TransactionTabs` / `ErrorTabs` logic and render `<SectionTabs tabs={...} />`
- Delete the in-layout `<ChartRangeSelector … />`

- [ ] **Step 3: Build + smoke**

Run: `cd ui/react-app; npm run build`  
Manual: Transactions average — change time range in **top bar**, confirm chart refetches; switch tabs; select a transaction in SideList; toggle dark.

- [ ] **Step 4: Commit**

```bash
git add ui/react-app/src/routes/transaction/TransactionLayout.tsx
git commit -m "UI: migrate transaction layout to AppShell page chrome"
```

---

### Task 6: Migrate JVM / Config / Admin layouts + gauges range

**Files:**
- Modify: `ui/react-app/src/routes/jvm/JvmLayout.tsx`
- Modify: `ui/react-app/src/routes/jvm/JvmGaugesPage.tsx`
- Modify: `ui/react-app/src/routes/config/ConfigLayout.tsx`
- Modify: `ui/react-app/src/routes/admin/AdminLayout.tsx`
- Optionally delete `Sidebar.tsx` re-export if all imports point at `SideList`

- [ ] **Step 1: JvmLayout → PageHeader + SideList**

Same groups as today; title “JVM” (+ displayName). Use token text colors not `text-gray-900`.

- [ ] **Step 2: JvmGaugesPage registers its range**

Where the page already calls `useChartRange(...)`:

```tsx
const [range, rangeActions, refreshCounter] = useChartRange(/* existing args */)
useRegisterRangeSlot(range, rangeActions)
```

Remove the in-page `ChartRangeSelector` from gauges if present (keep zoom/selection on the chart itself).

- [ ] **Step 3: ConfigLayout + AdminLayout → PageHeader + SideList**

Preserve all `hidden` / `active` rules and query strings. No range slot.

- [ ] **Step 4: Build + smoke**

Run: `cd ui/react-app; npm run build`  
Manual: JVM gauges (range in top bar), Config general, Admin general — light + dark.

- [ ] **Step 5: Commit**

```bash
git add ui/react-app/src/routes/jvm/JvmLayout.tsx ui/react-app/src/routes/jvm/JvmGaugesPage.tsx ui/react-app/src/routes/config/ConfigLayout.tsx ui/react-app/src/routes/admin/AdminLayout.tsx
git commit -m "UI: migrate JVM/config/admin layouts to shared page chrome"
```

---

### Task 7: Sweep leftover blue / gray hardcodes in chrome paths + final smoke

**Files:**
- Modify as found: `TransactionLayout.tsx` (if any leftover), `Sidebar` consumers, tab helpers
- Grep: `bg-blue-`, `text-blue-`, `border-blue-` under `ui/react-app/src`

- [ ] **Step 1: Grep and replace chrome actives with accent tokens**

Run: `rg "bg-blue-|text-blue-|border-blue-" ui/react-app/src`  
Replace layout/nav active styles with `--gr-accent` / `--gr-accent-muted`. Leave semantic blues inside charts only if they are series colors (do not restyle D3 series in this pass).

- [ ] **Step 2: Full smoke checklist (from spec)**

1. Transactions average + traces — light + dark  
2. JVM gauges — light + dark  
3. Config general — light + dark  
4. Admin general — light + dark  
5. Central: agent selector + Synthetic/Incidents rail gating  
6. Top-bar time range drives same fetches  
7. Classic UI link path mapping  

- [ ] **Step 3: Final build**

Run: `cd ui/react-app; npm run build`  
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add -u ui/react-app/src
git commit -m "UI: finish /modern shell accent sweep and chrome polish"
```

---

## Spec coverage (self-check)

| Spec requirement | Task |
|------------------|------|
| Hybrid icon rail + top bar | 4 |
| PageHeader / SideList / SectionTabs | 2, 5, 6 |
| Light default + dark toggle + localStorage | 1, 4 |
| Emerald-only actives | 2, 5, 7 |
| Time range in top bar via slot | 3, 5, 6 |
| Migrate Txn/JVM/Config/Admin | 5, 6 |
| No backend / no parity features | Global constraints |
| Manual smoke | 4–7 |

## Placeholder / consistency check

- Theme storage key fixed: `glowroot-theme`
- Hooks named consistently: `useRegisterRangeSlot` / `useRangeSlot`
- SideList types replace Sidebar types after Task 6
- No TBD steps remaining
