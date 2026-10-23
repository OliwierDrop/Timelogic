export type LeaveCategory = "leave" | "custom";
export type LimitPeriod = "year" | "month";

export type DefaultLeaveLimit = {
  code: string;
  name: string;
  category: LeaveCategory;
  days: number;
  carry_over: boolean;
  allows_carry_over: boolean;
  unlimited: boolean;
  period: LimitPeriod | null;
};

/** Domyślne limity urlopowe (pełny etat, >10 lat stażu). */
export const DEFAULT_LEAVE_LIMITS: DefaultLeaveLimit[] = [
  {
    code: "op",
    name: "Opieka nad dzieckiem",
    category: "leave",
    days: 2,
    carry_over: false,
    allows_carry_over: true,
    unlimited: false,
    period: null,
  },
  {
    code: "um",
    name: "Urlop macierzyński",
    category: "leave",
    days: 140,
    carry_over: false,
    allows_carry_over: true,
    unlimited: false,
    period: null,
  },
  {
    code: "uo",
    name: "Urlop ojcowski",
    category: "leave",
    days: 14,
    carry_over: false,
    allows_carry_over: true,
    unlimited: false,
    period: null,
  },
  {
    code: "ur2",
    name: "Urlop rodzicielski - drugi rodzic",
    category: "leave",
    days: 63,
    carry_over: false,
    allows_carry_over: true,
    unlimited: false,
    period: null,
  },
  {
    code: "ur",
    name: "Urlop rodzicielski - pierwszy rodzic",
    category: "leave",
    days: 224,
    carry_over: false,
    allows_carry_over: true,
    unlimited: false,
    period: null,
  },
  {
    code: "uwy",
    name: "Urlop wychowawczy",
    category: "leave",
    days: 364,
    carry_over: false,
    allows_carry_over: true,
    unlimited: false,
    period: null,
  },
  {
    code: "uw",
    name: "Urlop wypoczynkowy",
    category: "leave",
    days: 26,
    carry_over: true,
    allows_carry_over: true,
    unlimited: false,
    period: null,
  },
  {
    code: "uwz",
    name: "Urlop wypoczynkowy „na żądanie”",
    category: "leave",
    days: 4,
    carry_over: false,
    allows_carry_over: false,
    unlimited: false,
    period: null,
  },
  {
    code: "zsw",
    name: "Zwolnienie od pracy z powodu działania siły wyższej",
    category: "leave",
    days: 2,
    carry_over: false,
    allows_carry_over: true,
    unlimited: false,
    period: null,
  },
];

export const DEFAULT_CUSTOM_LIMITS: DefaultLeaveLimit[] = [
  {
    code: "pz",
    name: "Praca zdalna",
    category: "custom",
    days: 0,
    carry_over: false,
    allows_carry_over: false,
    unlimited: true,
    period: "month",
  },
];
