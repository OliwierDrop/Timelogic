import { useState } from "react";
import { Button, Field, Message, Modal } from "../../components";

export function MfaTotpSetupModal({
  secret,
  qrPngBase64,
  busy = false,
  error = null,
  onClose,
  onVerify,
}: {
  secret: string;
  qrPngBase64: string;
  busy?: boolean;
  error?: string | null;
  onClose: () => void;
  onVerify: (code: string) => void;
}) {
  const [code, setCode] = useState("");

  return (
    <Modal
      title="Skonfiguruj aplikację uwierzytelniającą"
      size="wide"
      onClose={onClose}
      footer={
        <>
          <Button type="button" variant="quiet" onClick={onClose}>
            Anuluj
          </Button>
          <Button
            type="submit"
            form="mfa-totp-form"
            busy={busy}
            disabled={code.trim().length < 6}
          >
            Zweryfikuj
          </Button>
        </>
      }
    >
      <p className="mfa-modal-warning">
        <strong>Uwaga:</strong> Ukończenie konfiguracji spowoduje wylogowanie z
        aktywnych sesji na innych urządzeniach. Przy kolejnym logowaniu
        wymagane będzie użycie nowej metody uwierzytelniania.
      </p>
      <div className="mfa-totp-layout">
        <ol className="mfa-totp-steps">
          <li>
            <strong>Otwórz aplikację uwierzytelniającą</strong>
            <span>
              np. Google Authenticator, Microsoft Authenticator lub 1Password.
            </span>
          </li>
          <li>
            <strong>Dodaj nowe konto</strong>
            <span>Wybierz plus lub opcję „Dodaj konto”.</span>
          </li>
          <li>
            <strong>Zeskanuj kod QR</strong>
            <span>
              Zeskanuj kod po prawej albo wpisz ręcznie wartość pod kodem.
            </span>
          </li>
          <li>
            <strong>Wprowadź kod weryfikacyjny</strong>
            <span>
              Wpisz 6-cyfrowy kod z aplikacji poniżej, aby dokończyć
              konfigurację.
            </span>
          </li>
        </ol>
        <div className="mfa-totp-side">
          <div className="mfa-totp-qr-block">
            <img
              className="account-totp-qr"
              src={`data:image/png;base64,${qrPngBase64}`}
              alt="Kod QR 2FA"
            />
            <code className="mfa-totp-secret">{secret}</code>
          </div>
          <form
            id="mfa-totp-form"
            className="mfa-totp-code-form"
            onSubmit={(event) => {
              event.preventDefault();
              if (code.trim().length < 6) return;
              onVerify(code.trim());
            }}
          >
            <Field label="Kod uwierzytelniający">
              <input
                value={code}
                onChange={(e) => setCode(e.target.value)}
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="Kod uwierzytelniający"
                maxLength={8}
                required
              />
            </Field>
          </form>
          {error ? <Message>{error}</Message> : null}
        </div>
      </div>
    </Modal>
  );
}
