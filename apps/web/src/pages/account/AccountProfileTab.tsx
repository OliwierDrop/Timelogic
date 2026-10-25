import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ApiError,
  patch,
  type Me,
  type User,
} from "../../api";
import { Button, Field, Message } from "../../components";
import { AccountSection, AccountTile } from "./AccountTile";

export function AccountProfileTab({ user }: { user: User }) {
  const client = useQueryClient();
  const [firstName, setFirstName] = useState(user.first_name || "");
  const [lastName, setLastName] = useState(user.last_name || "");
  const [phone, setPhone] = useState(user.phone || "");
  const [email, setEmail] = useState(user.email);
  const [info, setInfo] = useState<string | null>(null);
  const hasCard = Boolean(user.employee_id);

  const save = useMutation({
    mutationFn: () =>
      patch<{
        user: User;
        email_change?: {
          pending_email: string;
          email_sent: boolean;
          confirm_url: string | null;
        };
      }>("/auth/me/profile", {
        first_name: firstName.trim() || null,
        last_name: lastName.trim() || null,
        phone: phone.trim() || null,
        email: email.trim(),
      }),
    onSuccess: (result) => {
      client.setQueryData<Me>(["me"], (prev) =>
        prev ? { ...prev, user: { ...prev.user, ...result.user } } : prev,
      );
      if (result.email_change) {
        setInfo(
          result.email_change.email_sent
            ? `Wysłaliśmy link potwierdzający na ${result.email_change.pending_email}.`
            : `Potwierdź nowy e-mail: ${result.email_change.confirm_url}`,
        );
      } else {
        setInfo("Zapisano dane profilu.");
      }
    },
  });

  return (
    <AccountSection title="Twój profil">
      <form
        className="account-stack"
        onSubmit={(event) => {
          event.preventDefault();
          setInfo(null);
          save.mutate();
        }}
      >
        {!hasCard ? (
          <Message>
            Imię, nazwisko i telefon pochodzą z karty w Zespole. Połącz konto z
            kartą, aby je edytować.
          </Message>
        ) : null}

        <AccountTile title="Informacje osobiste">
          <div className="field-block">
            <span className="field-block-label">Imię i nazwisko</span>
            <div className="stacked-inputs">
              <input
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                disabled={!hasCard}
                autoComplete="given-name"
                placeholder="Imię"
                aria-label="Imię"
              />
              <input
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                disabled={!hasCard}
                autoComplete="family-name"
                placeholder="Nazwisko"
                aria-label="Nazwisko"
              />
            </div>
          </div>
        </AccountTile>

        <AccountTile title="Dane kontaktowe">
          <div className="account-contact-grid">
            <Field label="E-mail">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
              />
            </Field>
            <Field label="Numer telefonu">
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                disabled={!hasCard}
                autoComplete="tel"
                placeholder="+48 …"
              />
            </Field>
          </div>
          {user.pending_email ? (
            <p className="account-pending">
              Oczekuje na potwierdzenie: <strong>{user.pending_email}</strong>
            </p>
          ) : null}
        </AccountTile>

        {save.isError ? (
          <Message>{(save.error as ApiError).message}</Message>
        ) : null}
        {info ? <Message kind="success">{info}</Message> : null}
        <div className="account-actions">
          <Button busy={save.isPending} type="submit">
            Zapisz profil
          </Button>
        </div>
      </form>
    </AccountSection>
  );
}
