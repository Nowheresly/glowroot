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
