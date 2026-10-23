import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import {
  ApiError,
  patch,
  type DocumentCategory,
  type EmployeeDocument,
} from "../../api";
import { Button, Field, Message, Modal } from "../../components";
import { DOCUMENT_CATEGORIES } from "./documentCategories";

export function DocumentEditModal({
  employeeId,
  document,
  onClose,
  onSaved,
}: {
  employeeId: string;
  document: EmployeeDocument;
  onClose: () => void;
  onSaved: (row: EmployeeDocument) => void;
}) {
  const [category, setCategory] = useState<DocumentCategory>(document.category);
  const [name, setName] = useState(document.name);
  const [description, setDescription] = useState(document.description || "");
  const [note, setNote] = useState(document.note || "");

  const save = useMutation({
    mutationFn: () =>
      patch<EmployeeDocument>(
        `/employees/${employeeId}/documents/${document.id}`,
        {
          category,
          name: name.trim(),
          description: description.trim() || null,
          note: note.trim() || null,
        },
      ),
    onSuccess: (row) => {
      onSaved(row);
      onClose();
    },
  });

  return (
    <Modal
      title="Edytuj dokument"
      description={document.original_filename}
      layer={1}
      onClose={onClose}
      footer={
        <>
          {save.isError && (
            <Message>{(save.error as ApiError).message}</Message>
          )}
          <Button type="button" variant="quiet" onClick={onClose}>
            Anuluj
          </Button>
          <Button
            type="button"
            busy={save.isPending}
            disabled={!name.trim()}
            onClick={() => save.mutate()}
          >
            Zapisz
          </Button>
        </>
      }
    >
      <form
        className="modal-form"
        onSubmit={(e) => {
          e.preventDefault();
          save.mutate();
        }}
      >
        <Field label="Kategoria">
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as DocumentCategory)}
          >
            {DOCUMENT_CATEGORIES.map((row) => (
              <option key={row.code} value={row.code}>
                {row.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Nazwa">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </Field>
        <Field label="Opis">
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </Field>
        <Field label="Notatka (opcj.)">
          <textarea
            rows={3}
            placeholder="Notatka"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </Field>
      </form>
    </Modal>
  );
}
