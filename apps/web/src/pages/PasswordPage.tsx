import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { ApiError, post } from "../api";
import { Button, Field, Message } from "../components";

export function PasswordPage() {
  const token = new URLSearchParams(window.location.search).get("token") || "";
  const mode =
    new URLSearchParams(window.location.search).get("mode") === "reset"
      ? "reset"
      : "invite";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const action = useMutation({
    mutationFn: () =>
      post(mode === "reset" ? "/auth/reset-password" : "/auth/accept-invite", {
        token,
        password,
      }),
  });
  return (
    <div className="auth-layout password-layout">
      <div className="auth-intro">
        <div className="brand brand-large">
          <span className="brand-mark">T</span> TimeLogic
        </div>
        <div>
          <h1>
            Twoje konto.
            <br />
            Twój dzień pracy.
          </h1>
        </div>
        <span className="auth-note">Bezpieczny dostęp do TimeLogic</span>
      </div>
      <div className="auth-form-wrap">
        <div className="auth-card">
          <h2>Ustaw hasło</h2>
          <p>
            Hasło powinno mieć co najmniej 12 znaków. Wpisz je dwa razy, aby
            uniknąć pomyłki. Po zapisaniu przejdziesz do logowania.
          </p>
          {!token && (
            <Message>
              Brakuje tokenu w linku. Poproś administratora o nowy link.
            </Message>
          )}
          {action.isSuccess ? (
            <>
              <Message kind="success">
                Hasło zostało zapisane. Możesz się zalogować.
              </Message>
              <Link className="button button-primary" to="/login">
                Przejdź do logowania
              </Link>
            </>
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (password === confirm) action.mutate();
              }}
            >
              <Field label="Nowe hasło">
                <input
                  type="password"
                  autoComplete="new-password"
                  minLength={12}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </Field>
              <Field
                label="Powtórz hasło"
                error={
                  confirm && password !== confirm
                    ? "Hasła muszą być identyczne"
                    : undefined
                }
              >
                <input
                  type="password"
                  autoComplete="new-password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  required
                />
              </Field>
              {action.isError && (
                <Message>{(action.error as ApiError).message}</Message>
              )}
              <Button
                type="submit"
                busy={action.isPending}
                disabled={
                  !token || password.length < 12 || password !== confirm
                }
              >
                Zapisz hasło
              </Button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
