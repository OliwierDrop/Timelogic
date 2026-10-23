import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { MoreHorizontal, Pencil } from "lucide-react";
import type { Employee } from "../../api";

export function EmployeeRowActions({
  employee,
  canEdit,
  busy,
  onEdit,
  onResend,
  onDeactivate,
  onDelete,
}: {
  employee: Employee;
  canEdit: boolean;
  busy: boolean;
  onEdit: () => void;
  onResend: () => void;
  onDeactivate: () => void;
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
    const rect = trigger.getBoundingClientRect();
    const menuHeight = menu?.offsetHeight || 140;
    const menuWidth = menu?.offsetWidth || 220;
    const gap = 6;
    const spaceBelow = window.innerHeight - rect.bottom - gap;
    const openUp = spaceBelow < menuHeight && rect.top > spaceBelow;
    const top = openUp ? rect.top - gap - menuHeight : rect.bottom + gap;
    const left = Math.min(
      Math.max(8, rect.right - menuWidth),
      window.innerWidth - menuWidth - 8,
    );
    setCoords({
      top: Math.max(8, Math.min(top, window.innerHeight - menuHeight - 8)),
      left,
      openUp,
    });
  };

  useLayoutEffect(() => {
    if (!open) {
      setCoords(null);
      return;
    }
    updatePosition();
  }, [open, employee.status]);

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
        >
          {employee.status === "invited" && (
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                onResend();
              }}
            >
              Wyślij zaproszenie ponownie
            </button>
          )}
          {employee.status !== "inactive" && (
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                onDeactivate();
              }}
            >
              Dezaktywuj konto
            </button>
          )}
          <button
            type="button"
            role="menuitem"
            className="danger"
            onClick={() => {
              setOpen(false);
              onDelete();
            }}
          >
            Usuń z systemu
          </button>
        </div>,
        document.body,
      )
    : null;

  return (
    <div className="row-actions">
      <button
        type="button"
        className="icon-button"
        aria-label="Edytuj"
        onClick={onEdit}
      >
        <Pencil size={16} />
      </button>
      {canEdit ? (
        <>
          <button
            ref={triggerRef}
            type="button"
            className={`icon-button ${open ? "active" : ""}`}
            aria-label="Więcej opcji"
            aria-expanded={open}
            disabled={busy}
            onClick={() => setOpen((v) => !v)}
          >
            <MoreHorizontal size={16} />
          </button>
          {menu}
        </>
      ) : null}
    </div>
  );
}
