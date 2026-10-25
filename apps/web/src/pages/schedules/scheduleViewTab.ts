export type ScheduleViewTab =
  | "all"
  | "shifts"
  | "availability"
  | "leaves";

export const SCHEDULE_VIEW_TABS: {
  id: ScheduleViewTab;
  label: string;
}[] = [
  { id: "all", label: "Wszystko" },
  { id: "shifts", label: "Grafik pracy" },
  { id: "availability", label: "Dostępność" },
  { id: "leaves", label: "Wnioski" },
];
