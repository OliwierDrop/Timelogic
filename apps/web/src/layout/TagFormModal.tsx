import { useEffect, useState } from "react";
import { Check } from "lucide-react";
import type { Tag } from "../api";
import { Button, Field, Message, Modal } from "../components";
import { DEFAULT_TAG_COLOR, TAG_COLORS } from "../tags";

type TagFormModalProps = {
  tag?: Tag | null;
  layer?: number;
  busy?: boolean;
  error?: string | null;
  onClose: () => void;
  onSave: (values: {
    name: string;
    color: string;
    is_informational: boolean;
  }) => void | Promise<void>;
};

export function TagFormModal({
  tag = null,
  layer = 1,
  busy = false,
  error = null,
  onClose,
  onSave,
}: TagFormModalProps) {
  const editing = Boolean(tag);
  const [name, setName] = useState(tag?.name || "");
  const [color, setColor] = useState(tag?.color || DEFAULT_TAG_COLOR);
  const [isInformational, setIsInformational] = useState(
    Boolean(tag?.is_informational),
  );

  useEffect(() => {
    setName(tag?.name || "");
    setColor(tag?.color || DEFAULT_TAG_COLOR);
    setIsInformational(Boolean(tag?.is_informational));
  }, [tag]);

  return (
    <Modal
      title={editing ? "Edytuj tag" : "Dodaj tag"}
      layer={layer}
      onClose={onClose}
      footer={
        <>
          {error && <Message>{error}</Message>}
          <Button type="button" variant="quiet" onClick={onClose}>
            Anuluj
          </Button>
          <Button
            type="submit"
            form="tag-form"
            busy={busy}
            disabled={!name.trim()}
          >
            Zapisz
          </Button>
        </>
      }
    >
      <form
        id="tag-form"
        className="tag-form modal-form"
        onSubmit={(e) => {
          e.preventDefault();
          const trimmed = name.trim();
          if (!trimmed) return;
          void onSave({
            name: trimmed,
            color,
            is_informational: isInformational,
          });
        }}
      >
        <section className="tag-form-section">
          <h3>Informacje podstawowe</h3>
          <Field label="Nazwa">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nazwa"
              required
              autoFocus
              maxLength={80}
            />
          </Field>
        </section>

        <section className="tag-form-section">
          <h3>Kolor</h3>
          <div className="tag-color-grid" role="listbox" aria-label="Kolor tagu">
            {TAG_COLORS.map((swatch) => {
              const selected = color.toUpperCase() === swatch.toUpperCase();
              return (
                <button
                  key={swatch}
                  type="button"
                  role="option"
                  aria-selected={selected}
                  className={`tag-color-swatch${selected ? " is-selected" : ""}`}
                  style={{ background: swatch }}
                  onClick={() => setColor(swatch)}
                  title={swatch}
                >
                  {selected && <Check size={14} strokeWidth={3} />}
                </button>
              );
            })}
          </div>
        </section>

        <label className="tag-info-toggle">
          <div>
            <strong>Tag informacyjny</strong>
            <p>
              Używany wyłącznie do sortowania i grupowania. Widoczny tylko dla
              menedżerów, HR i administratorów.
            </p>
          </div>
          <input
            type="checkbox"
            className="switch"
            checked={isInformational}
            onChange={(e) => setIsInformational(e.target.checked)}
          />
        </label>
      </form>
    </Modal>
  );
}
