import * as SecureStore from "expo-secure-store";
import { Uniwind, useUniwind } from "uniwind";

/** "system" follows the device setting; the others pin the app to one theme. */
export type ThemePreference = "system" | "light" | "dark";

const THEME_KEY = "theme";

const isPinned = (value: unknown): value is "light" | "dark" =>
  value === "light" || value === "dark";

/**
 * Applies the saved preference (call once on launch, before hiding the splash screen).
 * Uniwind also sets React Native's Appearance, so native UI (keyboard, date picker, alerts) follows.
 */
export async function restoreThemePreference(): Promise<void> {
  try {
    const saved = await SecureStore.getItemAsync(THEME_KEY);
    if (isPinned(saved)) Uniwind.setTheme(saved);
  } catch {
    // Storage unavailable (e.g. web): stay on the system theme.
  }
}

export function setThemePreference(preference: ThemePreference): void {
  Uniwind.setTheme(preference);
  SecureStore.setItemAsync(THEME_KEY, preference).catch(() => undefined);
}

/** Current preference plus the theme actually shown (resolves "system"). */
export function useThemePreference(): { preference: ThemePreference; theme: "light" | "dark" } {
  const { theme, hasAdaptiveThemes } = useUniwind();
  const resolved = theme === "dark" ? "dark" : "light";
  return { preference: hasAdaptiveThemes ? "system" : resolved, theme: resolved };
}
