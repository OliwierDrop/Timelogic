import { useState } from "react";
import { Button, Field, Message, Modal } from "../../components";

function maskEmail(email: string) {
  const [local, domain] = email.split("@");
  if (!local || !domain) return email;
  if (local.length <= 2) return `${local[0] || "*"}***@${domain}`;
  return `${local[0]}***${local[local.length - 1]}@${domain}`;
}

export function MfaEmailSetupModal({
  email,
  busy = false,
  resendBusy = false,
  error = null,
  onClose,
  onResend,
  onVerify,
}: {
  email: string;
  busy?: boolean;
  resendBusy?: boolean;
  error?: string | null;
  onClose: () => void;
  onResend: () => void;
  onVerify: (code: string) => void;
}) {
  const [code, setCode] = useState("");

  return (
    <Modal
      title="Skonfiguruj uwierzytelnianie e-mail"
      onClose={onClose}
      footer={
        <>
          <Button
            type="button"
            variant="quiet"
            className="mfa-resend-link"
            busy={resendBusy}
            onClick={onResend}
          >
            Wyślij ponownie kod na {maskEmail(email)}
          </Button>
          <div className="mfa-modal-footer-actions">
            <Button type="button" variant="quiet" onClick={onClose}>
              Anuluj
            </Button>
            <Button
              type="submit"
              form="mfa-email-form"
              busy={busy}
              disabled={code.trim().length < 6}
            >
              Zweryfikuj
            </Button>
          </div>
        </>
      }
    >
      <p className="mfa-modal-warning">
        <strong>Uwaga:</strong> Ukończenie konfiguracji spowoduje wylogowanie z
        aktywnych sesji na innych urządzeniach. Przy kolejnym logowaniu
        wymagane będzie użycie nowej metody uwierzytelniania.
      </p>
      <form
        id="mfa-email-form"
        className="employee-create-form"
        onSubmit={(event) => {
          event.preventDefault();
          if (code.trim().length < 6) return;
          onVerify(code.trim());
        }}
      >
        <Field label="Wpisz poniżej kod, który wysłaliśmy na Twój adres e-mail.">
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="Kod uwierzytelniający"
            maxLength={8}
            autoFocus
            required
          />
        </Field>
        {error ? <Message>{error}</Message> : null}
      </form>
    </Modal>
  );
}
