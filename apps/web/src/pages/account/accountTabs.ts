export type AccountTabId = "profile" | "security" | "password" | "preferences";

export const ACCOUNT_TABS: { id: AccountTabId; label: string }[] = [
  { id: "profile", label: "Profil" },
  { id: "security", label: "Zabezpieczenia" },
  { id: "password", label: "Hasło" },
  { id: "preferences", label: "Preferencje" },
];
