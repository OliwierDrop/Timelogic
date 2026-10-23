import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CloudUpload } from "lucide-react";
import {
  api,
  ApiError,
  del,
  downloadFile,
  type EmployeeDocument,
} from "../../api";
import { Empty, Message } from "../../components";
import { ConfirmDocumentModal } from "./ConfirmDocumentModal";
import { DOCUMENT_ACCEPT, documentCategoryLabel } from "./documentCategories";
import { DocumentEditModal } from "./DocumentEditModal";
import { DocumentPreviewModal } from "./DocumentPreviewModal";
import { DocumentRowActions } from "./DocumentRowActions";
import { DocumentUploadWizard } from "./DocumentUploadWizard";

function formatAddedOn(value: string | null): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat("pl-PL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "Europe/Warsaw",
  }).format(new Date(value));
}

function truncateName(name: string, max = 28): string {
  if (name.length <= max) return name;
  return `${name.slice(0, max - 1)}…`;
}

export function DocumentsPanel({
  employeeId,
  canEdit,
}: {
  employeeId: string;
  canEdit: boolean;
}) {
  const client = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<File[] | null>(null);
  const [editing, setEditing] = useState<EmployeeDocument | null>(null);
  const [previewing, setPreviewing] = useState<EmployeeDocument | null>(null);
  const [deleting, setDeleting] = useState<EmployeeDocument | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const documents = useQuery({
    queryKey: ["employee-documents", employeeId],
    queryFn: () =>
      api<EmployeeDocument[]>(`/employees/${employeeId}/documents`),
  });

  const remove = useMutation({
    mutationFn: (id: string) =>
      del(`/employees/${employeeId}/documents/${id}`),
    onSuccess: () => {
      setDeleting(null);
      setDeleteError(null);
      client.invalidateQueries({
        queryKey: ["employee-documents", employeeId],
      });
    },
    onError: (err) => setDeleteError((err as ApiError).message),
  });

  const openFiles = (list: FileList | File[] | null) => {
    if (!canEdit || !list) return;
    const files = Array.from(list);
    if (!files.length) return;
    setError(null);
    setPendingFiles(files);
  };

  return (
    <>
      <h2>Dokumenty</h2>
      {canEdit ? (
        <div
          className={`doc-dropzone${dragOver ? " is-dragover" : ""}`}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              inputRef.current?.click();
            }
          }}
          onClick={() => inputRef.current?.click()}
          onDragEnter={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={(e) => {
            e.preventDefault();
            setDragOver(false);
          }}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            openFiles(e.dataTransfer.files);
          }}
        >
          <CloudUpload size={36} strokeWidth={1.5} aria-hidden />
          <p>Przeciągnij i upuść pliki tutaj lub kliknij, aby przesłać</p>
          <span className="subtle">
            PDF, JPG, JPEG, PNG — max 15 MB na plik
          </span>
          <input
            ref={inputRef}
            type="file"
            className="sr-only"
            accept={DOCUMENT_ACCEPT}
            multiple
            onChange={(e) => {
              openFiles(e.target.files);
              e.target.value = "";
            }}
          />
        </div>
      ) : null}

      {error ? <Message>{error}</Message> : null}

      {documents.isLoading ? (
        <p className="subtle">Ładowanie dokumentów…</p>
      ) : documents.isError ? (
        <Message>{(documents.error as ApiError).message}</Message>
      ) : !(documents.data || []).length ? (
        <Empty title="Brak dokumentów">
          {canEdit
            ? "Dodaj pierwszy plik przez strefę powyżej."
            : "W kartotece nie ma jeszcze dokumentów."}
        </Empty>
      ) : (
        <div className="doc-table-wrap">
          <table className="doc-table">
            <thead>
              <tr>
                <th>Dokument</th>
                <th>Plik</th>
                <th>Data dodania</th>
                <th aria-label="Akcje" />
              </tr>
            </thead>
            <tbody>
              {(documents.data || []).map((row) => (
                <tr key={row.id}>
                  <td>
                    <div className="doc-name-cell">
                      <span className="doc-category-dot" aria-hidden />
                      <div>
                        <span className="doc-category-label">
                          {documentCategoryLabel(row.category)}
                        </span>
                        <strong>{row.name}</strong>
                      </div>
                    </div>
                  </td>
                  <td className="subtle" title={row.original_filename}>
                    {truncateName(row.original_filename)}
                  </td>
                  <td>{formatAddedOn(row.created_at)}</td>
                  <td className="doc-actions">
                    <DocumentRowActions
                      busy={remove.isPending}
                      canEdit={canEdit}
                      onPreview={() => setPreviewing(row)}
                      onDownload={() => {
                        void downloadFile(
                          `/employees/${employeeId}/documents/${row.id}/file`,
                          row.original_filename,
                        ).catch((err) =>
                          setError((err as ApiError).message),
                        );
                      }}
                      onEdit={() => setEditing(row)}
                      onDelete={() => {
                        setDeleteError(null);
                        setDeleting(row);
                      }}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {pendingFiles ? (
        <DocumentUploadWizard
          employeeId={employeeId}
          files={pendingFiles}
          onClose={() => setPendingFiles(null)}
          onDone={() => {
            client.invalidateQueries({
              queryKey: ["employee-documents", employeeId],
            });
          }}
        />
      ) : null}

      {previewing ? (
        <DocumentPreviewModal
          employeeId={employeeId}
          document={previewing}
          onClose={() => setPreviewing(null)}
        />
      ) : null}

      {editing ? (
        <DocumentEditModal
          employeeId={employeeId}
          document={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            client.invalidateQueries({
              queryKey: ["employee-documents", employeeId],
            });
          }}
        />
      ) : null}

      {deleting ? (
        <ConfirmDocumentModal
          document={deleting}
          busy={remove.isPending}
          error={deleteError}
          onClose={() => {
            setDeleting(null);
            setDeleteError(null);
          }}
          onConfirm={() => remove.mutate(deleting.id)}
        />
      ) : null}
    </>
  );
}
