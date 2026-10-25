import { useState } from "react";
import { Button, Field, Message, Modal } from "../../components";

export function MfaPasswordModal({
  title = "Potwierdź hasło",
  confirmLabel = "Dalej",
  busy = false,
  error = null,
  onClose,
  onConfirm,
}: {
  title?: string;
  confirmLabel?: string;
  busy?: boolean;
  error?: string | null;
  onClose: () => void;
  onConfirm: (password: string) => void;
}) {
  const [password, setPassword] = useState("");

  return (
    <Modal
      title={title}
      description="Podaj hasło konta, aby kontynuować."
      onClose={onClose}
      footer={
        <>
          <Button type="button" variant="quiet" onClick={onClose}>
            Anuluj
          </Button>
          <Button
            type="submit"
            form="mfa-password-form"
            busy={busy}
            disabled={!password}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      <form
        id="mfa-password-form"
        className="account-stack"
        onSubmit={(event) => {
          event.preventDefault();
          if (!password) return;
          onConfirm(password);
        }}
      >
        <Field label="Hasło">
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            autoFocus
            required
          />
        </Field>
        {error ? <Message>{error}</Message> : null}
      </form>
    </Modal>
  );
}
