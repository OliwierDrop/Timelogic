import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Eye, EyeOff } from "lucide-react";
import { ApiError, post } from "../../api";
import { Button, Field, Message } from "../../components";
import { AccountSection, AccountTile } from "./AccountTile";

function PasswordField({
  label,
  value,
  onChange,
  autoComplete,
  placeholder,
  required,
  error,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete: string;
  placeholder: string;
  required?: boolean;
  error?: string;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <Field label={label} error={error}>
      <div className="password-input">
        <input
          type={visible ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete={autoComplete}
          placeholder={placeholder}
          required={required}
        />
        <button
          type="button"
          className="password-input-toggle"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? "Ukryj hasło" : "Pokaż hasło"}
        >
          {visible ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      </div>
    </Field>
  );
}

export function AccountPasswordTab() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [info, setInfo] = useState<string | null>(null);

  const save = useMutation({
    mutationFn: () =>
      post("/auth/me/password", {
        current_password: currentPassword,
        new_password: newPassword,
      }),
    onSuccess: () => {
      setCurrentPassword("");
      setNewPassword("");
      setConfirm("");
      setInfo("Hasło zostało zmienione. Inne sesje wylogowano.");
    },
  });

  const mismatch = confirm.length > 0 && confirm !== newPassword;
  const canSubmit =
    !mismatch && newPassword.length >= 12 && currentPassword.length > 0;

  return (
    <AccountSection title="Zmień hasło">
      <form
        className="account-stack"
        onSubmit={(event) => {
          event.preventDefault();
          setInfo(null);
          if (!canSubmit) return;
          save.mutate();
        }}
      >
        <AccountTile>
          <PasswordField
            label="Obecne hasło"
            value={currentPassword}
            onChange={setCurrentPassword}
            autoComplete="current-password"
            placeholder="Obecne hasło"
            required
          />
          <PasswordField
            label="Nowe hasło"
            value={newPassword}
            onChange={setNewPassword}
            autoComplete="new-password"
            placeholder="Nowe hasło (min. 12 znaków)"
            required
          />
          <PasswordField
            label="Potwierdź hasło"
            value={confirm}
            onChange={setConfirm}
            autoComplete="new-password"
            placeholder="Potwierdź hasło"
            required
            error={mismatch ? "Hasła muszą być takie same" : undefined}
          />
          {save.isError ? (
            <Message>{(save.error as ApiError).message}</Message>
          ) : null}
          {info ? <Message kind="success">{info}</Message> : null}
          <div className="account-actions">
            <Button busy={save.isPending} type="submit" disabled={!canSubmit}>
              Aktualizuj hasło
            </Button>
          </div>
        </AccountTile>
      </form>
    </AccountSection>
  );
}
