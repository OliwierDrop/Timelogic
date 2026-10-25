export type OrgTabId = "profile" | "mail" | "audit";

export const ORG_TABS: { id: OrgTabId; label: string }[] = [
  { id: "profile", label: "Organizacja" },
  { id: "mail", label: "Poczta" },
  { id: "audit", label: "Audyt" },
];
