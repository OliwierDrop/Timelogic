import { useMutation } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { ApiError, post } from "../api";
import { Button, Message } from "../components";

type ConfirmResult = {
  ok: boolean;
  email: string;
  needs_password: boolean;
  invite_sent: boolean;
  invite_url: string | null;
};

export function ConfirmEmailPage() {
  const token = new URLSearchParams(window.location.search).get("token") || "";
  const action = useMutation({
    mutationFn: () =>
      post<ConfirmResult>("/auth/confirm-email", { token }),
  });

  return (
    <div className="auth-layout password-layout">
      <div className="auth-intro">
        <div className="brand brand-large">
          <span className="brand-mark">T</span> TimeLogic
        </div>
        <div>
          <h1>
            Potwierdź
            <br />
            nowy e-mail.
          </h1>
        </div>
        <span className="auth-note">Bezpieczna zmiana adresu w TimeLogic</span>
      </div>
      <div className="auth-form-wrap">
        <div className="auth-card">
          <h2>Zmiana e-maila</h2>
          <p>
            Kliknij poniżej, aby potwierdzić nowy adres. Dopiero wtedy konto
            będzie używać tego e-maila przy logowaniu.
          </p>
          {!token && (
            <Message>
              Brakuje tokenu w linku. Poproś administratora o ponowną zmianę
              adresu.
            </Message>
          )}
          {action.isSuccess ? (
            <>
              <Message kind="success">
                Adres {action.data.email} został potwierdzony.
                {action.data.needs_password
                  ? action.data.invite_sent
                    ? " Na skrzynkę wysłaliśmy link do ustawienia hasła."
                    : " Ustaw hasło, korzystając z linku poniżej lub poproś o ponowne zaproszenie."
                  : " Możesz logować się nowym adresem."}
              </Message>
              {action.data.needs_password && action.data.invite_url ? (
                <p>
                  <a href={action.data.invite_url}>Ustaw hasło</a>
                </p>
              ) : null}
              {!action.data.needs_password ? (
                <Link className="button button-primary" to="/login">
                  Przejdź do logowania
                </Link>
              ) : null}
            </>
          ) : (
            <>
              {action.isError && (
                <Message>{(action.error as ApiError).message}</Message>
              )}
              <Button
                type="button"
                busy={action.isPending}
                disabled={!token}
                onClick={() => action.mutate()}
              >
                Potwierdź e-mail
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
