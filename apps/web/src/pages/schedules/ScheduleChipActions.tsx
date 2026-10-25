import {
  useEffect,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
} from "react";
import { createPortal } from "react-dom";
import { Pencil, Trash2 } from "lucide-react";
import { isScheduleCellFullyVisible } from "./scheduleVisibility";

const CLOSE_DELAY_MS = 50;

export function ScheduleChipActions({
  showEdit,
  onEdit,
  onDelete,
}: {
  showEdit: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const anchorRef = useRef<HTMLSpanElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const closeTimer = useRef<number | null>(null);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0, height: 0 });

  useEffect(() => {
    const chip = anchorRef.current?.closest(".schedule-chip");
    if (!chip || !(chip instanceof HTMLElement)) return;

    const clearClose = () => {
      if (closeTimer.current != null) {
        window.clearTimeout(closeTimer.current);
        closeTimer.current = null;
      }
    };

    const show = () => {
      clearClose();
      const cell = chip.closest(".schedule-cell");
      if (
        !(cell instanceof HTMLElement) ||
        !isScheduleCellFullyVisible(cell)
      ) {
        setOpen(false);
        return;
      }
      const rect = chip.getBoundingClientRect();
      setPos({
        top: rect.top,
        left: rect.right + 4,
        height: Math.max(rect.height, 40),
      });
      setOpen(true);
    };

    const hide = (event: MouseEvent) => {
      const related = event.relatedTarget;
      if (related instanceof Node && popoverRef.current?.contains(related)) {
        return;
      }
      clearClose();
      closeTimer.current = window.setTimeout(
        () => setOpen(false),
        CLOSE_DELAY_MS,
      );
    };

    chip.addEventListener("mouseenter", show);
    chip.addEventListener("mouseleave", hide);
    return () => {
      clearClose();
      chip.removeEventListener("mouseenter", show);
      chip.removeEventListener("mouseleave", hide);
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    const onScroll = () => setOpen(false);
    window.addEventListener("scroll", onScroll, true);
    return () => window.removeEventListener("scroll", onScroll, true);
  }, [open]);

  const keepOpen = () => {
    if (closeTimer.current != null) {
      window.clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
    setOpen(true);
  };

  const scheduleClose = (event: ReactMouseEvent<HTMLDivElement>) => {
    const related = event.relatedTarget;
    const chip = anchorRef.current?.closest(".schedule-chip");
    if (related instanceof Node && chip?.contains(related)) {
      return;
    }
    if (closeTimer.current != null) {
      window.clearTimeout(closeTimer.current);
    }
    closeTimer.current = window.setTimeout(
      () => setOpen(false),
      CLOSE_DELAY_MS,
    );
  };

  return (
    <>
      <span
        ref={anchorRef}
        className="schedule-chip-actions-anchor"
        aria-hidden
      />
      {open
        ? createPortal(
            <div
              ref={popoverRef}
              className="schedule-chip-actions-popover"
              style={{
                top: pos.top,
                left: pos.left,
                minHeight: pos.height,
              }}
              onMouseEnter={keepOpen}
              onMouseLeave={scheduleClose}
            >
              {showEdit ? (
                <button
                  type="button"
                  aria-label="Edytuj grafik"
                  title="Edytuj"
                  onClick={(event) => {
                    event.stopPropagation();
                    setOpen(false);
                    onEdit();
                  }}
                >
                  <Pencil size={14} />
                </button>
              ) : null}
              <button
                type="button"
                aria-label="Usuń grafik"
                title="Usuń"
                onClick={(event) => {
                  event.stopPropagation();
                  setOpen(false);
                  onDelete();
                }}
              >
                <Trash2 size={14} />
              </button>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
