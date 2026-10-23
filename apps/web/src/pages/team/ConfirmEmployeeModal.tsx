import type { Employee } from "../../api";
import { Button, Message, Modal } from "../../components";

export function ConfirmEmployeeModal({
  action,
  busy,
  error,
  onClose,
  onConfirm,
}: {
  action: { type: "delete" | "deactivate"; employee: Employee };
  busy: boolean;
  error: string | null;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <Modal
      title={
        action.type === "delete" ? "Usuń z systemu" : "Dezaktywuj konto"
      }
      description={
        action.type === "delete"
          ? `Na zawsze usuniesz kartę ${action.employee.first_name} ${action.employee.last_name} oraz powiązane konto. Tej operacji nie cofniesz.`
          : `Konto ${action.employee.first_name} ${action.employee.last_name} zostanie dezaktywowane i utraci dostęp do aplikacji.`
      }
      layer={1}
      onClose={onClose}
      footer={
        <>
          {error && <Message>{error}</Message>}
          <Button type="button" variant="quiet" onClick={onClose}>
            Anuluj
          </Button>
          <Button
            type="button"
            variant={action.type === "delete" ? "danger" : "primary"}
            busy={busy}
            onClick={onConfirm}
          >
            {action.type === "delete" ? "Usuń na zawsze" : "Dezaktywuj"}
          </Button>
        </>
      }
    >
      <p className="confirm-target">
        {action.employee.email
          ? action.employee.email
          : action.employee.employee_number}
      </p>
    </Modal>
  );
}
