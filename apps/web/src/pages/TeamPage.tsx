import { useMemo, useState, type CSSProperties } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useOutletContext } from "react-router-dom";
import { Plus } from "lucide-react";
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
import { ManageCatalogModal } from "../layout/ManageCatalogModal";
import { TagFormModal } from "../layout/TagFormModal";
import { useSetFilterSidebar } from "../layout/filterSidebarContext";
import { DEFAULT_TAG_COLOR } from "../tags";
import { ConfirmEmployeeModal } from "./team/ConfirmEmployeeModal";
import { CreateEmployeeModal } from "./team/CreateEmployeeModal";
import { EmployeeEditor } from "./team/EmployeeEditor";
import { EmployeeRowActions } from "./team/EmployeeRowActions";
import { InviteLinkModal } from "./team/InviteLinkModal";
import { roleLabel } from "./team/roles";
import { EmployeeStatusIcon } from "./team/status";
import { TeamFilters } from "./team/TeamFilters";

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
  const [tagForm, setTagForm] = useState<"new" | Tag | null>(null);
  const [showPosition, setShowPosition] = useState(false);
  const [manageTags, setManageTags] = useState(false);
  const [managePositions, setManagePositions] = useState(false);
  const [selected, setSelected] = useState<Employee | null>(null);
  const [positionName, setPositionName] = useState("");
  const [selectTagId, setSelectTagId] = useState<string | null>(null);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<null | {
    type: "delete" | "deactivate";
    employee: Employee;
  }>(null);
  const [linkModal, setLinkModal] = useState<{
    url: string;
    title: string;
    description: string;
  } | null>(null);

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
  const openNewTag = () => {
    setCatalogError(null);
    setTagForm("new");
  };

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
      if (wasCreate) setSelectTagId(tag.id);
    },
    onError: (err) => setCatalogError((err as ApiError).message),
  });

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
      if (result.invite_url) {
        setLinkModal({
          url: result.invite_url,
          title: "Link zaproszenia",
          description:
            "Mail nie został wysłany (brak SMTP). Skopiuj link i prześlij go pracownikowi.",
        });
      }
    },
  });

  const count = employees.data?.length ?? 0;

  useSetFilterSidebar(
    () => (
      <TeamFilters
        search={search}
        status={status}
        roleFilter={roleFilter}
        tagFilter={tagFilter}
        positionFilter={positionFilter}
        canEdit={canEdit}
        tags={tags.data || []}
        positions={positions.data || []}
        onSearch={setSearch}
        onStatus={setStatus}
        onRoleFilter={setRoleFilter}
        onTagFilter={setTagFilter}
        onPositionFilter={setPositionFilter}
        onAddTag={openNewTag}
        onManageTags={() => {
          setCatalogError(null);
          setManageTags(true);
        }}
        onAddPosition={() => {
          setCatalogError(null);
          setShowPosition(true);
        }}
        onManagePositions={() => {
          setCatalogError(null);
          setManagePositions(true);
        }}
      />
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
          <Button onClick={() => setShowForm(true)}>
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
                        {row.email ? (
                          <span className="subtle">{row.email}</span>
                        ) : null}
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
        <CreateEmployeeModal
          isAdmin={isAdmin}
          positions={positions.data || []}
          tags={tags.data || []}
          peers={allForMeta.data || []}
          selectTagId={selectTagId}
          onClose={() => setShowForm(false)}
          onAddPosition={() => setShowPosition(true)}
          onManagePositions={() => setManagePositions(true)}
          onAddTag={openNewTag}
          onManageTags={() => setManageTags(true)}
        />
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
          canEdit={canEdit}
          isAdmin={isAdmin}
          selectTagId={selectTagId}
          onAddTag={openNewTag}
          onClose={() => setSelected(null)}
          onSaved={(row) => {
            setSelected(row);
            const confirmUrl = row.email_change?.confirm_url;
            if (confirmUrl) {
              setLinkModal({
                url: confirmUrl,
                title: "Link potwierdzenia e-maila",
                description:
                  "Mail nie został wysłany (brak SMTP). Skopiuj link i prześlij go na nowy adres pracownika.",
              });
            }
          }}
        />
      )}

      {confirmAction && (
        <ConfirmEmployeeModal
          action={confirmAction}
          busy={deleteEmployee.isPending || deactivateEmployee.isPending}
          error={
            deleteEmployee.isError || deactivateEmployee.isError
              ? (
                  (deleteEmployee.error ||
                    deactivateEmployee.error) as ApiError
                ).message
              : null
          }
          onClose={() => setConfirmAction(null)}
          onConfirm={() => {
            if (confirmAction.type === "delete") {
              deleteEmployee.mutate(confirmAction.employee.id);
            } else {
              deactivateEmployee.mutate(confirmAction.employee.id);
            }
          }}
        />
      )}

      {linkModal && (
        <InviteLinkModal
          inviteLink={linkModal.url}
          title={linkModal.title}
          description={linkModal.description}
          onClose={() => setLinkModal(null)}
        />
      )}
    </>
  );
}
