import { AlertCircle, CheckCircle2, Send } from "lucide-react";
import type { Employee } from "../../api";

export function statusLabel(status: Employee["status"]) {
  if (status === "invited") return "Zaproszony";
  if (status === "inactive") return "Nieaktywny";
  return "Aktywny";
}

export function EmployeeStatusIcon({
  status,
}: {
  status: Employee["status"];
}) {
  const label = statusLabel(status);
  if (status === "invited") {
    return (
      <span
        className="employee-status employee-status-invited"
        title={label}
        aria-label={label}
      >
        <Send size={14} strokeWidth={2.25} />
      </span>
    );
  }
  if (status === "inactive") {
    return (
      <span
        className="employee-status employee-status-inactive"
        title={label}
        aria-label={label}
      >
        <AlertCircle size={14} strokeWidth={2.25} />
      </span>
    );
  }
  return (
    <span
      className="employee-status employee-status-active"
      title={label}
      aria-label={label}
    >
      <CheckCircle2 size={14} strokeWidth={2.25} />
    </span>
  );
}
