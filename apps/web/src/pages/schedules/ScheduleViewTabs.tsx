import {
  SCHEDULE_VIEW_TABS,
  type ScheduleViewTab,
} from "./scheduleViewTab";

export function ScheduleViewTabs({
  value,
  onChange,
}: {
  value: ScheduleViewTab;
  onChange: (value: ScheduleViewTab) => void;
}) {
  return (
    <nav className="schedule-view-tabs" aria-label="Widok kalendarza">
      {SCHEDULE_VIEW_TABS.map((tab) => (
        <button
          key={tab.id}
          type="button"
          className={`schedule-view-tab${value === tab.id ? " active" : ""}`}
          aria-current={value === tab.id ? "page" : undefined}
          onClick={() => onChange(tab.id)}
        >
          {tab.label}
        </button>
      ))}
    </nav>
  );
}
