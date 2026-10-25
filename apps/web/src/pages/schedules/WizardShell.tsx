import type { PropsWithChildren, ReactNode } from "react";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { Button, Message, Modal } from "../../components";

export function WizardShell({
  title,
  step,
  totalSteps,
  sidebar,
  children,
  error,
  onClose,
  onBack,
  primaryLabel,
  primaryDisabled,
  primaryBusy,
  onPrimary,
  primaryIsNext = false,
}: PropsWithChildren<{
  title: string;
  step: number;
  totalSteps: number;
  sidebar: ReactNode;
  error?: string | null;
  onClose: () => void;
  onBack?: () => void;
  primaryLabel: string;
  primaryDisabled?: boolean;
  primaryBusy?: boolean;
  onPrimary: () => void;
  primaryIsNext?: boolean;
}>) {
  return (
    <Modal
      title={title}
      size="profile"
      bare
      onClose={onClose}
      footer={
        <>
          <span className="wizard-step-label">
            Krok {step} z {totalSteps}
          </span>
          <div className="wizard-footer-actions">
            {error ? <Message>{error}</Message> : null}
            <Button type="button" variant="quiet" onClick={onClose}>
              Anuluj
            </Button>
            {step > 1 && onBack ? (
              <Button type="button" variant="quiet" onClick={onBack}>
                <ArrowLeft size={16} strokeWidth={2.2} />
                Wstecz
              </Button>
            ) : null}
            <Button
              type="button"
              disabled={primaryDisabled}
              busy={primaryBusy}
              onClick={onPrimary}
            >
              {primaryLabel}
              {primaryIsNext ? (
                <ArrowRight size={16} strokeWidth={2.2} />
              ) : null}
            </Button>
          </div>
        </>
      }
    >
      <div className="wizard-shell">
        <header className="wizard-shell-head">
          <h2>{title}</h2>
        </header>
        <div className="wizard-layout">
          <aside className="wizard-sidebar">{sidebar}</aside>
          <div className="wizard-main">{children}</div>
        </div>
      </div>
    </Modal>
  );
}

export function employeeInitials(first: string, last: string) {
  return `${first[0] || ""}${last[0] || ""}`.toUpperCase() || "?";
}
