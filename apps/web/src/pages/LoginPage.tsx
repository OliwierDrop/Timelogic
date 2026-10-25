import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowRight } from "lucide-react";
import { useOutletContext } from "react-router-dom";
import { ApiError, post, type Me } from "../api";
import { Button, Field, Message } from "../components";

const loginSchema = z.object({
  email: z.email("Podaj poprawny adres e-mail"),
  password: z.string().min(1, "Podaj hasło"),
});
type LoginValues = z.infer<typeof loginSchema>;

type LoginResult =
  | Me
  | {
      requires_2fa: true;
      challenge_token: string;
      methods: string[];
    };

function isMe(value: LoginResult): value is Me {
  return "user" in value && "csrf_token" in value;
}

export function LoginPage() {
  const { onLogin } = useOutletContext<{ onLogin: (data: Me) => void }>();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginValues>({ resolver: zodResolver(loginSchema) });
  const [resetMode, setResetMode] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [challenge, setChallenge] = useState<{
    token: string;
    methods: string[];
  } | null>(null);
  const [otp, setOtp] = useState("");

  const login = useMutation({
    mutationFn: (data: LoginValues) => post<LoginResult>("/auth/login", data),
    onSuccess: (result) => {
      if (isMe(result)) {
        onLogin(result);
        return;
      }
      setChallenge({
        token: result.challenge_token,
        methods: result.methods || [],
      });
      setOtp("");
    },
  });

  const verify2fa = useMutation({
    mutationFn: () =>
      post<Me>("/auth/login/2fa", {
        challenge_token: challenge!.token,
        code: otp,
      }),
    onSuccess: onLogin,
  });

  const reset = useMutation({
    mutationFn: () => post("/auth/request-reset", { email: resetEmail }),
  });

  return (
    <div className="auth-layout">
      <div className="auth-intro">
        <div className="brand brand-large">
          <span className="brand-mark">T</span> TimeLogic
        </div>
        <div>
          <p className="auth-overline">EWIDENCJA CZASU PRACY</p>
          <h1>
            Czas pracy, który
            <br />
            da się zrozumieć.
          </h1>
          <p>
            Rejestruj dzień pracy, przeglądaj historię i rozpatruj korekty w
            jednym miejscu.
          </p>
        </div>
        <span className="auth-note">Wydanie pilotażowe · Europe/Warsaw</span>
      </div>
      <div className="auth-form-wrap">
        <div className="auth-card">
          {resetMode ? (
            <>
              <h2>Przywróć dostęp</h2>
              <p>Jeśli konto istnieje, wyślemy link do zmiany hasła.</p>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  reset.mutate();
                }}
              >
                <Field label="Adres e-mail">
                  <input
                    type="email"
                    value={resetEmail}
                    onChange={(e) => setResetEmail(e.target.value)}
                    required
                    autoComplete="email"
                  />
                </Field>
                <Button busy={reset.isPending} type="submit">
                  Wyślij link <ArrowRight size={17} />
                </Button>
              </form>
              {reset.isSuccess && (
                <Message kind="success">
                  Jeśli konto istnieje, wiadomość została wysłana.
                </Message>
              )}
              <button className="text-link" onClick={() => setResetMode(false)}>
                Wróć do logowania
              </button>
            </>
          ) : challenge ? (
            <>
              <h2>Weryfikacja dwuetapowa</h2>
              <p>
                {challenge.methods.includes("email") &&
                challenge.methods.includes("totp")
                  ? "Podaj kod z aplikacji lub z wiadomości e-mail."
                  : challenge.methods.includes("email")
                    ? "Podaj kod wysłany na Twój e-mail."
                    : "Podaj kod z aplikacji uwierzytelniającej."}
              </p>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  verify2fa.mutate();
                }}
              >
                <Field label="Kod">
                  <input
                    value={otp}
                    onChange={(e) => setOtp(e.target.value)}
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    required
                  />
                </Field>
                {verify2fa.isError && (
                  <Message>{(verify2fa.error as ApiError).message}</Message>
                )}
                <Button busy={verify2fa.isPending} type="submit">
                  Potwierdź <ArrowRight size={17} />
                </Button>
              </form>
              <button
                className="text-link"
                onClick={() => {
                  setChallenge(null);
                  setOtp("");
                }}
              >
                Wróć do logowania
              </button>
            </>
          ) : (
            <>
              <h2>Witaj ponownie</h2>
              <p>Zaloguj się, aby przejść do swojej przestrzeni pracy.</p>
              <form onSubmit={handleSubmit((data) => login.mutate(data))}>
                <Field label="Adres e-mail" error={errors.email?.message}>
                  <input
                    type="email"
                    autoComplete="username"
                    {...register("email")}
                  />
                </Field>
                <Field label="Hasło" error={errors.password?.message}>
                  <input
                    type="password"
                    autoComplete="current-password"
                    {...register("password")}
                  />
                </Field>
                {login.isError && (
                  <Message>{(login.error as ApiError).message}</Message>
                )}
                <Button busy={login.isPending} type="submit">
                  Zaloguj się <ArrowRight size={17} />
                </Button>
              </form>
              <button className="text-link" onClick={() => setResetMode(true)}>
                Nie pamiętasz hasła?
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
