import type { EmployeeDocument } from "../../api";
import { Button, Message, Modal } from "../../components";
import { documentCategoryLabel } from "./documentCategories";

export function ConfirmDocumentModal({
  document,
  busy,
  error,
  onClose,
  onConfirm,
}: {
  document: EmployeeDocument;
  busy: boolean;
  error: string | null;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <Modal
      title="Usuń dokument"
      description={`Na zawsze usuniesz „${document.name}” z kartoteki. Tej operacji nie cofniesz.`}
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
            variant="danger"
            busy={busy}
            onClick={onConfirm}
          >
            Usuń na zawsze
          </Button>
        </>
      }
    >
      <p className="confirm-target">
        {documentCategoryLabel(document.category)} · {document.original_filename}
      </p>
    </Modal>
  );
}
