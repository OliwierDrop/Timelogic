import type { ButtonHTMLAttributes, PropsWithChildren, ReactNode } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import * as Dialog from "@radix-ui/react-dialog";
import { LoaderCircle, X } from "lucide-react";

const buttonStyles = cva("button", {
  variants: {
    variant: {
      primary: "button-primary",
      quiet: "button-quiet",
      danger: "button-danger",
    },
    size: { regular: "button-regular", small: "button-small" },
  },
  defaultVariants: { variant: "primary", size: "regular" },
});
type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonStyles> & { busy?: boolean };

export function Button({
  variant,
  size,
  busy,
  children,
  className = "",
  disabled,
  ...props
}: ButtonProps) {
  return (
    <button
      className={`${buttonStyles({ variant, size })} ${className}`}
      disabled={disabled || busy}
      {...props}
    >
      {busy && <LoaderCircle className="spin" size={16} aria-hidden="true" />}
      {children}
    </button>
  );
}

export function Panel({
  title,
  action,
  children,
  className = "",
}: PropsWithChildren<{
  title?: string;
  action?: ReactNode;
  className?: string;
}>) {
  return (
    <section className={`panel ${className}`}>
      {(title || action) && (
        <div className="panel-heading">
          <h2>{title}</h2>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export function Empty({
  title,
  children,
}: PropsWithChildren<{ title: string }>) {
  return (
    <div className="empty">
      <strong>{title}</strong>
      <p>{children}</p>
    </div>
  );
}

export function Message({
  children,
  kind = "error",
}: PropsWithChildren<{ kind?: "error" | "success" }>) {
  return (
    <p
      className={`message message-${kind}`}
      role={kind === "error" ? "alert" : "status"}
    >
      {children}
    </p>
  );
}

export function Field({
  label,
  error,
  children,
}: PropsWithChildren<{ label: ReactNode; error?: string }>) {
  return (
    <div className="field">
      <span className="field-label">{label}</span>
      {children}
      {error && <small role="alert">{error}</small>}
    </div>
  );
}

export function Modal({
  title,
  description,
  onClose,
  children,
  footer,
  size = "regular",
  bare = false,
  /** 0 = baza; 1+ = nad innym modalem (przyciemnia ten pod spodem). */
  layer = 0,
}: PropsWithChildren<{
  title: string;
  description?: string;
  onClose: () => void;
  footer?: ReactNode;
  size?: "regular" | "wide" | "profile";
  bare?: boolean;
  layer?: number;
}>) {
  const sizeClass =
    size === "wide" ? "dialog-wide" : size === "profile" ? "dialog-profile" : "";
  const layerClass = layer > 0 ? `dialog-layer-${Math.min(layer, 3)}` : "";
  return (
    <Dialog.Root
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay
          className={`dialog-backdrop ${layerClass}`.trim()}
        />
        <Dialog.Content
          className={`dialog ${sizeClass} ${bare ? "dialog-bare" : ""} ${footer ? "dialog-has-footer" : ""} ${layerClass}`.trim()}
        >
          <Dialog.Close
            className="dialog-close icon-button"
            aria-label="Zamknij"
          >
            <X size={20} />
          </Dialog.Close>
          {bare ? (
            <>
              <Dialog.Title className="sr-only">{title}</Dialog.Title>
              <Dialog.Description className="sr-only">
                {description || title}
              </Dialog.Description>
              <div className="dialog-body dialog-body-bare">{children}</div>
            </>
          ) : (
            <>
              <div className="dialog-header">
                <Dialog.Title>{title}</Dialog.Title>
                {description ? (
                  <Dialog.Description>{description}</Dialog.Description>
                ) : (
                  <Dialog.Description className="sr-only">
                    {title}
                  </Dialog.Description>
                )}
              </div>
              <div className="dialog-body">{children}</div>
            </>
          )}
          {footer && <div className="dialog-footer">{footer}</div>}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
