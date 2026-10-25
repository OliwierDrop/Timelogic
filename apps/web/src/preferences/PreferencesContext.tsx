import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  DEFAULT_USER_PREFERENCES,
  patch,
  setActivePreferences,
  type UserPreferences,
} from "../api";

type PreferencesContextValue = {
  preferences: UserPreferences;
  setPreferences: (next: UserPreferences) => void;
  savePreferences: (patchBody: Partial<UserPreferences>) => Promise<UserPreferences>;
};

const PreferencesContext = createContext<PreferencesContextValue | null>(null);

function applyTheme(theme: UserPreferences["theme"]) {
  const root = document.documentElement;
  if (theme === "system") {
    root.removeAttribute("data-theme");
    root.setAttribute(
      "data-theme",
      window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light",
    );
    root.dataset.themeSource = "system";
  } else {
    root.setAttribute("data-theme", theme);
    root.dataset.themeSource = theme;
  }
}

export function PreferencesProvider({
  initial,
  children,
}: {
  initial?: UserPreferences | null;
  children: ReactNode;
}) {
  const [preferences, setPreferencesState] = useState<UserPreferences>(
    initial || DEFAULT_USER_PREFERENCES,
  );

  useEffect(() => {
    if (initial) setPreferencesState(initial);
  }, [initial]);

  useEffect(() => {
    setActivePreferences(preferences);
    applyTheme(preferences.theme);
  }, [preferences]);

  useEffect(() => {
    if (preferences.theme !== "system") return;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => applyTheme("system");
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [preferences.theme]);

  const value = useMemo<PreferencesContextValue>(
    () => ({
      preferences,
      setPreferences: (next) => {
        setPreferencesState(next);
        setActivePreferences(next);
      },
      savePreferences: async (patchBody) => {
        const saved = await patch<UserPreferences>("/auth/me/preferences", patchBody);
        setPreferencesState(saved);
        setActivePreferences(saved);
        return saved;
      },
    }),
    [preferences],
  );

  return (
    <PreferencesContext.Provider value={value}>
      {children}
    </PreferencesContext.Provider>
  );
}

export function usePreferences() {
  const ctx = useContext(PreferencesContext);
  if (!ctx) {
    throw new Error("usePreferences must be used within PreferencesProvider");
  }
  return ctx;
}
