import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Eye, MoreHorizontal } from "lucide-react";

function portalRoot(trigger: HTMLElement | null): HTMLElement {
  // Radix Dialog blokuje pointer-events poza Content — menu musi być wewnątrz dialogu
  const dialog = trigger?.closest('[role="dialog"]');
  return (dialog as HTMLElement) || document.body;
}

export function DocumentRowActions({
  busy,
  canEdit,
  onPreview,
  onDownload,
  onEdit,
  onDelete,
}: {
  busy?: boolean;
  canEdit: boolean;
  onPreview: () => void;
  onDownload: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<{
    top: number;
    left: number;
    openUp: boolean;
  } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const updatePosition = () => {
    const trigger = triggerRef.current;
    const menu = menuRef.current;
    if (!trigger) return;
    const dialog = trigger.closest('[role="dialog"]') as HTMLElement | null;
    const rect = trigger.getBoundingClientRect();
    const menuHeight = menu?.offsetHeight || 140;
    const menuWidth = menu?.offsetWidth || 180;
    const gap = 6;
    const spaceBelow = window.innerHeight - rect.bottom - gap;
    const openUp = spaceBelow < menuHeight && rect.top > spaceBelow;
    let top = openUp ? rect.top - gap - menuHeight : rect.bottom + gap;
    let left = Math.min(
      Math.max(8, rect.right - menuWidth),
      window.innerWidth - menuWidth - 8,
    );
    // .dialog ma transform → fixed jest względem dialogu, nie viewportu
    if (dialog) {
      const box = dialog.getBoundingClientRect();
      top -= box.top;
      left -= box.left;
    }
    setCoords({ top, left, openUp });
  };

  useLayoutEffect(() => {
    if (!open) {
      setCoords(null);
      return;
    }
    updatePosition();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        menuRef.current?.contains(target) ||
        triggerRef.current?.contains(target)
      ) {
        return;
      }
      setOpen(false);
    };
    const onReposition = () => updatePosition();
    document.addEventListener("mousedown", onPointer);
    window.addEventListener("resize", onReposition);
    window.addEventListener("scroll", onReposition, true);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      window.removeEventListener("resize", onReposition);
      window.removeEventListener("scroll", onReposition, true);
    };
  }, [open]);

  const menu = open
    ? createPortal(
        <div
          ref={menuRef}
          className={`row-actions-menu${coords?.openUp ? " is-up" : ""}`}
          role="menu"
          style={
            coords
              ? { top: coords.top, left: coords.left, visibility: "visible" }
              : { visibility: "hidden", top: 0, left: 0 }
          }
          onPointerDown={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              onDownload();
            }}
          >
            Pobierz
          </button>
          {canEdit ? (
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                onEdit();
              }}
            >
              Edytuj
            </button>
          ) : null}
          {canEdit ? (
            <button
              type="button"
              role="menuitem"
              className="danger"
              disabled={busy}
              onClick={() => {
                setOpen(false);
                onDelete();
              }}
            >
              Usuń
            </button>
          ) : null}
        </div>,
        portalRoot(triggerRef.current),
      )
    : null;

  return (
    <div className="row-actions">
      <button
        type="button"
        className="icon-button"
        aria-label="Podgląd dokumentu"
        onClick={onPreview}
      >
        <Eye size={16} />
      </button>
      <button
        ref={triggerRef}
        type="button"
        className={`icon-button${open ? " active" : ""}`}
        aria-label="Więcej opcji"
        aria-expanded={open}
        disabled={busy}
        onClick={() => setOpen((v) => !v)}
      >
        <MoreHorizontal size={16} />
      </button>
      {menu}
    </div>
  );
}
