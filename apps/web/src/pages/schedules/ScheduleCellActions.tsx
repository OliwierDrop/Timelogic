import {
  useEffect,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
} from "react";
import { createPortal } from "react-dom";

const CLOSE_DELAY_MS = 50;

export function ScheduleCellActions({
  showShift,
  showLeave,
  onAddShift,
  onAddLeave,
}: {
  showShift: boolean;
  showLeave: boolean;
  onAddShift: () => void;
  onAddLeave: () => void;
}) {
  const anchorRef = useRef<HTMLSpanElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const closeTimer = useRef<number | null>(null);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0, width: 0 });
  const enabled = showShift || showLeave;

  useEffect(() => {
    if (!enabled) {
      setOpen(false);
      return;
    }
    const cell = anchorRef.current?.closest(".schedule-cell");
    if (!cell || !(cell instanceof HTMLElement)) return;

    const clearClose = () => {
      if (closeTimer.current != null) {
        window.clearTimeout(closeTimer.current);
        closeTimer.current = null;
      }
    };

    const show = () => {
      clearClose();
      const rect = cell.getBoundingClientRect();
      setPos({
        top: rect.bottom,
        left: rect.left,
        width: rect.width,
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

    cell.addEventListener("mouseenter", show);
    cell.addEventListener("mouseleave", hide);
    return () => {
      clearClose();
      cell.removeEventListener("mouseenter", show);
      cell.removeEventListener("mouseleave", hide);
    };
  }, [enabled]);

  useEffect(() => {
    if (!open) return;
    const onScroll = () => setOpen(false);
    window.addEventListener("scroll", onScroll, true);
    return () => window.removeEventListener("scroll", onScroll, true);
  }, [open]);

  if (!enabled) return null;

  const keepOpen = () => {
    if (closeTimer.current != null) {
      window.clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
    setOpen(true);
  };

  const scheduleClose = (event: ReactMouseEvent<HTMLDivElement>) => {
    const related = event.relatedTarget;
    const cell = anchorRef.current?.closest(".schedule-cell");
    if (related instanceof Node && cell?.contains(related)) {
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
        className="schedule-cell-actions-anchor"
        aria-hidden
      />
      {open
        ? createPortal(
            <div
              ref={popoverRef}
              className="schedule-cell-actions-popover"
              style={{
                top: pos.top,
                left: pos.left,
                width: pos.width,
              }}
              onMouseEnter={keepOpen}
              onMouseLeave={scheduleClose}
            >
              {showShift ? (
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    setOpen(false);
                    onAddShift();
                  }}
                >
                  + Grafik
                </button>
              ) : null}
              {showLeave ? (
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    setOpen(false);
                    onAddLeave();
                  }}
                >
                  + Wniosek
                </button>
              ) : null}
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
