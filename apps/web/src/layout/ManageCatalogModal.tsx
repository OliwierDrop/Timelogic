import { useMemo, useState } from "react";
import { Plus, Search, Trash2 } from "lucide-react";
import { Button, Message, Modal } from "../components";

export type CatalogItem = {
  id: string;
  name: string;
  color?: string;
  is_informational?: boolean;
};

type ManageCatalogModalProps = {
  title: string;
  items: CatalogItem[];
  addLabel?: string;
  busy?: boolean;
  error?: string | null;
  /** Nad modalem pracownika / edycji — przyciemnia warstwę pod spodem. */
  layer?: number;
  onClose: () => void;
  onAddClick: () => void;
  onEdit?: (item: CatalogItem) => void;
  onDelete: (ids: string[]) => void | Promise<void>;
};

export function ManageCatalogModal({
  title,
  items,
  addLabel = "Dodaj",
  busy = false,
  error = null,
  layer = 1,
  onClose,
  onAddClick,
  onEdit,
  onDelete,
}: ManageCatalogModalProps) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string[]>([]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((item) => item.name.toLowerCase().includes(q));
  }, [items, query]);

  const toggle = (id: string) => {
    setSelected((ids) =>
      ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id],
    );
  };

  return (
    <Modal
      title={title}
      size="wide"
      layer={layer}
      onClose={onClose}
      footer={
        <>
          {error && <Message>{error}</Message>}
          <Button type="button" variant="quiet" onClick={onClose}>
            Zamknij
          </Button>
        </>
      }
    >
      <div className="manage-catalog">
        <div className="manage-catalog-toolbar">
          <div className="manage-catalog-actions">
            <Button
              type="button"
              variant="quiet"
              size="small"
              onClick={onAddClick}
            >
              <Plus size={14} /> {addLabel}
            </Button>
            <Button
              type="button"
              variant="quiet"
              size="small"
              disabled={!selected.length || busy}
              busy={busy}
              onClick={() => {
                void Promise.resolve(onDelete(selected)).then(() =>
                  setSelected([]),
                );
              }}
            >
              <Trash2 size={14} /> Usuń
            </Button>
          </div>
          <label className="manage-catalog-search">
            <Search size={14} />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Szukaj"
            />
          </label>
        </div>

        {filtered.length ? (
          <ul className="manage-catalog-list">
            {filtered.map((item) => (
              <li key={item.id}>
                <div className="manage-catalog-row">
                  <label className="manage-catalog-check">
                    <input
                      type="checkbox"
                      checked={selected.includes(item.id)}
                      onChange={() => toggle(item.id)}
                    />
                  </label>
                  {item.color ? (
                    <span
                      className="tag-color-dot"
                      style={{ background: item.color }}
                      aria-hidden
                    />
                  ) : null}
                  {onEdit ? (
                    <button
                      type="button"
                      className="manage-catalog-edit"
                      onClick={() => onEdit(item)}
                    >
                      {item.name}
                      {item.is_informational ? (
                        <span className="subtle"> · informacyjny</span>
                      ) : null}
                    </button>
                  ) : (
                    <span>
                      {item.name}
                      {item.is_informational ? (
                        <span className="subtle"> · informacyjny</span>
                      ) : null}
                    </span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="manage-catalog-empty">Ta lista jest pusta.</p>
        )}
      </div>
    </Modal>
  );
}
