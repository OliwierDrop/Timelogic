import type { ContractType } from "../../api";

export const CONTRACT_OPTIONS: {
  code: ContractType;
  label: string;
}[] = [
  { code: "employment", label: "Umowa o pracę" },
  { code: "mandate", label: "Umowa zlecenie" },
  { code: "specific_task", label: "Umowa o dzieło" },
];

export function contractLabel(code: ContractType | string | null | undefined) {
  return CONTRACT_OPTIONS.find((row) => row.code === code)?.label || code || "—";
}
