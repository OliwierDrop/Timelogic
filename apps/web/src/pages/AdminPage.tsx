import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useOutletContext } from "react-router-dom";
import { Plus } from "lucide-react";
import {
  api,
  ApiError,
  localDate,
  patch,
  post,
  type User,
} from "../api";
import { Button, Empty, Field, Message, Modal, Panel } from "../components";
import { PageHeading } from "../layout/PageHeading";

type Account = { id: string; email: string; roles: string[]; active: boolean };

export function AdminPage() {
  const { user: currentUser } = useOutletContext<{ user: User }>();
  const client = useQueryClient();
  const users = useQuery({
    queryKey: ["users"],
    queryFn: () => api<Account[]>("/auth/users"),
  });
  const audit = useQuery({
    queryKey: ["audit"],
    queryFn: () =>
      api<
        {
          id: string;
          action: string;
          created_at: string;
          target_type: string;
        }[]
      >("/audit-logs"),
  });
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("employee");
  const [inviteUrl, setInviteUrl] = useState("");
  const [inviteOpen, setInviteOpen] = useState(false);
  const invite = useMutation({
    mutationFn: () =>
      post<{ invite_url: string | null; email_sent: boolean }>("/auth/invite", {
        email,
        role,
      }),
    onSuccess: (result) => {
      setInviteUrl(
        result.invite_url ||
          (result.email_sent ? "Wysłano e-mail z zaproszeniem." : ""),
      );
      setEmail("");
      client.invalidateQueries({ queryKey: ["users"] });
    },
  });
  return (
    <>
      <PageHeading
        title="Administracja"
        action={
          <Button
            onClick={() => {
              setInviteUrl("");
              setInviteOpen(true);
            }}
          >
            <Plus size={16} /> Zaproś użytkownika
          </Button>
        }
      />
      {inviteOpen && (
        <Modal
          title="Zaproś użytkownika"
          description="Wyślemy link do ustawienia hasła albo pokażemy go do przekazania."
          onClose={() => setInviteOpen(false)}
          footer={
            <>
              {invite.isError && (
                <Message>{(invite.error as ApiError).message}</Message>
              )}
              {inviteUrl && (
                <Message kind="success">
                  {inviteUrl.startsWith("http") ? (
                    <>
                      Link: <code className="invite-url">{inviteUrl}</code>
                    </>
                  ) : (
                    inviteUrl
                  )}
                </Message>
              )}
              <Button
                type="button"
                variant="quiet"
                onClick={() => setInviteOpen(false)}
              >
                Zamknij
              </Button>
              <Button
                type="submit"
                form="invite-user-form"
                busy={invite.isPending}
              >
                Wyślij zaproszenie
              </Button>
            </>
          }
        >
          <form
            id="invite-user-form"
            className="modal-form"
            onSubmit={(e) => {
              e.preventDefault();
              invite.mutate();
            }}
          >
            <Field label="Adres e-mail">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </Field>
            <Field label="Rola">
              <select value={role} onChange={(e) => setRole(e.target.value)}>
                <option value="employee">Pracownik</option>
                <option value="manager">Kierownik</option>
                <option value="hr">HR</option>
                <option value="admin">Administrator</option>
              </select>
            </Field>
          </form>
        </Modal>
      )}
      <div className="admin-grid">
        <Panel title="Konta">
          <div className="account-list">
            {users.data?.map((row) => (
              <AccountRow
                key={row.id}
                account={row}
                currentUserId={currentUser.id}
              />
            ))}
          </div>
        </Panel>
      </div>
      <Panel title="Ostatnie działania">
        <div className="event-list">
          {audit.data?.slice(0, 10).map((row) => (
            <div className="event-row" key={row.id}>
              <span className="event-dot" />
              <div>
                <strong>{row.action}</strong>
                <small>{localDate(row.created_at)}</small>
              </div>
            </div>
          ))}
          {!audit.data?.length && (
            <Empty title="Brak działań">
              Historia pojawi się po pierwszych zmianach.
            </Empty>
          )}
        </div>
      </Panel>
    </>
  );
}

function AccountRow({
  account,
  currentUserId,
}: {
  account: Account;
  currentUserId: string;
}) {
  const client = useQueryClient();
  const [role, setRole] = useState(account.roles[0] || "employee");
  const [active, setActive] = useState(account.active);
  const save = useMutation({
    mutationFn: () => patch(`/auth/users/${account.id}`, { role, active }),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ["users"] });
      client.invalidateQueries({ queryKey: ["audit"] });
    },
  });
  const changed = role !== account.roles[0] || active !== account.active;
  return (
    <div className="account-row">
      <span className="avatar">{account.email[0].toUpperCase()}</span>
      <div className="account-main">
        <strong>{account.email}</strong>
        <small>{active ? "Konto aktywne" : "Konto nieaktywne"}</small>
      </div>
      <select
        aria-label={`Rola konta ${account.email}`}
        value={role}
        onChange={(event) => setRole(event.target.value)}
        disabled={account.id === currentUserId}
      >
        <option value="employee">Pracownik</option>
        <option value="manager">Kierownik</option>
        <option value="hr">HR</option>
        <option value="admin">Administrator</option>
      </select>
      <label className="checkbox-field">
        <input
          type="checkbox"
          checked={active}
          onChange={(event) => setActive(event.target.checked)}
          disabled={account.id === currentUserId}
        />{" "}
        Aktywne
      </label>
      {changed && (
        <Button
          size="small"
          busy={save.isPending}
          onClick={() => save.mutate()}
        >
          Zapisz
        </Button>
      )}
      {save.isError && <Message>{(save.error as ApiError).message}</Message>}
    </div>
  );
}
