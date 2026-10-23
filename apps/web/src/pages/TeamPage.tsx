import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { createPortal } from "react-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useOutletContext } from "react-router-dom";
import {
  AlertCircle,
  Check,
  CheckCircle2,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  Send,
  Users,
} from "lucide-react";
import {
  api,
  ApiError,
  del,
  patch,
  post,
  type Employee,
  type Position,
  type Tag,
  type User,
} from "../api";
import { Button, Empty, Field, Message, Modal } from "../components";
import { FilterGroup } from "../layout/FilterGroup";
import { ManageCatalogModal } from "../layout/ManageCatalogModal";
import { TagFormModal } from "../layout/TagFormModal";
import { useSetFilterSidebar } from "../layout/filterSidebarContext";
import { DEFAULT_TAG_COLOR } from "../tags";

const ROLE_OPTIONS = [
  {
    code: "employee",
    label: "Pracownik",
    hint: "Rejestruje czas i składa wnioski w swoim zakresie.",
  },
  {
    code: "manager",
    label: "Kierownik",
    hint: "Zarządza bezpośrednimi podwładnymi w zespole.",
  },
  {
    code: "hr",
    label: "HR",
    hint: "Zarządza kartami, grafikiem i wnioskami w organizacji.",
  },
  {
    code: "admin",
    label: "Administrator",
    hint: "Pełny dostęp do organizacji, w tym kont i uprawnień.",
  },
] as const;

function roleLabel(code: string) {
  return ROLE_OPTIONS.find((r) => r.code === code)?.label || code;
}

const employeeSchema = z.object({
  first_name: z.string().min(1, "Podaj imię"),
  last_name: z.string().min(1, "Podaj nazwisko"),
  email: z.string().email("Podaj poprawny e-mail"),
  phone: z.string().optional(),
  position_id: z.string().optional(),
  supervisor_id: z.string().optional(),
  role: z.enum(["employee", "manager", "hr", "admin"], {
    message: "Wybierz rolę",
  }),
});
type EmployeeValues = z.infer<typeof employeeSchema>;

type AuthUser = { id: string; email: string; roles?: string[] };

const CREATE_DEFAULTS: EmployeeValues = {
  first_name: "",
  last_name: "",
  email: "",
  phone: "",
  position_id: "",
  supervisor_id: "",
  role: "employee",
};

function requiredLabel(text: string) {
  return (
    <>
      {text} <span className="req-mark" aria-hidden>*</span>
    </>
  );
}

function statusLabel(status: Employee["status"]) {
  if (status === "invited") return "Zaproszony";
  if (status === "inactive") return "Nieaktywny";
  return "Aktywny";
}

function EmployeeStatusIcon({ status }: { status: Employee["status"] }) {
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

function matchesQuery(label: string, query: string) {
  if (!query.trim()) return true;
  return label.toLowerCase().includes(query.trim().toLowerCase());
}

export function TeamPage() {
  const { user } = useOutletContext<{ user: User }>();
  const client = useQueryClient();
  const canEdit = user.roles.some((r) => ["admin", "hr"].includes(r));
  const isAdmin = user.roles.includes("admin");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<
    "all" | "active" | "invited" | "inactive"
  >("active");
  const [roleFilter, setRoleFilter] = useState<string>("");
  const [tagFilter, setTagFilter] = useState<string>("");
  const [positionFilter, setPositionFilter] = useState<string>("");
  const [showForm, setShowForm] = useState(false);
  /** null = zamknięty; 'new' = dodawanie; Tag = edycja */
  const [tagForm, setTagForm] = useState<"new" | Tag | null>(null);
  const [showPosition, setShowPosition] = useState(false);
  const [manageTags, setManageTags] = useState(false);
  const [managePositions, setManagePositions] = useState(false);
  const [selected, setSelected] = useState<Employee | null>(null);
  const [positionName, setPositionName] = useState("");
  const [createTagIds, setCreateTagIds] = useState<string[]>([]);
  const [selectTagId, setSelectTagId] = useState<string | null>(null);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<
    null | { type: "delete" | "deactivate"; employee: Employee }
  >(null);
  const [inviteLink, setInviteLink] = useState<string | null>(null);

  const query = useMemo(() => {
    const params = new URLSearchParams();
    if (search.trim()) params.set("q", search.trim());
    if (status !== "all") params.set("status", status);
    if (roleFilter) params.set("role", roleFilter);
    if (tagFilter) params.set("tag_id", tagFilter);
    if (positionFilter) params.set("position_id", positionFilter);
    params.set("limit", "100");
    return params.toString();
  }, [search, status, roleFilter, tagFilter, positionFilter]);

  const employees = useQuery({
    queryKey: ["employees", query],
    queryFn: () => api<Employee[]>(`/employees?${query}`),
  });
  const allForMeta = useQuery({
    queryKey: ["employees", "meta"],
    queryFn: () => api<Employee[]>("/employees?status=all&limit=100"),
  });
  const tags = useQuery({
    queryKey: ["tags"],
    queryFn: () => api<Tag[]>("/tags"),
  });
  const positions = useQuery({
    queryKey: ["positions"],
    queryFn: () => api<Position[]>("/positions"),
  });
  const users = useQuery({
    queryKey: ["users"],
    queryFn: () => api<AuthUser[]>("/auth/users"),
    enabled: isAdmin,
  });

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm<EmployeeValues>({
    resolver: zodResolver(employeeSchema),
    defaultValues: CREATE_DEFAULTS,
  });
  const createRole = watch("role") || "employee";
  const createRoleHint =
    ROLE_OPTIONS.find((r) => r.code === createRole)?.hint || "";

  useEffect(() => {
    if (!showForm) return;
    reset(CREATE_DEFAULTS);
    setCreateTagIds([]);
  }, [showForm, reset]);

  const openCreateForm = () => {
    reset(CREATE_DEFAULTS);
    setCreateTagIds([]);
    setShowForm(true);
  };

  const create = useMutation({
    mutationFn: ({
      values,
    }: {
      values: EmployeeValues;
      andNext: boolean;
    }) => {
      const phoneDigits = (values.phone || "").replace(/\s+/g, "").trim();
      return post<Employee>("/employees", {
        first_name: values.first_name,
        last_name: values.last_name,
        email: values.email.trim(),
        phone: phoneDigits
          ? phoneDigits.startsWith("+")
            ? phoneDigits
            : `+48${phoneDigits}`
          : null,
        position_id: values.position_id || null,
        supervisor_id: values.supervisor_id || null,
        tag_ids: createTagIds,
        role: values.role,
      });
    },
    onSuccess: (_row, variables) => {
      client.invalidateQueries({ queryKey: ["employees"] });
      client.invalidateQueries({ queryKey: ["users"] });
      client.invalidateQueries({ queryKey: ["me"] });
      if (variables.andNext) {
        reset(CREATE_DEFAULTS);
        setCreateTagIds([]);
      } else {
        setShowForm(false);
        reset(CREATE_DEFAULTS);
      }
    },
  });

  const submitCreate = (andNext: boolean) =>
    handleSubmit((values) => create.mutate({ values, andNext }));
  const saveTag = useMutation({
    mutationFn: (values: {
      name: string;
      color: string;
      is_informational: boolean;
    }) => {
      if (tagForm && tagForm !== "new") {
        return patch<Tag>(`/tags/${tagForm.id}`, values);
      }
      return post<Tag>("/tags", values);
    },
    onSuccess: (tag) => {
      const wasCreate = tagForm === "new";
      setTagForm(null);
      setCatalogError(null);
      client.invalidateQueries({ queryKey: ["tags"] });
      client.invalidateQueries({ queryKey: ["employees"] });
      if (wasCreate) {
        setCreateTagIds((ids) =>
          ids.includes(tag.id) ? ids : [...ids, tag.id],
        );
        setSelectTagId(tag.id);
      }
    },
    onError: (err) => setCatalogError((err as ApiError).message),
  });

  const openNewTag = () => {
    setCatalogError(null);
    setTagForm("new");
  };
  const addPosition = useMutation({
    mutationFn: (name: string) => post<Position>("/positions", { name }),
    onSuccess: () => {
      setPositionName("");
      setShowPosition(false);
      setCatalogError(null);
      client.invalidateQueries({ queryKey: ["positions"] });
    },
    onError: (err) => setCatalogError((err as ApiError).message),
  });
  const deleteTags = useMutation({
    mutationFn: async (ids: string[]) => {
      for (const id of ids) await del(`/tags/${id}`);
    },
    onSuccess: () => {
      setCatalogError(null);
      setTagFilter("");
      client.invalidateQueries({ queryKey: ["tags"] });
      client.invalidateQueries({ queryKey: ["employees"] });
    },
    onError: (err) => setCatalogError((err as ApiError).message),
  });
  const deletePositions = useMutation({
    mutationFn: async (ids: string[]) => {
      for (const id of ids) await del(`/positions/${id}`);
    },
    onSuccess: () => {
      setCatalogError(null);
      setPositionFilter("");
      client.invalidateQueries({ queryKey: ["positions"] });
      client.invalidateQueries({ queryKey: ["employees"] });
    },
    onError: (err) => setCatalogError((err as ApiError).message),
  });

  const deactivateEmployee = useMutation({
    mutationFn: (id: string) =>
      patch<Employee>(`/employees/${id}`, { active: false }),
    onSuccess: () => {
      setConfirmAction(null);
      client.invalidateQueries({ queryKey: ["employees"] });
    },
  });
  const deleteEmployee = useMutation({
    mutationFn: (id: string) => del(`/employees/${id}`),
    onSuccess: (_data, id) => {
      setConfirmAction(null);
      if (selected?.id === id) setSelected(null);
      client.invalidateQueries({ queryKey: ["employees"] });
      client.invalidateQueries({ queryKey: ["users"] });
    },
  });
  const resendInvite = useMutation({
    mutationFn: (id: string) =>
      post<{ ok: boolean; email_sent: boolean; invite_url: string | null }>(
        `/employees/${id}/resend-invite`,
        {},
      ),
    onSuccess: (result) => {
      client.invalidateQueries({ queryKey: ["employees"] });
      if (result.invite_url) setInviteLink(result.invite_url);
    },
  });

  const toggleCreateTag = (id: string) => {
    setCreateTagIds((ids) =>
      ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id],
    );
  };

  const count = employees.data?.length ?? 0;

  useSetFilterSidebar(
    () => (
      <>
        <div className="filter-search">
          <Search size={16} />
          <input
            aria-label="Szukaj pracownika"
            placeholder="Szukaj…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <FilterGroup title="Pracownicy" storageKey="timelogic.fg.pracownicy">
          {(
            [
              ["all", "Wszyscy"],
              ["active", "Aktywni"],
              ["invited", "Zaproszeni"],
              ["inactive", "Nieaktywni"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              className={`filter-item ${status === value ? "active" : ""}`}
              onClick={() => setStatus(value)}
            >
              {label}
            </button>
          ))}
        </FilterGroup>

        <FilterGroup
          title="Role"
          storageKey="timelogic.fg.role"
          searchable
          filterItems={(q) => (
            <>
              {matchesQuery("Wszystkie", q) && (
                <button
                  type="button"
                  className={`filter-item ${roleFilter === "" ? "active" : ""}`}
                  onClick={() => setRoleFilter("")}
                >
                  Wszystkie
                </button>
              )}
              {ROLE_OPTIONS.filter((role) => matchesQuery(role.label, q)).map(
                (role) => (
                  <button
                    key={role.code}
                    type="button"
                    className={`filter-item ${roleFilter === role.code ? "active" : ""}`}
                    onClick={() =>
                      setRoleFilter((current) =>
                        current === role.code ? "" : role.code,
                      )
                    }
                  >
                    {role.label}
                  </button>
                ),
              )}
            </>
          )}
        >
          {null}
        </FilterGroup>

        <FilterGroup
          title="Tagi"
          storageKey="timelogic.fg.tagi"
          searchable
          manageable={canEdit}
          addLabel="Dodaj tag"
          onAdd={openNewTag}
          onManage={() => {
            setCatalogError(null);
            setManageTags(true);
          }}
          filterItems={(q) => (
            <>
              {matchesQuery("Wszystkie", q) && (
                <button
                  type="button"
                  className={`filter-item ${tagFilter === "" ? "active" : ""}`}
                  onClick={() => setTagFilter("")}
                >
                  Wszystkie
                </button>
              )}
              {(tags.data || [])
                .filter((tag) => matchesQuery(tag.name, q))
                .map((tag) => (
                  <button
                    key={tag.id}
                    type="button"
                    className={`filter-item ${tagFilter === tag.id ? "active" : ""}`}
                    onClick={() =>
                      setTagFilter((current) =>
                        current === tag.id ? "" : tag.id,
                      )
                    }
                  >
                    <span
                      className="tag-color-dot"
                      style={{ background: tag.color || DEFAULT_TAG_COLOR }}
                      aria-hidden
                    />
                    {tag.name}
                    {tag.is_informational ? (
                      <span className="subtle"> · info</span>
                    ) : null}
                  </button>
                ))}
              {!tags.data?.length && (
                <p className="subtle">Brak tagów.</p>
              )}
            </>
          )}
        >
          {null}
        </FilterGroup>

        <FilterGroup
          title="Stanowiska"
          storageKey="timelogic.fg.stanowiska"
          searchable
          manageable={canEdit}
          addLabel="Dodaj stanowisko"
          onAdd={() => {
            setCatalogError(null);
            setShowPosition(true);
          }}
          onManage={() => {
            setCatalogError(null);
            setManagePositions(true);
          }}
          filterItems={(q) => (
            <>
              {matchesQuery("Wszystkie", q) && (
                <button
                  type="button"
                  className={`filter-item ${positionFilter === "" ? "active" : ""}`}
                  onClick={() => setPositionFilter("")}
                >
                  Wszystkie
                </button>
              )}
              {(positions.data || [])
                .filter((row) => matchesQuery(row.name, q))
                .map((row) => (
                  <button
                    key={row.id}
                    type="button"
                    className={`filter-item ${positionFilter === row.id ? "active" : ""}`}
                    onClick={() =>
                      setPositionFilter((current) =>
                        current === row.id ? "" : row.id,
                      )
                    }
                  >
                    {row.name}
                  </button>
                ))}
              {!positions.data?.length && (
                <p className="subtle">Brak stanowisk.</p>
              )}
            </>
          )}
        >
          {null}
        </FilterGroup>

      </>
    ),
    [
      search,
      status,
      roleFilter,
      tagFilter,
      positionFilter,
      canEdit,
      tags.data,
      positions.data,
    ],
  );

  return (
    <>
      <div className="team-heading">
        <div>
          <h1>Twój zespół ({count})</h1>
          <p className="subtle">Karty pracowników, role i tagi.</p>
        </div>
        {canEdit && (
          <Button onClick={openCreateForm}>
            <Plus size={16} /> Dodaj
          </Button>
        )}
      </div>

        {employees.isPending ? (
          <p className="subtle">Ładowanie zespołu…</p>
        ) : employees.isError ? (
          <Message>Nie udało się pobrać pracowników.</Message>
        ) : employees.data?.length ? (
          <div className="table-scroll team-table">
            <table>
              <thead>
                <tr>
                  <th>Imię i nazwisko</th>
                  <th>Rola i tagi</th>
                  <th>Stanowisko</th>
                  <th>Przełożony</th>
                  <th className="col-status">Status</th>
                  <th className="col-actions"></th>
                </tr>
              </thead>
              <tbody>
                {employees.data.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <div className="person-cell">
                        <span className="avatar">
                          {row.first_name[0]}
                          {row.last_name[0]}
                        </span>
                        <div>
                          <strong>
                            {row.first_name} {row.last_name}
                          </strong>
                          <span className="subtle">
                            {row.employee_number}
                            {row.email ? ` · ${row.email}` : ""}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div className="badge-row">
                        {row.roles?.map((code) => (
                          <span className="role-badge" key={code}>
                            {roleLabel(code)}
                          </span>
                        ))}
                        {row.tags?.map((tag) => (
                          <span
                            className={`tag-badge${tag.is_informational ? " is-info" : ""}`}
                            key={tag.id}
                            style={
                              {
                                "--tag-color": tag.color || DEFAULT_TAG_COLOR,
                              } as CSSProperties
                            }
                          >
                            {tag.name}
                          </span>
                        ))}
                        {!row.roles?.length && !row.tags?.length && (
                          <span className="subtle">—</span>
                        )}
                      </div>
                    </td>
                    <td>{row.position || "—"}</td>
                    <td>{row.supervisor_name || "—"}</td>
                    <td className="col-status">
                      <EmployeeStatusIcon status={row.status} />
                    </td>
                    <td className="col-actions">
                      <EmployeeRowActions
                        employee={row}
                        canEdit={canEdit}
                        busy={
                          deactivateEmployee.isPending ||
                          deleteEmployee.isPending ||
                          resendInvite.isPending
                        }
                        onEdit={() => setSelected(row)}
                        onResend={() => resendInvite.mutate(row.id)}
                        onDeactivate={() =>
                          setConfirmAction({ type: "deactivate", employee: row })
                        }
                        onDelete={() =>
                          setConfirmAction({ type: "delete", employee: row })
                        }
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty title="Brak wyników">
            Zmień filtry albo dodaj pierwszą kartę pracownika.
          </Empty>
        )}

      {showForm && canEdit && (
        <Modal
          title="Dodaj pracownika"
          size="wide"
          onClose={() => setShowForm(false)}
          footer={
            <>
              {create.isError && (
                <Message>{(create.error as ApiError).message}</Message>
              )}
              <Button
                type="button"
                variant="quiet"
                onClick={() => setShowForm(false)}
              >
                Anuluj
              </Button>
              <Button
                type="button"
                variant="quiet"
                busy={create.isPending}
                onClick={() => void submitCreate(true)()}
              >
                Zapisz i dodaj następnego
              </Button>
              <Button
                type="button"
                busy={create.isPending}
                onClick={() => void submitCreate(false)()}
              >
                Zapisz
              </Button>
            </>
          }
        >
          <form
            id="create-employee-form"
            className="employee-create-form modal-form"
            onSubmit={(e) => {
              e.preventDefault();
              void submitCreate(false)();
            }}
          >
            <div className="field-block">
              <span className="field-block-label">
                {requiredLabel("Imię i nazwisko")}
              </span>
              <div className="stacked-inputs">
                <input
                  {...register("first_name")}
                  placeholder="Imię"
                  aria-label="Imię"
                  required
                />
                <input
                  {...register("last_name")}
                  placeholder="Nazwisko"
                  aria-label="Nazwisko"
                  required
                />
              </div>
              {(errors.first_name || errors.last_name) && (
                <span className="field-error">
                  {errors.first_name?.message || errors.last_name?.message}
                </span>
              )}
            </div>

            <div className="contact-row">
              <Field
                label={requiredLabel("E-mail")}
                error={errors.email?.message}
              >
                <input
                  type="email"
                  {...register("email")}
                  placeholder="karolina@example.com"
                  required
                />
              </Field>
              <Field label="Telefon">
                <div className="phone-input">
                  <span className="phone-prefix">+48</span>
                  <input
                    {...register("phone")}
                    placeholder="123 123 123"
                    inputMode="tel"
                  />
                </div>
              </Field>
            </div>

            <Field
              label={
                <span className="field-label-row">
                  Stanowisko domyślne
                  <span className="field-label-actions">
                    <button
                      type="button"
                      className="filter-link"
                      onClick={() => setShowPosition(true)}
                    >
                      Dodaj
                    </button>
                    <span className="subtle"> albo </span>
                    <button
                      type="button"
                      className="filter-link"
                      onClick={() => setManagePositions(true)}
                    >
                      Zarządzaj
                    </button>
                  </span>
                </span>
              }
            >
              <select {...register("position_id")}>
                <option value="">Wybierz lub dodaj nowe</option>
                {positions.data?.map((row) => (
                  <option key={row.id} value={row.id}>
                    {row.name}
                  </option>
                ))}
              </select>
            </Field>

            <Field
              label={
                <span className="field-label-row">
                  Tagi
                  <span className="field-label-actions">
                    <button
                      type="button"
                      className="filter-link"
                      onClick={openNewTag}
                    >
                      Dodaj
                    </button>
                    <span className="subtle"> albo </span>
                    <button
                      type="button"
                      className="filter-link"
                      onClick={() => setManageTags(true)}
                    >
                      Zarządzaj
                    </button>
                  </span>
                </span>
              }
            >
              <div className="tag-picker">
                {tags.data?.map((tag) => {
                  const selected = createTagIds.includes(tag.id);
                  return (
                    <label
                      key={tag.id}
                      className={`tag-pick${selected ? " is-selected" : ""}`}
                    >
                      <input
                        type="checkbox"
                        className="sr-only"
                        checked={selected}
                        onChange={() => toggleCreateTag(tag.id)}
                      />
                      {selected ? (
                        <span className="tag-pick-check" aria-hidden>
                          <Check size={12} strokeWidth={3} />
                        </span>
                      ) : null}
                      <span
                        className="tag-color-dot"
                        style={{
                          background: tag.color || DEFAULT_TAG_COLOR,
                        }}
                        aria-hidden
                      />
                      {tag.name}
                      {tag.is_informational ? (
                        <span className="subtle"> · info</span>
                      ) : null}
                    </label>
                  );
                })}
                {!tags.data?.length && (
                  <span className="subtle">Wybierz lub dodaj nowe</span>
                )}
              </div>
            </Field>

            <Field
              label={requiredLabel("Rola")}
              error={errors.role?.message}
            >
              <select {...register("role")} required>
                {(isAdmin
                  ? ROLE_OPTIONS
                  : ROLE_OPTIONS.filter((role) => role.code === "employee")
                ).map((role) => (
                  <option key={role.code} value={role.code}>
                    {role.label}
                  </option>
                ))}
              </select>
              <span className="field-hint">{createRoleHint}</span>
            </Field>

            <Field label="Bezpośredni przełożony">
              <select {...register("supervisor_id")}>
                <option value="">Wybierz przełożonego</option>
                {(allForMeta.data || [])
                  .filter((e) => e.active)
                  .map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.first_name} {e.last_name}
                    </option>
                  ))}
              </select>
            </Field>
          </form>
        </Modal>
      )}

      {tagForm && canEdit && (
        <TagFormModal
          tag={tagForm === "new" ? null : tagForm}
          layer={manageTags || managePositions ? 2 : 1}
          busy={saveTag.isPending}
          error={catalogError}
          onClose={() => {
            setTagForm(null);
            setCatalogError(null);
          }}
          onSave={async (values) => {
            await saveTag.mutateAsync(values);
          }}
        />
      )}

      {showPosition && canEdit && (
        <Modal
          title="Nowe stanowisko"
          description="Stanowiska możesz potem przypisać do kart pracowników."
          layer={manageTags || managePositions ? 2 : 1}
          onClose={() => setShowPosition(false)}
          footer={
            <>
              {addPosition.isError && (
                <Message>{(addPosition.error as ApiError).message}</Message>
              )}
              <Button
                type="button"
                variant="quiet"
                onClick={() => setShowPosition(false)}
              >
                Anuluj
              </Button>
              <Button
                type="submit"
                form="create-position-form"
                busy={addPosition.isPending}
              >
                Zapisz stanowisko
              </Button>
            </>
          }
        >
          <form
            id="create-position-form"
            className="modal-form"
            onSubmit={(e) => {
              e.preventDefault();
              if (positionName.trim()) addPosition.mutate(positionName.trim());
            }}
          >
            <Field label="Nazwa stanowiska">
              <input
                value={positionName}
                onChange={(e) => setPositionName(e.target.value)}
                required
                autoFocus
              />
            </Field>
          </form>
        </Modal>
      )}

      {manageTags && canEdit && (
        <ManageCatalogModal
          title="Zarządzaj tagami"
          items={tags.data || []}
          busy={deleteTags.isPending}
          error={catalogError}
          onClose={() => setManageTags(false)}
          onAddClick={openNewTag}
          onEdit={(item) => {
            const tag = (tags.data || []).find((row) => row.id === item.id);
            if (tag) {
              setCatalogError(null);
              setTagForm(tag);
            }
          }}
          onDelete={async (ids) => {
            await deleteTags.mutateAsync(ids);
          }}
        />
      )}

      {managePositions && canEdit && (
        <ManageCatalogModal
          title="Zarządzaj stanowiskami"
          items={positions.data || []}
          busy={deletePositions.isPending}
          error={catalogError}
          onClose={() => setManagePositions(false)}
          onAddClick={() => setShowPosition(true)}
          onDelete={async (ids) => {
            await deletePositions.mutateAsync(ids);
          }}
        />
      )}

      {selected && (
        <EmployeeEditor
          key={selected.id}
          employee={selected}
          tags={tags.data || []}
          positions={positions.data || []}
          peers={(allForMeta.data || []).filter((e) => e.id !== selected.id)}
          users={users.data || []}
          canEdit={canEdit}
          isAdmin={isAdmin}
          selectTagId={selectTagId}
          onAddTag={openNewTag}
          onClose={() => setSelected(null)}
          onSaved={(row) => setSelected(row)}
        />
      )}

      {confirmAction && (
        <Modal
          title={
            confirmAction.type === "delete"
              ? "Usuń z systemu"
              : "Dezaktywuj konto"
          }
          description={
            confirmAction.type === "delete"
              ? `Na zawsze usuniesz kartę ${confirmAction.employee.first_name} ${confirmAction.employee.last_name} oraz powiązane konto. Tej operacji nie cofniesz.`
              : `Konto ${confirmAction.employee.first_name} ${confirmAction.employee.last_name} zostanie dezaktywowane i utraci dostęp do aplikacji.`
          }
          layer={1}
          onClose={() => setConfirmAction(null)}
          footer={
            <>
              {(deleteEmployee.isError || deactivateEmployee.isError) && (
                <Message>
                  {(
                    (deleteEmployee.error ||
                      deactivateEmployee.error) as ApiError
                  ).message}
                </Message>
              )}
              <Button
                type="button"
                variant="quiet"
                onClick={() => setConfirmAction(null)}
              >
                Anuluj
              </Button>
              <Button
                type="button"
                variant={confirmAction.type === "delete" ? "danger" : "primary"}
                busy={
                  deleteEmployee.isPending || deactivateEmployee.isPending
                }
                onClick={() => {
                  if (confirmAction.type === "delete") {
                    deleteEmployee.mutate(confirmAction.employee.id);
                  } else {
                    deactivateEmployee.mutate(confirmAction.employee.id);
                  }
                }}
              >
                {confirmAction.type === "delete"
                  ? "Usuń na zawsze"
                  : "Dezaktywuj"}
              </Button>
            </>
          }
        >
          <p className="confirm-target">
            {confirmAction.employee.email
              ? confirmAction.employee.email
              : confirmAction.employee.employee_number}
          </p>
        </Modal>
      )}

      {inviteLink && (
        <Modal
          title="Link zaproszenia"
          description="Mail nie został wysłany (brak SMTP). Skopiuj link i prześlij go pracownikowi."
          layer={1}
          onClose={() => setInviteLink(null)}
          footer={
            <>
              <Button
                type="button"
                variant="quiet"
                onClick={() => setInviteLink(null)}
              >
                Zamknij
              </Button>
              <Button
                type="button"
                onClick={() => {
                  void navigator.clipboard.writeText(inviteLink);
                }}
              >
                Kopiuj link
              </Button>
            </>
          }
        >
          <input
            className="invite-link-input"
            readOnly
            value={inviteLink}
            onFocus={(e) => e.target.select()}
          />
        </Modal>
      )}
    </>
  );
}

function EmployeeRowActions({
  employee,
  canEdit,
  busy,
  onEdit,
  onResend,
  onDeactivate,
  onDelete,
}: {
  employee: Employee;
  canEdit: boolean;
  busy: boolean;
  onEdit: () => void;
  onResend: () => void;
  onDeactivate: () => void;
  onDelete: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<{
    top: number;
    left: number;
    openUp: boolean;
  } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const updatePosition = () => {
    const trigger = triggerRef.current;
    const menu = menuRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const menuHeight = menu?.offsetHeight || 140;
    const menuWidth = menu?.offsetWidth || 220;
    const gap = 6;
    const spaceBelow = window.innerHeight - rect.bottom - gap;
    const openUp = spaceBelow < menuHeight && rect.top > spaceBelow;
    const top = openUp ? rect.top - gap - menuHeight : rect.bottom + gap;
    const left = Math.min(
      Math.max(8, rect.right - menuWidth),
      window.innerWidth - menuWidth - 8,
    );
    setCoords({
      top: Math.max(8, Math.min(top, window.innerHeight - menuHeight - 8)),
      left,
      openUp,
    });
  };

  useLayoutEffect(() => {
    if (!open) {
      setCoords(null);
      return;
    }
    updatePosition();
  }, [open, employee.status]);

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        menuRef.current?.contains(target) ||
        triggerRef.current?.contains(target)
      ) {
        return;
      }
      setOpen(false);
    };
    const onReposition = () => updatePosition();
    document.addEventListener("mousedown", onPointer);
    window.addEventListener("resize", onReposition);
    window.addEventListener("scroll", onReposition, true);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      window.removeEventListener("resize", onReposition);
      window.removeEventListener("scroll", onReposition, true);
    };
  }, [open]);

  const menu = open
    ? createPortal(
        <div
          ref={menuRef}
          className={`row-actions-menu${coords?.openUp ? " is-up" : ""}`}
          role="menu"
          style={
            coords
              ? { top: coords.top, left: coords.left, visibility: "visible" }
              : { visibility: "hidden", top: 0, left: 0 }
          }
        >
          {employee.status === "invited" && (
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                onResend();
              }}
            >
              Wyślij zaproszenie ponownie
            </button>
          )}
          {employee.status !== "inactive" && (
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                onDeactivate();
              }}
            >
              Dezaktywuj konto
            </button>
          )}
          <button
            type="button"
            role="menuitem"
            className="danger"
            onClick={() => {
              setOpen(false);
              onDelete();
            }}
          >
            Usuń z systemu
          </button>
        </div>,
        document.body,
      )
    : null;

  return (
    <div className="row-actions">
      <button
        type="button"
        className="icon-button"
        aria-label="Edytuj"
        onClick={onEdit}
      >
        <Pencil size={16} />
      </button>
      {canEdit ? (
        <>
          <button
            ref={triggerRef}
            type="button"
            className={`icon-button ${open ? "active" : ""}`}
            aria-label="Więcej opcji"
            aria-expanded={open}
            disabled={busy}
            onClick={() => setOpen((v) => !v)}
          >
            <MoreHorizontal size={16} />
          </button>
          {menu}
        </>
      ) : null}
    </div>
  );
}

function EmployeeEditor({
  employee,
  tags,
  positions,
  peers,
  users,
  canEdit,
  isAdmin,
  selectTagId,
  onAddTag,
  onClose,
  onSaved,
}: {
  employee: Employee;
  tags: Tag[];
  positions: Position[];
  peers: Employee[];
  users: AuthUser[];
  canEdit: boolean;
  isAdmin: boolean;
  selectTagId: string | null;
  onAddTag: () => void;
  onClose: () => void;
  onSaved: (row: Employee) => void;
}) {
  const client = useQueryClient();
  const [firstName, setFirstName] = useState(employee.first_name);
  const [lastName, setLastName] = useState(employee.last_name);
  const [positionId, setPositionId] = useState(employee.position_id || "");
  const [userId, setUserId] = useState(employee.user_id || "");
  const [supervisorId, setSupervisorId] = useState(
    employee.supervisor_id || "",
  );
  const [role, setRole] = useState(employee.roles?.[0] || "employee");
  const [tagIds, setTagIds] = useState<string[]>(employee.tag_ids || []);
  const [active, setActive] = useState(employee.active);
  const [hiredOn, setHiredOn] = useState(employee.hired_on || "");
  const [endedOn, setEndedOn] = useState(employee.ended_on || "");

  useEffect(() => {
    if (!selectTagId) return;
    setTagIds((ids) =>
      ids.includes(selectTagId) ? ids : [...ids, selectTagId],
    );
  }, [selectTagId]);

  const save = useMutation({
    mutationFn: () =>
      patch<Employee>(`/employees/${employee.id}`, {
        first_name: firstName,
        last_name: lastName,
        position_id: positionId || null,
        user_id: userId || null,
        supervisor_id: supervisorId || null,
        tag_ids: tagIds,
        role: isAdmin && userId ? role : undefined,
        active,
        hired_on: hiredOn || null,
        ended_on: endedOn || null,
      }),
    onSuccess: (row) => {
      client.invalidateQueries({ queryKey: ["employees"] });
      client.invalidateQueries({ queryKey: ["me"] });
      onSaved(row);
      onClose();
    },
  });

  const toggleTag = (id: string) => {
    setTagIds((ids) =>
      ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id],
    );
  };

  const roleHint =
    ROLE_OPTIONS.find((r) => r.code === role)?.hint ||
    "Wybierz rolę systemową dla powiązanego konta.";

  return (
    <Modal
      title="Edytuj pracownika"
      description="Zatrudnienie"
      size="profile"
      bare
      onClose={onClose}
      footer={
        canEdit ? (
          <>
            {save.isError && (
              <Message>{(save.error as ApiError).message}</Message>
            )}
            <Button type="button" variant="quiet" onClick={onClose}>
              Anuluj
            </Button>
            <Button
              type="submit"
              form="edit-employee-form"
              busy={save.isPending}
            >
              Zapisz
            </Button>
          </>
        ) : undefined
      }
    >
      <div className="profile-modal">
        <aside className="profile-nav">
          <div className="profile-identity">
            <span className="avatar large">
              {employee.first_name[0]}
              {employee.last_name[0]}
            </span>
            <div>
              <strong>
                {employee.first_name} {employee.last_name}
              </strong>
              <span className="subtle">
                {employee.email || employee.employee_number}
              </span>
            </div>
          </div>
          <button type="button" className="profile-nav-item active">
            <Users size={16} /> Zatrudnienie
          </button>
        </aside>
        <div className="profile-body">
          <h2>Zatrudnienie</h2>
          {canEdit ? (
            <form
              id="edit-employee-form"
              className="profile-form"
              onSubmit={(event) => {
                event.preventDefault();
                save.mutate();
              }}
            >
              <div className="name-row">
                <Field label="Imię">
                  <input
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    required
                  />
                </Field>
                <Field label="Nazwisko">
                  <input
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    required
                  />
                </Field>
              </div>
              <Field label="Numer pracownika">
                <input value={employee.employee_number} disabled />
              </Field>
              {employee.email && (
                <Field label="E-mail">
                  <input value={employee.email} disabled />
                </Field>
              )}
              <Field label="Stanowisko domyślne">
                <select
                  value={positionId}
                  onChange={(e) => setPositionId(e.target.value)}
                >
                  <option value="">Bez stanowiska</option>
                  {positions.map((row) => (
                    <option key={row.id} value={row.id}>
                      {row.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field
                label={
                  <span className="field-label-row">
                    Tagi
                    {canEdit ? (
                      <button
                        type="button"
                        className="filter-link"
                        onClick={onAddTag}
                      >
                        Dodaj
                      </button>
                    ) : null}
                  </span>
                }
              >
                <div className="tag-picker">
                  {tags.map((tag) => {
                    const selected = tagIds.includes(tag.id);
                    return (
                      <label
                        key={tag.id}
                        className={`tag-pick${selected ? " is-selected" : ""}`}
                      >
                        <input
                          type="checkbox"
                          className="sr-only"
                          checked={selected}
                          onChange={() => toggleTag(tag.id)}
                        />
                        {selected ? (
                          <span className="tag-pick-check" aria-hidden>
                            <Check size={12} strokeWidth={3} />
                          </span>
                        ) : null}
                        <span
                          className="tag-color-dot"
                          style={{
                            background: tag.color || DEFAULT_TAG_COLOR,
                          }}
                          aria-hidden
                        />
                        {tag.name}
                        {tag.is_informational ? (
                          <span className="subtle"> · info</span>
                        ) : null}
                      </label>
                    );
                  })}
                </div>
              </Field>
              {isAdmin && (
                <Field label="Konto">
                  <select
                    value={userId}
                    onChange={(e) => setUserId(e.target.value)}
                  >
                    <option value="">Bez konta</option>
                    {users.map((account) => (
                      <option key={account.id} value={account.id}>
                        {account.email}
                      </option>
                    ))}
                  </select>
                </Field>
              )}
              {isAdmin && userId && (
                <Field label="Rola">
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                  >
                    {ROLE_OPTIONS.map((option) => (
                      <option key={option.code} value={option.code}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <span className="field-hint">{roleHint}</span>
                </Field>
              )}
              <Field label="Bezpośredni przełożony">
                <select
                  value={supervisorId}
                  onChange={(e) => setSupervisorId(e.target.value)}
                >
                  <option value="">Wybierz przełożonego</option>
                  {peers
                    .filter((peer) => peer.active)
                    .map((peer) => (
                      <option key={peer.id} value={peer.id}>
                        {peer.first_name} {peer.last_name}
                      </option>
                    ))}
                </select>
              </Field>
              <div className="name-row">
                <Field label="Początek zatrudnienia">
                  <input
                    type="date"
                    value={hiredOn}
                    onChange={(e) => setHiredOn(e.target.value)}
                  />
                </Field>
                <Field label="Koniec zatrudnienia">
                  <input
                    type="date"
                    value={endedOn}
                    onChange={(e) => setEndedOn(e.target.value)}
                  />
                </Field>
              </div>
              <label className="checkbox-field">
                <input
                  type="checkbox"
                  checked={active}
                  onChange={(e) => setActive(e.target.checked)}
                />{" "}
                Karta aktywna
              </label>
            </form>
          ) : (
            <dl className="detail-list">
              <div>
                <dt>Numer</dt>
                <dd>{employee.employee_number}</dd>
              </div>
              <div>
                <dt>Stanowisko</dt>
                <dd>{employee.position || "—"}</dd>
              </div>
              <div>
                <dt>Przełożony</dt>
                <dd>{employee.supervisor_name || "—"}</dd>
              </div>
              <div>
                <dt>Role</dt>
                <dd>
                  {employee.roles?.map(roleLabel).join(", ") || "—"}
                </dd>
              </div>
              <div>
                <dt>Tagi</dt>
                <dd>
                  {employee.tags?.map((t) => t.name).join(", ") || "—"}
                </dd>
              </div>
            </dl>
          )}
        </div>
      </div>
    </Modal>
  );
}
