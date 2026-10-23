export type User = {
  id: string;
  email: string;
  roles: string[];
  employee_id: string | null;
};
export type Me = {
  user: User;
  csrf_token: string | null;
  session_expires_at?: string;
};
export type EmployeeTag = {
  id: string;
  name: string;
  color: string;
  is_informational: boolean;
};
export type Employee = {
  id: string;
  employee_number: string;
  first_name: string;
  last_name: string;
  position_id: string | null;
  position: string | null;
  phone: string | null;
  active: boolean;
  status: "active" | "invited" | "inactive";
  user_id: string | null;
  email: string | null;
  roles: string[];
  supervisor_id: string | null;
  supervisor_name: string | null;
  tags: EmployeeTag[];
  tag_ids: string[];
  hired_on: string | null;
  ended_on: string | null;
};
export type Tag = {
  id: string;
  name: string;
  color: string;
  is_informational: boolean;
};
export type Position = { id: string; name: string };
export type Break = {
  id: string;
  started_at: string;
  ended_at: string | null;
  paid: boolean;
};
export type Entry = {
  id: string;
  employee_id: string;
  started_at: string;
  ended_at: string | null;
  version: number;
  breaks: Break[];
};
export type Correction = {
  id: string;
  time_entry_id: string;
  employee_id: string;
  status: string;
  reason: string;
  proposed_start: string;
  proposed_end: string;
  created_at: string;
};
export type Shift = {
  id: string;
  employee_id: string;
  template_id: string | null;
  started_at: string;
  ended_at: string;
  published_at: string | null;
  published: boolean;
};
export type ShiftTemplate = {
  id: string;
  name: string;
  start_minute: number;
  duration_minutes: number;
};
export type LeaveType = { id: string; code: string; name: string };
export type LeaveBalance = {
  id: string;
  employee_id: string;
  leave_type_id: string;
  year: number;
  granted_days: number;
  used_days: number;
  remaining_days: number;
};
export type LeaveRequest = {
  id: string;
  employee_id: string;
  leave_type_id: string;
  start_date: string;
  end_date: string;
  days: number;
  status: string;
  reason: string | null;
  decided_at: string | null;
};

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public fields: Record<string, string> = {},
  ) {
    super(message);
  }
}

let csrfToken: string | null = null;
export function setCsrf(token: string | null) {
  csrfToken = token;
}

export async function api<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const headers = new Headers(options.headers);
  if (options.body) headers.set("Content-Type", "application/json");
  if (options.method && !["GET", "HEAD"].includes(options.method)) {
    if (csrfToken) headers.set("X-CSRF-Token", csrfToken);
    if (path.includes("/time-entries"))
      headers.set("Idempotency-Key", crypto.randomUUID());
  }
  const response = await fetch(`/api/v1${path}`, {
    ...options,
    credentials: "same-origin",
    headers,
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new ApiError(
      response.status,
      error.message || "Nie udało się wykonać operacji",
      error.fields || {},
    );
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export const post = <T>(path: string, data: unknown) =>
  api<T>(path, { method: "POST", body: JSON.stringify(data) });
export const patch = <T>(path: string, data: unknown) =>
  api<T>(path, { method: "PATCH", body: JSON.stringify(data) });
export const put = <T>(path: string, data: unknown) =>
  api<T>(path, { method: "PUT", body: JSON.stringify(data) });
export const del = (path: string) => api<void>(path, { method: "DELETE" });

export function localDate(value: string) {
  return new Intl.DateTimeFormat("pl-PL", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/Warsaw",
  }).format(new Date(value));
}

export function localTime(value: string) {
  return new Intl.DateTimeFormat("pl-PL", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Warsaw",
  }).format(new Date(value));
}

export function deviceDatetime(value: string) {
  const date = new Date(value);
  const pad = (number: number) => String(number).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
