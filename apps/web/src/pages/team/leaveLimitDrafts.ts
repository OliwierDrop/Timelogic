import type { LeaveType } from "../../api";
import {
  DEFAULT_CUSTOM_LIMITS,
  DEFAULT_LEAVE_LIMITS,
  type DefaultLeaveLimit,
  type LeaveCategory,
  type LimitPeriod,
} from "../../leaveDefaults";

export type LimitDraft = {
  leave_type_id: string;
  code: string;
  name: string;
  category: LeaveCategory;
  allows_carry_over: boolean;
  year: number;
  granted_days: number;
  unlimited: boolean;
  carry_over: boolean;
  period: LimitPeriod | null;
};

function defaultForType(type: LeaveType): DefaultLeaveLimit | undefined {
  const pool =
    type.category === "custom" ? DEFAULT_CUSTOM_LIMITS : DEFAULT_LEAVE_LIMITS;
  return pool.find((row) => row.code === type.code);
}

export function draftsForYear(
  year: number,
  category: LeaveCategory,
  types: LeaveType[],
): LimitDraft[] {
  return types
    .filter((type) => type.category === category)
    .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name))
    .map((type) => {
      const fallback = defaultForType(type);
      return {
        leave_type_id: type.id,
        code: type.code,
        name: type.name,
        category,
        allows_carry_over: type.allows_carry_over,
        year,
        granted_days: fallback?.days ?? 0,
        unlimited: fallback?.unlimited ?? false,
        carry_over: Boolean(fallback?.carry_over && type.allows_carry_over),
        period:
          category === "custom"
            ? ((fallback?.period as LimitPeriod | null) ?? "month")
            : null,
      };
    });
}

export function yearsFromDrafts(rows: LimitDraft[], category: LeaveCategory) {
  return [
    ...new Set(
      rows.filter((row) => row.category === category).map((row) => row.year),
    ),
  ].sort((a, b) => a - b);
}

export function displayLeaveCode(code: string) {
  const known: Record<string, string> = {
    op: "Op",
    um: "Um",
    uo: "Uo",
    ur2: "Ur2",
    ur: "Ur",
    uwy: "Uwy",
    uw: "Uw",
    uwz: "Uwż",
    zsw: "ZSW",
    pz: "Pz",
  };
  return known[code.toLowerCase()] || code;
}
