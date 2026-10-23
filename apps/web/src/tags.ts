/** Paleta 32 kolorów — ta sama whitelist co w API. */
export const TAG_COLORS = [
  "#94A3B8",
  "#64748B",
  "#475569",
  "#334155",
  "#1E293B",
  "#0F172A",
  "#7DD3FC",
  "#38BDF8",
  "#0EA5E9",
  "#0284C7",
  "#0369A1",
  "#FCA5A5",
  "#F87171",
  "#EF4444",
  "#DC2626",
  "#B91C1C",
  "#7F1D1D",
  "#86EFAC",
  "#4ADE80",
  "#22C55E",
  "#16A34A",
  "#FDE047",
  "#FACC15",
  "#EAB308",
  "#FB923C",
  "#F97316",
  "#C084FC",
  "#A855F7",
  "#9333EA",
  "#F9A8D4",
  "#EC4899",
  "#DB2777",
] as const;

export type TagColor = (typeof TAG_COLORS)[number];

export const DEFAULT_TAG_COLOR: TagColor = TAG_COLORS[0];
