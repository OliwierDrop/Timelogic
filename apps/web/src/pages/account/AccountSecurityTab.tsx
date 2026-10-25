import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Mail, ShieldCheck } from "lucide-react";
import { ApiError, post, type Me, type User, type UserSecurity } from "../../api";
import { Button, Message } from "../../components";
import { AccountSection, AccountTile } from "./AccountTile";
import { MfaEmailSetupModal } from "./MfaEmailSetupModal";
import { MfaPasswordModal } from "./MfaPasswordModal";
import { MfaTotpSetupModal } from "./MfaTotpSetupModal";

type Flow =
  | null
  | { step: "password"; intent: "enable-totp" | "enable-email" | "disable-totp" | "disable-email" }
  | {
      step: "totp-setup";
      password: string;
      secret: string;
      qr_png_base64: string;
    }
  | { step: "email-setup"; password: string; email: string; dev_code?: string };

export function AccountSecurityTab({ user }: { user: User }) {
  const client = useQueryClient();
  const security = user.security || {
    totp_enabled: false,
    email_otp_enabled: false,
  };
  const [flow, setFlow] = useState<Flow>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const syncSecurity = (next: UserSecurity) => {
    client.setQueryData<Me>(["me"], (prev) =>
      prev ? { ...prev, user: { ...prev.user, security: next } } : prev,
    );
  };

  const closeFlow = () => {
    setFlow(null);
    setError(null);
  };

  const startTotp = useMutation({
    mutationFn: (password: string) =>
      post<{ secret: string; otpauth_uri: string; qr_png_base64: string }>(
        "/auth/me/2fa/totp/setup",
        { password },
      ),
    onSuccess: (result, password) => {
      setError(null);
      setFlow({
        step: "totp-setup",
        password,
        secret: result.secret,
        qr_png_base64: result.qr_png_base64,
      });
    },
    onError: (err) => setError((err as ApiError).message),
  });

  const confirmTotp = useMutation({
    mutationFn: (code: string) =>
      post<UserSecurity>("/auth/me/2fa/totp/confirm", { code }),
    onSuccess: (result) => {
      syncSecurity(result);
      closeFlow();
      setInfo("Uwierzytelnianie aplikacją włączone.");
    },
    onError: (err) => setError((err as ApiError).message),
  });

  const disableTotp = useMutation({
    mutationFn: (password: string) =>
      post<UserSecurity>("/auth/me/2fa/totp/disable", { password }),
    onSuccess: (result) => {
      syncSecurity(result);
      closeFlow();
      setInfo("Uwierzytelnianie aplikacją wyłączone.");
    },
    onError: (err) => setError((err as ApiError).message),
  });

  const startEmail = useMutation({
    mutationFn: (password: string) =>
      post<{
        ok: boolean;
        email_sent: boolean;
        email: string;
        dev_code?: string;
      }>("/auth/me/2fa/email/setup", { password }),
    onSuccess: (result, password) => {
      setError(null);
      setFlow({
        step: "email-setup",
        password,
        email: result.email || user.email,
        dev_code: result.dev_code,
      });
    },
    onError: (err) => setError((err as ApiError).message),
  });

  const confirmEmail = useMutation({
    mutationFn: (code: string) =>
      post<UserSecurity>("/auth/me/2fa/email/confirm", { code }),
    onSuccess: (result) => {
      syncSecurity(result);
      closeFlow();
      setInfo("Kody e-mail włączone.");
    },
    onError: (err) => setError((err as ApiError).message),
  });

  const disableEmail = useMutation({
    mutationFn: (password: string) =>
      post<UserSecurity>("/auth/me/2fa/email/disable", { password }),
    onSuccess: (result) => {
      syncSecurity(result);
      closeFlow();
      setInfo("Kody e-mail wyłączone.");
    },
    onError: (err) => setError((err as ApiError).message),
  });

  const passwordBusy =
    startTotp.isPending ||
    startEmail.isPending ||
    disableTotp.isPending ||
    disableEmail.isPending;

  const onPasswordConfirm = (password: string) => {
    if (!flow || flow.step !== "password") return;
    setError(null);
    setInfo(null);
    switch (flow.intent) {
      case "enable-totp":
        startTotp.mutate(password);
        break;
      case "enable-email":
        startEmail.mutate(password);
        break;
      case "disable-totp":
        disableTotp.mutate(password);
        break;
      case "disable-email":
        disableEmail.mutate(password);
        break;
    }
  };

  return (
    <AccountSection title="Uwierzytelnianie wieloskładnikowe">
      <div className="account-stack">
        <div className="account-mfa-grid">
          <AccountTile className="account-mfa-card">
            <div className="account-mfa-icon" aria-hidden="true">
              <ShieldCheck size={28} strokeWidth={1.75} />
            </div>
            <h3>Aplikacja uwierzytelniająca</h3>
            <p>
              Użyj aplikacji uwierzytelniającej, aby uzyskać kod weryfikacyjny
              podczas logowania.
            </p>
            {security.totp_enabled ? (
              <Button
                variant="quiet"
                type="button"
                onClick={() => {
                  setInfo(null);
                  setError(null);
                  setFlow({ step: "password", intent: "disable-totp" });
                }}
              >
                Wyłącz
              </Button>
            ) : (
              <Button
                type="button"
                onClick={() => {
                  setInfo(null);
                  setError(null);
                  setFlow({ step: "password", intent: "enable-totp" });
                }}
              >
                Włącz
              </Button>
            )}
          </AccountTile>

          <AccountTile className="account-mfa-card">
            <div className="account-mfa-icon" aria-hidden="true">
              <Mail size={28} strokeWidth={1.75} />
            </div>
            <h3>Kod wysłany e-mailem</h3>
            <p>
              Otrzymuj kod weryfikacyjny przez e-mail podczas logowania.
            </p>
            {security.email_otp_enabled ? (
              <Button
                variant="quiet"
                type="button"
                onClick={() => {
                  setInfo(null);
                  setError(null);
                  setFlow({ step: "password", intent: "disable-email" });
                }}
              >
                Wyłącz
              </Button>
            ) : (
              <Button
                type="button"
                onClick={() => {
                  setInfo(null);
                  setError(null);
                  setFlow({ step: "password", intent: "enable-email" });
                }}
              >
                Włącz
              </Button>
            )}
          </AccountTile>
        </div>

        {info ? <Message kind="success">{info}</Message> : null}
      </div>

      {flow?.step === "password" ? (
        <MfaPasswordModal
          title={
            flow.intent.startsWith("disable")
              ? "Potwierdź wyłączenie"
              : "Potwierdź hasło"
          }
          confirmLabel={flow.intent.startsWith("disable") ? "Wyłącz" : "Dalej"}
          busy={passwordBusy}
          error={error}
          onClose={closeFlow}
          onConfirm={onPasswordConfirm}
        />
      ) : null}

      {flow?.step === "totp-setup" ? (
        <MfaTotpSetupModal
          secret={flow.secret}
          qrPngBase64={flow.qr_png_base64}
          busy={confirmTotp.isPending}
          error={error}
          onClose={closeFlow}
          onVerify={(code) => {
            setError(null);
            confirmTotp.mutate(code);
          }}
        />
      ) : null}

      {flow?.step === "email-setup" ? (
        <MfaEmailSetupModal
          email={flow.email}
          busy={confirmEmail.isPending}
          resendBusy={startEmail.isPending}
          error={
            error
              ? error
              : flow.dev_code
                ? `Brak SMTP — kod deweloperski: ${flow.dev_code}`
                : null
          }
          onClose={closeFlow}
          onResend={() => {
            setError(null);
            startEmail.mutate(flow.password);
          }}
          onVerify={(code) => {
            setError(null);
            confirmEmail.mutate(code);
          }}
        />
      ) : null}
    </AccountSection>
  );
}
