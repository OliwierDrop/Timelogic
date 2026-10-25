import type { LeaveType } from "../../api";
import { Button, Field, Message, Modal } from "../../components";

export function ScheduleLeaveModal({
  titleDescription,
  leaveTypes,
  leaveTypeId,
  leaveReason,
  busy,
  error,
  onLeaveTypeId,
  onLeaveReason,
  onClose,
  onSave,
}: {
  titleDescription: string;
  leaveTypes: LeaveType[];
  leaveTypeId: string;
  leaveReason: string;
  busy: boolean;
  error: string | null;
  onLeaveTypeId: (value: string) => void;
  onLeaveReason: (value: string) => void;
  onClose: () => void;
  onSave: () => void;
}) {
  return (
    <Modal
      title="Nowy wniosek"
      description={titleDescription}
      onClose={onClose}
      footer={
        <>
          {error && <Message>{error}</Message>}
          <Button type="button" variant="quiet" onClick={onClose}>
            Anuluj
          </Button>
          <Button
            type="button"
            busy={busy}
            disabled={!leaveTypeId}
            onClick={onSave}
          >
            Zapisz
          </Button>
        </>
      }
    >
      <div className="form-grid modal-form">
        <Field label="Typ">
          <select
            value={leaveTypeId}
            onChange={(event) => onLeaveTypeId(event.target.value)}
            required
          >
            <option value="">Wybierz typ</option>
            {leaveTypes.map((type) => (
              <option key={type.id} value={type.id}>
                {type.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Notatka">
          <textarea
            rows={2}
            value={leaveReason}
            onChange={(event) => onLeaveReason(event.target.value)}
          />
        </Field>
      </div>
    </Modal>
  );
}
