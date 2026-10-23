import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useOutletContext } from "react-router-dom";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import {
  api,
  ApiError,
  localTime,
  post,
  type Employee,
  type Shift,
  type User,
} from "../api";
import { Button, Empty, Field, Message, Modal, Panel } from "../components";
import { useSetFilterSidebar } from "../layout/filterSidebarContext";
import { PageHeading } from "../layout/PageHeading";

function startOfWeek(value: Date) {
  const date = new Date(value);
  const day = (date.getDay() + 6) % 7;
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() - day);
  return date;
}

function addDays(value: Date, days: number) {
  const date = new Date(value);
  date.setDate(date.getDate() + days);
  return date;
}

function weekLabel(start: Date) {
  const end = addDays(start, 6);
  const format = new Intl.DateTimeFormat("pl-PL", {
    day: "numeric",
    month: "short",
  });
  return `${format.format(start)} – ${format.format(end)}`;
}

function toLocalInput(value: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}T${pad(value.getHours())}:${pad(value.getMinutes())}`;
}

export function SchedulesPage() {
  const { user } = useOutletContext<{ user: User }>();
  const client = useQueryClient();
  const canPlan = user.roles.some((r) =>
    ["manager", "hr", "admin"].includes(r),
  );
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));
  const [draftOnly, setDraftOnly] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [employeeId, setEmployeeId] = useState("");
  const [startedAt, setStartedAt] = useState("");
  const [endedAt, setEndedAt] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const weekEnd = addDays(weekStart, 7);
  const shifts = useQuery({
    queryKey: ["shifts", weekStart.toISOString(), canPlan],
    queryFn: () =>
      api<Shift[]>(
        `/shifts?from=${encodeURIComponent(weekStart.toISOString())}&to=${encodeURIComponent(weekEnd.toISOString())}${canPlan ? "&include_drafts=true" : ""}`,
      ),
  });
  const employees = useQuery({
    queryKey: ["employees", "shifts"],
    queryFn: () => api<Employee[]>("/employees"),
    enabled: canPlan,
  });
  const openCreate = (day?: Date, employee?: string) => {
    const start = day ? new Date(day) : new Date(weekStart);
    start.setHours(8, 0, 0, 0);
    const end = new Date(start);
    end.setHours(16, 0, 0, 0);
    setEmployeeId(employee || "");
    setStartedAt(toLocalInput(start));
    setEndedAt(toLocalInput(end));
    setModalOpen(true);
  };
  const create = useMutation({
    mutationFn: () =>
      post<Shift>("/shifts", {
        employee_id: employeeId,
        started_at: new Date(startedAt).toISOString(),
        ended_at: new Date(endedAt).toISOString(),
      }),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ["shifts"] });
      setModalOpen(false);
    },
  });
  const publish = useMutation({
    mutationFn: (shift_ids: string[]) =>
      post<Shift[]>("/shifts/publish", { shift_ids }),
    onSuccess: () => {
      setSelected([]);
      client.invalidateQueries({ queryKey: ["shifts"] });
    },
  });
  const drafts = shifts.data?.filter((shift) => !shift.published) || [];
  const visible =
    shifts.data?.filter((shift) => !draftOnly || !shift.published) || [];
  const nameOf = (id: string) => {
    const employee = employees.data?.find((row) => row.id === id);
    return employee
      ? `${employee.first_name} ${employee.last_name}`
      : id.slice(0, 8);
  };
  const toggle = (id: string) =>
    setSelected((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id],
    );
  const days = Array.from({ length: 7 }, (_, index) => addDays(weekStart, index));
  useSetFilterSidebar(
    () => (
      <>
        <p className="subtle">
          Okres tygodnia ustawiasz w nagłówku. Tu zawężysz widok publikacji.
        </p>
        <div className="filter-group">
          <h3>Widok</h3>
          {canPlan ? (
            <>
              <button
                type="button"
                className={`filter-item ${!draftOnly ? "active" : ""}`}
                onClick={() => setDraftOnly(false)}
              >
                Wszystkie zmiany
              </button>
              <button
                type="button"
                className={`filter-item ${draftOnly ? "active" : ""}`}
                onClick={() => setDraftOnly(true)}
              >
                Tylko nieopublikowane
              </button>
            </>
          ) : (
            <p className="subtle">Widzisz tylko opublikowany grafik.</p>
          )}
        </div>
      </>
    ),
    [canPlan, draftOnly],
  );
  return (
    <>
      <PageHeading
        title="Grafiki"
        description={
          canPlan
            ? "Kalendarz tygodnia. Dodawanie i edycja tylko w oknie modalnym."
            : "Opublikowany plan pracy na wybrany tydzień."
        }
        action={
          <div className="heading-actions">
            <div className="week-nav">
              <button
                className="icon-button"
                aria-label="Poprzedni tydzień"
                onClick={() => setWeekStart(addDays(weekStart, -7))}
              >
                <ChevronLeft size={18} />
              </button>
              <strong>{weekLabel(weekStart)}</strong>
              <button
                className="icon-button"
                aria-label="Następny tydzień"
                onClick={() => setWeekStart(addDays(weekStart, 7))}
              >
                <ChevronRight size={18} />
              </button>
            </div>
            {canPlan && (
              <>
                {drafts.length > 0 && (
                  <Button
                    busy={publish.isPending}
                    onClick={() =>
                      publish.mutate(
                        selected.length
                          ? selected
                          : drafts.map((shift) => shift.id),
                      )
                    }
                  >
                    {selected.length
                      ? `Opublikuj (${selected.length})`
                      : "Opublikuj szkice"}
                  </Button>
                )}
                <Button onClick={() => openCreate()}>
                  <Plus size={16} /> Dodaj zmianę
                </Button>
              </>
            )}
          </div>
        }
      />
      {publish.isError && (
        <Message>{(publish.error as ApiError).message}</Message>
      )}
      <Panel title="Kalendarz tygodnia">
        {shifts.isPending ? (
          <p className="subtle">Ładowanie grafiku…</p>
        ) : shifts.isError ? (
          <Message>Nie udało się pobrać grafiku.</Message>
        ) : (
          <div className="schedule-week">
            {days.map((day) => {
              const dayStart = day.getTime();
              const dayEnd = addDays(day, 1).getTime();
              const dayShifts = visible.filter((shift) => {
                const start = new Date(shift.started_at).getTime();
                const end = new Date(shift.ended_at).getTime();
                return start < dayEnd && end > dayStart;
              });
              return (
                <div className="schedule-day" key={day.toISOString()}>
                  <div className="schedule-day-head">
                    <strong>
                      {day.toLocaleDateString("pl-PL", {
                        weekday: "short",
                        day: "numeric",
                        month: "short",
                      })}
                    </strong>
                    {canPlan && (
                      <button
                        className="icon-button"
                        aria-label={`Dodaj zmianę ${day.toLocaleDateString("pl-PL")}`}
                        onClick={() => openCreate(day)}
                      >
                        <Plus size={16} />
                      </button>
                    )}
                  </div>
                  {dayShifts.length ? (
                    <div className="schedule-list">
                      {dayShifts.map((shift) => (
                        <div
                          className={`schedule-card ${shift.published ? "published" : "draft"}`}
                          key={shift.id}
                        >
                          {canPlan && !shift.published && (
                            <label className="schedule-check">
                              <input
                                type="checkbox"
                                checked={selected.includes(shift.id)}
                                onChange={() => toggle(shift.id)}
                              />
                              <span className="sr-only">Zaznacz szkic</span>
                            </label>
                          )}
                          <div>
                            <strong>
                              {canPlan
                                ? nameOf(shift.employee_id)
                                : "Twoja zmiana"}
                            </strong>
                            <small>
                              {localTime(shift.started_at)}–
                              {localTime(shift.ended_at)}
                            </small>
                          </div>
                          <span
                            className={`table-status ${shift.published ? "active" : "open"}`}
                          >
                            {shift.published ? "Opublikowany" : "Szkic"}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <button
                      className="schedule-empty-btn"
                      disabled={!canPlan}
                      onClick={() => canPlan && openCreate(day)}
                    >
                      {canPlan ? "Dodaj zmianę" : "Brak zmian"}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
        {!shifts.isPending && !visible.length && (
          <Empty title="Brak przydziałów w tym tygodniu">
            {canPlan
              ? "Kliknij dzień lub „Dodaj zmianę”, aby otworzyć modal."
              : "Gdy grafik zostanie opublikowany, zobaczysz go tutaj."}
          </Empty>
        )}
      </Panel>
      {modalOpen && canPlan && (
        <Modal
          title="Nowa zmiana"
          description="Szkic trafi do kalendarza. Opublikuj go, aby był widoczny dla pracownika."
          size="wide"
          onClose={() => setModalOpen(false)}
          footer={
            <>
              {create.isError && (
                <Message>{(create.error as ApiError).message}</Message>
              )}
              <Button
                type="button"
                variant="quiet"
                onClick={() => setModalOpen(false)}
              >
                Anuluj
              </Button>
              <Button
                type="submit"
                form="create-shift-form"
                busy={create.isPending}
              >
                Zapisz szkic
              </Button>
            </>
          }
        >
          <form
            id="create-shift-form"
            className="form-grid modal-form"
            onSubmit={(event) => {
              event.preventDefault();
              create.mutate();
            }}
          >
            <Field label="Pracownik">
              <select
                value={employeeId}
                onChange={(event) => setEmployeeId(event.target.value)}
                required
              >
                <option value="">Wybierz pracownika</option>
                {employees.data?.map((employee) => (
                  <option key={employee.id} value={employee.id}>
                    {employee.first_name} {employee.last_name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Początek">
              <input
                type="datetime-local"
                value={startedAt}
                onChange={(event) => setStartedAt(event.target.value)}
                required
              />
            </Field>
            <Field label="Koniec">
              <input
                type="datetime-local"
                value={endedAt}
                onChange={(event) => setEndedAt(event.target.value)}
                required
              />
            </Field>
          </form>
        </Modal>
      )}
    </>
  );
}
