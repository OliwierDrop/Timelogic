import {
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { createPortal } from "react-dom";
import type { Tag } from "../../api";
import { DEFAULT_TAG_COLOR } from "../../tags";

function TagBadge({ tag }: { tag: Tag }) {
  return (
    <span
      className={`tag-badge${tag.is_informational ? " is-info" : ""}`}
      style={
        {
          "--tag-color": tag.color || DEFAULT_TAG_COLOR,
        } as CSSProperties
      }
    >
      {tag.name}
    </span>
  );
}

export function ScheduleTags({ tags }: { tags: Tag[] }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLDivElement>(null);
  const closeTimer = useRef<number | null>(null);
  const [compact, setCompact] = useState(false);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });

  useLayoutEffect(() => {
    const wrap = wrapRef.current;
    const measure = measureRef.current;
    if (!wrap || !measure || !tags.length) {
      setCompact(false);
      return;
    }

    const update = () => {
      const available = wrap.getBoundingClientRect().width;
      if (available <= 0) return;
      setCompact(measure.scrollWidth > available + 1);
    };

    update();
    const ro = new ResizeObserver(update);
    ro.observe(wrap);
    const parent = wrap.parentElement;
    if (parent) ro.observe(parent);
    const nameCol = wrap.closest(".schedule-name-col");
    if (nameCol) ro.observe(nameCol);
    return () => ro.disconnect();
  }, [tags]);

  useLayoutEffect(() => {
    if (!open) return;
    const onScroll = () => setOpen(false);
    window.addEventListener("scroll", onScroll, true);
    return () => window.removeEventListener("scroll", onScroll, true);
  }, [open]);

  if (!tags.length) return null;

  const label = `Tagi: ${tags.map((tag) => tag.name).join(", ")}`;

  const clearClose = () => {
    if (closeTimer.current != null) {
      window.clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  };

  const showPopup = () => {
    clearClose();
    const rect = wrapRef.current?.getBoundingClientRect();
    if (!rect) return;
    setPos({ top: rect.bottom + 4, left: rect.left });
    setOpen(true);
  };

  const hidePopup = () => {
    clearClose();
    closeTimer.current = window.setTimeout(() => setOpen(false), 80);
  };

  return (
    <div
      className={`schedule-tags${compact ? " is-compact" : ""}`}
      ref={wrapRef}
      onMouseEnter={() => {
        if (compact) showPopup();
      }}
      onMouseLeave={() => {
        if (compact) hidePopup();
      }}
      onFocus={() => {
        if (compact) showPopup();
      }}
      onBlur={(event) => {
        if (
          compact &&
          !event.currentTarget.contains(event.relatedTarget as Node | null)
        ) {
          hidePopup();
        }
      }}
    >
      <div className="schedule-tag-measure" ref={measureRef} aria-hidden>
        {tags.map((tag) => (
          <TagBadge key={tag.id} tag={tag} />
        ))}
      </div>
      <div
        className="schedule-tag-dots"
        aria-label={label}
        tabIndex={compact ? 0 : -1}
      >
        {tags.map((tag) => (
          <span
            className="tag-color-dot"
            key={tag.id}
            title={tag.name}
            style={
              {
                background: tag.color || DEFAULT_TAG_COLOR,
              } as CSSProperties
            }
          />
        ))}
      </div>
      {!compact ? (
        <div className="schedule-tag-expand">
          {tags.map((tag) => (
            <TagBadge key={tag.id} tag={tag} />
          ))}
        </div>
      ) : null}
      {compact &&
        open &&
        createPortal(
          <div
            className="schedule-tag-popover"
            style={{ top: pos.top, left: pos.left }}
            onMouseEnter={showPopup}
            onMouseLeave={hidePopup}
          >
            {tags.map((tag) => (
              <TagBadge key={tag.id} tag={tag} />
            ))}
          </div>,
          document.body,
        )}
    </div>
  );
}
