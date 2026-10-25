export type UserPreferences = {
  time_format: "h24" | "h12";
  date_format: "dmy" | "ymd" | "mdy";
  week_starts_on: "monday" | "sunday";
  theme: "system" | "light" | "dark";
};

export type UserSecurity = {
  totp_enabled: boolean;
  email_otp_enabled: boolean;
};

export type User = {
  id: string;
  email: string;
  roles: string[];
  employee_id: string | null;
  first_name: string | null;
  last_name: string | null;
  phone?: string | null;
  pending_email?: string | null;
  security?: UserSecurity;
  preferences?: UserPreferences;
};

export const DEFAULT_USER_PREFERENCES: UserPreferences = {
  time_format: "h24",
  date_format: "dmy",
  week_starts_on: "monday",
  theme: "system",
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
export type ContractType = "employment" | "mandate" | "specific_task";
export type EmploymentTerm = {
  id?: string;
  employee_id?: string;
  effective_from: string;
  contract_type: ContractType;
  daily_minutes: number;
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
  pending_email?: string | null;
  email_change?: {
    pending_email: string;
    email_sent: boolean;
    confirm_url: string | null;
  };
  roles: string[];
  supervisor_id: string | null;
  supervisor_name: string | null;
  tags: EmployeeTag[];
  tag_ids: string[];
  hired_on: string | null;
  ended_on: string | null;
  current_contract_type?: ContractType | null;
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
export type ShiftKind = "standard" | "flexible" | "on_call";
export type ShiftFlags = {
  count_before?: boolean;
  count_after?: boolean;
  auto_break?: boolean;
  auto_break_minutes?: number;
  unpaid_break?: boolean;
  property_guard?: boolean;
  minors_prohibited?: boolean;
  on_call_type?: string;
  flexible_window_start?: string;
  flexible_duration_minutes?: number;
};
export type Shift = {
  id: string;
  employee_id: string;
  template_id: string | null;
  started_at: string;
  ended_at: string;
  published_at: string | null;
  published: boolean;
  kind: ShiftKind;
  color: string | null;
  note: string | null;
  flags: ShiftFlags;
  replaces_id: string | null;
  superseded_at: string | null;
  is_draft: boolean;
};
export type CalendarDayType = {
  id: string;
  employee_id: string;
  day: string;
  code: "P" | "ND" | "SW" | "TP5" | "HW";
};
export type AvailabilityEntry = {
  id: string;
  employee_id: string;
  day: string;
  status: "available" | "hours" | "unavailable";
  start_minute: number | null;
  end_minute: number | null;
};
export type ShiftTemplate = {
  id: string;
  name: string;
  start_minute: number;
  duration_minutes: number;
};
export type LeaveType = {
  id: string;
  code: string;
  name: string;
  category: "leave" | "custom";
  sort_order: number;
  allows_carry_over: boolean;
};
export type LeaveBalance = {
  id: string;
  employee_id: string;
  leave_type_id: string;
  leave_type_code?: string | null;
  leave_type_name?: string | null;
  category?: "leave" | "custom";
  allows_carry_over?: boolean;
  year: number;
  granted_days: number;
  used_days: number;
  remaining_days: number | null;
  unlimited: boolean;
  carry_over: boolean;
  period: "year" | "month" | null;
};
export type RequestLimits = {
  leave_years: number[];
  custom_years: number[];
  leave: LeaveBalance[];
  custom: LeaveBalance[];
  types: LeaveType[];
};
export type RequestLimitInput = {
  leave_type_id?: string;
  code?: string;
  year: number;
  granted_days: number;
  unlimited: boolean;
  carry_over: boolean;
  period: "year" | "month" | null;
};
export type DocumentCategory =
  | "benefit"
  | "certificate"
  | "diploma"
  | "employment_certificate"
  | "contract"
  | "other";
export type EmployeeDocument = {
  id: string;
  employee_id: string;
  category: DocumentCategory;
  name: string;
  description: string | null;
  note: string | null;
  original_filename: string;
  content_type: string;
  size_bytes: number;
  created_at: string | null;
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
  const isForm =
    typeof FormData !== "undefined" && options.body instanceof FormData;
  if (options.body && !isForm && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
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

export function postForm<T>(path: string, form: FormData) {
  return api<T>(path, { method: "POST", body: form });
}

async function fetchFileBlob(path: string): Promise<Blob> {
  const headers = new Headers();
  if (csrfToken) headers.set("X-CSRF-Token", csrfToken);
  const response = await fetch(`/api/v1${path}`, {
    credentials: "same-origin",
    headers,
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new ApiError(
      response.status,
      error.message || "Nie udało się pobrać pliku",
      error.fields || {},
    );
  }
  return response.blob();
}

export async function downloadFile(path: string, filename: string) {
  const blob = await fetchFileBlob(path);
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function mimeFromFilename(name: string): string | null {
  const lower = name.toLowerCase();
  if (lower.endsWith(".pdf")) return "application/pdf";
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  return null;
}

/** Zwraca object URL — caller musi wywołać URL.revokeObjectURL. */
export async function openFileUrl(
  path: string,
  filenameHint = "",
): Promise<{
  url: string;
  contentType: string;
}> {
  const blob = await fetchFileBlob(path);
  const hinted = mimeFromFilename(filenameHint);
  const contentType = blob.type || hinted || "application/octet-stream";
  const typed =
    blob.type || !hinted ? blob : new Blob([blob], { type: hinted });
  return {
    url: URL.createObjectURL(typed),
    contentType,
  };
}

let activePreferences: UserPreferences = { ...DEFAULT_USER_PREFERENCES };

export function setActivePreferences(prefs: UserPreferences | null | undefined) {
  activePreferences = prefs ? { ...prefs } : { ...DEFAULT_USER_PREFERENCES };
}

export function getActivePreferences() {
  return activePreferences;
}

function dateParts(value: Date) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Warsaw",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(value);
  const get = (type: string) => parts.find((p) => p.type === type)?.value || "";
  return { y: get("year"), m: get("month"), d: get("day") };
}

export function formatDateOnly(value: string | Date, prefs = activePreferences) {
  const date = typeof value === "string" ? new Date(value) : value;
  const { y, m, d } = dateParts(date);
  if (prefs.date_format === "ymd") return `${y}-${m}-${d}`;
  if (prefs.date_format === "mdy") return `${m}/${d}/${y}`;
  return `${d}.${m}.${y}`;
}

export function localDate(value: string) {
  return `${formatDateOnly(value)} ${localTime(value)}`;
}

export function localTime(value: string) {
  const hour12 = activePreferences.time_format === "h12";
  return new Intl.DateTimeFormat(hour12 ? "en-US" : "pl-PL", {
    hour: "2-digit",
    minute: "2-digit",
    hour12,
    timeZone: "Europe/Warsaw",
  }).format(new Date(value));
}

export function deviceDatetime(value: string) {
  const date = new Date(value);
  const pad = (number: number) => String(number).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
