export const ROLE_OPTIONS = [
  {
    code: "employee",
    label: "Pracownik",
    hint: "Rejestruje czas i składa wnioski w swoim zakresie.",
  },
  {
    code: "manager",
    label: "Kierownik",
    hint: "Zarządza bezpośrednimi podwładnymi w zespole.",
  },
  {
    code: "hr",
    label: "HR",
    hint: "Zarządza kartami, grafikiem i wnioskami w organizacji.",
  },
  {
    code: "admin",
    label: "Administrator",
    hint: "Pełny dostęp do organizacji, w tym kont i uprawnień.",
  },
] as const;

export function roleLabel(code: string) {
  return ROLE_OPTIONS.find((r) => r.code === code)?.label || code;
}

export function matchesQuery(label: string, query: string) {
  if (!query.trim()) return true;
  return label.toLowerCase().includes(query.trim().toLowerCase());
}
