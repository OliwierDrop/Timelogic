import { useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Check, FileText, Pencil, Trash2 } from "lucide-react";
import {
  ApiError,
  postForm,
  type DocumentCategory,
  type EmployeeDocument,
} from "../../api";
import { Button, Field, Message, Modal } from "../../components";
import {
  DOCUMENT_CATEGORIES,
  documentCategoryLabel,
  isAllowedDocumentFile,
} from "./documentCategories";

type WizardFile = {
  id: string;
  file: File;
  status: "ready" | "error";
  error?: string;
};

type DraftItem = {
  id: string;
  fileId: string;
  file: File;
  category: DocumentCategory;
  name: string;
  description: string;
  note: string;
  open: boolean;
};

type Step = "processing" | "verify" | "summary";

export function DocumentUploadWizard({
  employeeId,
  files,
  onClose,
  onDone,
}: {
  employeeId: string;
  files: File[];
  onClose: () => void;
  onDone: (docs: EmployeeDocument[]) => void;
}) {
  const initial = useMemo<WizardFile[]>(
    () =>
      files.map((file) => {
        const error = isAllowedDocumentFile(file);
        return {
          id: crypto.randomUUID(),
          file,
          status: error ? "error" : "ready",
          error: error || undefined,
        };
      }),
    [files],
  );
  const [step, setStep] = useState<Step>("processing");
  const [items] = useState(initial);
  const [categoryPick, setCategoryPick] = useState<DocumentCategory | "">("");
  const [drafts, setDrafts] = useState<DraftItem[]>([]);
  const [activeFileId, setActiveFileId] = useState<string | null>(
    initial.find((row) => row.status === "ready")?.id || null,
  );

  const readyItems = items.filter((row) => row.status === "ready");
  const activeFile =
    readyItems.find((row) => row.id === activeFileId) || readyItems[0] || null;

  const submit = useMutation({
    mutationFn: async () => {
      const created: EmployeeDocument[] = [];
      for (const draft of drafts) {
        const form = new FormData();
        form.append("file", draft.file);
        form.append("category", draft.category);
        form.append("name", draft.name.trim());
        if (draft.description.trim())
          form.append("description", draft.description.trim());
        if (draft.note.trim()) form.append("note", draft.note.trim());
        created.push(
          await postForm<EmployeeDocument>(
            `/employees/${employeeId}/documents`,
            form,
          ),
        );
      }
      return created;
    },
    onSuccess: (docs) => {
      onDone(docs);
      onClose();
    },
  });

  const addDraft = () => {
    if (!activeFile || !categoryPick) return;
    const baseName = activeFile.file.name.replace(/\.[^.]+$/, "");
    setDrafts((rows) => [
      ...rows.map((row) => ({ ...row, open: false })),
      {
        id: crypto.randomUUID(),
        fileId: activeFile.id,
        file: activeFile.file,
        category: categoryPick,
        name: baseName,
        description: "",
        note: "",
        open: true,
      },
    ]);
    setCategoryPick("");
  };

  const updateDraft = (id: string, patch: Partial<DraftItem>) => {
    setDrafts((rows) =>
      rows.map((row) => (row.id === id ? { ...row, ...patch } : row)),
    );
  };

  const removeDraft = (id: string) => {
    setDrafts((rows) => rows.filter((row) => row.id !== id));
  };

  const canGoSummary =
    drafts.length > 0 && drafts.every((d) => d.name.trim().length > 0);

  const title =
    step === "processing"
      ? "Przetwarzanie plików"
      : step === "verify"
        ? activeFile?.file.name || "Weryfikacja"
        : "Podsumowanie";

  return (
    <Modal
      title={title}
      description={
        step === "processing"
          ? "Sprawdzanie plików przed dodaniem do kartoteki"
          : step === "verify"
            ? "Przypisz kategorię i uzupełnij dane dokumentu"
            : "Sprawdź dokumenty przed wysłaniem do kartoteki"
      }
      layer={1}
      onClose={onClose}
      footer={
        <>
          {submit.isError && (
            <Message>{(submit.error as ApiError).message}</Message>
          )}
          <Button type="button" variant="quiet" onClick={onClose}>
            Anuluj
          </Button>
          {step === "processing" ? (
            <Button
              type="button"
              disabled={!readyItems.length}
              onClick={() => setStep("verify")}
            >
              Przejdź do weryfikacji
            </Button>
          ) : null}
          {step === "verify" ? (
            <Button
              type="button"
              disabled={!canGoSummary}
              onClick={() => setStep("summary")}
            >
              Przejdź do podsumowania
            </Button>
          ) : null}
          {step === "summary" ? (
            <Button
              type="button"
              busy={submit.isPending}
              disabled={!drafts.length}
              onClick={() => submit.mutate()}
            >
              Wyślij do kartoteki
            </Button>
          ) : null}
        </>
      }
    >
      {step === "processing" ? (
        <ul className="doc-process-list">
          {items.map((row) => (
            <li key={row.id} className="doc-process-row">
              <span className="doc-file-icon" aria-hidden>
                <FileText size={18} />
              </span>
              <div className="doc-process-meta">
                <strong>{row.file.name}</strong>
                {row.status === "ready" ? (
                  <span className="doc-status-ok">Przesyłanie zakończone</span>
                ) : (
                  <span className="doc-status-err">{row.error}</span>
                )}
              </div>
              {row.status === "ready" ? (
                <span className="doc-check" aria-hidden>
                  <Check size={14} strokeWidth={3} />
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}

      {step === "verify" ? (
        <div className="doc-verify">
          {readyItems.length > 1 ? (
            <Field label="Plik">
              <select
                value={activeFile?.id || ""}
                onChange={(e) => setActiveFileId(e.target.value)}
              >
                {readyItems.map((row) => (
                  <option key={row.id} value={row.id}>
                    {row.file.name}
                  </option>
                ))}
              </select>
            </Field>
          ) : null}
          <div className="doc-category-row">
            <Field label="Kategoria">
              <select
                value={categoryPick}
                onChange={(e) =>
                  setCategoryPick(e.target.value as DocumentCategory | "")
                }
              >
                <option value="">Wybierz kategorię</option>
                {DOCUMENT_CATEGORIES.map((row) => (
                  <option key={row.code} value={row.code}>
                    {row.label}
                  </option>
                ))}
              </select>
            </Field>
            <Button
              type="button"
              disabled={!categoryPick || !activeFile}
              onClick={addDraft}
            >
              + Dodaj
            </Button>
          </div>
          <div className="doc-draft-list">
            {drafts.map((draft) => (
              <div
                key={draft.id}
                className={`doc-draft-card${draft.open ? " is-open" : ""}`}
              >
                <div className="doc-draft-head">
                  <button
                    type="button"
                    className="doc-draft-toggle"
                    onClick={() =>
                      updateDraft(draft.id, { open: !draft.open })
                    }
                  >
                    <strong>{documentCategoryLabel(draft.category)}</strong>
                    <span className="subtle">
                      {" "}
                      ·{" "}
                      {
                        drafts
                          .filter((d) => d.category === draft.category)
                          .indexOf(draft) + 1
                      }
                    </span>
                  </button>
                  <button
                    type="button"
                    className="icon-button"
                    aria-label="Usuń"
                    onClick={() => removeDraft(draft.id)}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
                {draft.open ? (
                  <div className="doc-draft-body">
                    <Field label="Nazwa">
                      <input
                        value={draft.name}
                        onChange={(e) =>
                          updateDraft(draft.id, { name: e.target.value })
                        }
                        required
                      />
                    </Field>
                    <Field label="Opis">
                      <input
                        value={draft.description}
                        onChange={(e) =>
                          updateDraft(draft.id, {
                            description: e.target.value,
                          })
                        }
                      />
                    </Field>
                    <Field label="Notatka (opcj.)">
                      <textarea
                        rows={3}
                        placeholder="Notatka"
                        value={draft.note}
                        onChange={(e) =>
                          updateDraft(draft.id, { note: e.target.value })
                        }
                      />
                    </Field>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {step === "summary" ? (
        <ul className="doc-summary-list">
          {drafts.map((draft) => (
            <li key={draft.id} className="doc-summary-row">
              <span className="doc-file-icon" aria-hidden>
                <FileText size={18} />
              </span>
              <div className="doc-summary-meta">
                <strong>{draft.file.name}</strong>
                <span className="subtle">
                  {documentCategoryLabel(draft.category)}
                  {draft.name ? ` · ${draft.name}` : ""}
                </span>
              </div>
              <button
                type="button"
                className="icon-button"
                aria-label="Edytuj"
                onClick={() => setStep("verify")}
              >
                <Pencil size={16} />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </Modal>
  );
}
