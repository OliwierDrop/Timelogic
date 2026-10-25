import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, ApiError, post, put } from "../../api";
import { Button, Field, Message } from "../../components";
import {
  AccountPrefRow,
  AccountSection,
  AccountTile,
} from "../account/AccountTile";

type MailSettings = {
  host: string;
  port: number;
  from_address: string;
  starttls: boolean;
  username: string;
  password_set: boolean;
  configured: boolean;
};

export function OrgMailTab() {
  const client = useQueryClient();
  const mail = useQuery({
    queryKey: ["organization-mail"],
    queryFn: () => api<MailSettings>("/organization/mail"),
  });

  const [host, setHost] = useState("");
  const [port, setPort] = useState("587");
  const [fromAddress, setFromAddress] = useState("");
  const [starttls, setStarttls] = useState(true);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [testTo, setTestTo] = useState("");
  const [info, setInfo] = useState<string | null>(null);
  const [testInfo, setTestInfo] = useState<string | null>(null);

  useEffect(() => {
    if (!mail.data) return;
    setHost(mail.data.host || "");
    setPort(String(mail.data.port || 587));
    setFromAddress(mail.data.from_address || "");
    setStarttls(Boolean(mail.data.starttls));
    setUsername(mail.data.username || "");
    setPassword("");
  }, [mail.data]);

  const save = useMutation({
    mutationFn: () =>
      put<MailSettings>("/organization/mail", {
        host: host.trim(),
        port: Number(port) || 587,
        from_address: fromAddress.trim(),
        starttls,
        username: username.trim(),
        password: password || null,
      }),
    onSuccess: (result) => {
      client.setQueryData(["organization-mail"], result);
      setPassword("");
      setInfo("Zapisano ustawienia poczty.");
    },
  });

  const clearMail = useMutation({
    mutationFn: () =>
      put<MailSettings>("/organization/mail", {
        host: "",
        port: 587,
        from_address: "",
        starttls: false,
        username: "",
        password: null,
      }),
    onSuccess: (result) => {
      client.setQueryData(["organization-mail"], result);
      setHost("");
      setPort("587");
      setFromAddress("");
      setStarttls(false);
      setUsername("");
      setPassword("");
      setInfo("Wyczyszczono konfigurację SMTP.");
    },
  });

  const test = useMutation({
    mutationFn: () => post<{ ok: boolean }>("/organization/mail/test", { to: testTo.trim() }),
    onSuccess: () => setTestInfo("Wiadomość testowa została wysłana."),
  });

  if (mail.isPending) {
    return (
      <AccountSection title="Poczta">
        <p className="subtle">Ładowanie…</p>
      </AccountSection>
    );
  }

  if (mail.isError) {
    return (
      <AccountSection title="Poczta">
        <Message>{(mail.error as ApiError).message}</Message>
      </AccountSection>
    );
  }

  return (
    <AccountSection
      title="Poczta"
      description="Konfiguracja SMTP do zaproszeń, resetu hasła i kodów e-mail."
    >
      <div className="account-stack">
        <form
          className="account-stack"
          onSubmit={(event) => {
            event.preventDefault();
            setInfo(null);
            save.mutate();
          }}
        >
          <AccountTile title="Serwer SMTP">
            <Field label="Host">
              <input
                value={host}
                onChange={(e) => setHost(e.target.value)}
                placeholder="smtp.example.com"
                autoComplete="off"
              />
            </Field>
            <Field label="Port">
              <input
                type="number"
                min={1}
                max={65535}
                value={port}
                onChange={(e) => setPort(e.target.value)}
              />
            </Field>
            <Field label="Nadawca (From)">
              <input
                type="email"
                value={fromAddress}
                onChange={(e) => setFromAddress(e.target.value)}
                placeholder="noreply@example.com"
              />
            </Field>
            <AccountPrefRow label="STARTTLS" bare>
              <button
                type="button"
                role="switch"
                aria-checked={starttls}
                className={`account-switch${starttls ? " on" : ""}`}
                onClick={() => setStarttls((v) => !v)}
              >
                <span className="account-switch-knob" />
              </button>
            </AccountPrefRow>
            <Field label="Użytkownik">
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="off"
              />
            </Field>
            <Field
              label={
                mail.data.password_set
                  ? "Hasło (zostaw puste, aby nie zmieniać)"
                  : "Hasło"
              }
            >
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                placeholder={mail.data.password_set ? "••••••••" : ""}
              />
            </Field>
          </AccountTile>

          {info ? <Message kind="success">{info}</Message> : null}
          {save.isError ? (
            <Message>{(save.error as ApiError).message}</Message>
          ) : null}
          {clearMail.isError ? (
            <Message>{(clearMail.error as ApiError).message}</Message>
          ) : null}

          <div className="account-actions">
            <Button type="submit" busy={save.isPending}>
              Zapisz
            </Button>
            {mail.data.configured ? (
              <Button
                type="button"
                variant="quiet"
                busy={clearMail.isPending}
                onClick={() => {
                  setInfo(null);
                  clearMail.mutate();
                }}
              >
                Wyczyść SMTP
              </Button>
            ) : null}
          </div>
        </form>

        <AccountTile title="Wiadomość testowa">
          <Field label="Wyślij na adres">
            <input
              type="email"
              value={testTo}
              onChange={(e) => setTestTo(e.target.value)}
              placeholder="admin@example.com"
            />
          </Field>
          {testInfo ? <Message kind="success">{testInfo}</Message> : null}
          {test.isError ? (
            <Message>{(test.error as ApiError).message}</Message>
          ) : null}
          <div className="account-actions">
            <Button
              type="button"
              busy={test.isPending}
              disabled={!mail.data.configured || !testTo.trim()}
              onClick={() => {
                setTestInfo(null);
                test.mutate();
              }}
            >
              Wyślij test
            </Button>
          </div>
        </AccountTile>
      </div>
    </AccountSection>
  );
}
