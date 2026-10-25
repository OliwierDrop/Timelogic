import type { PropsWithChildren, ReactNode } from "react";

export function AccountSection({
  title,
  description,
  children,
}: PropsWithChildren<{ title: string; description?: ReactNode }>) {
  return (
    <div className="account-section">
      <header className="account-section-head">
        <h2>{title}</h2>
        {description ? <p className="account-section-desc">{description}</p> : null}
      </header>
      {children}
    </div>
  );
}

export function AccountTile({
  title,
  children,
  className = "",
}: PropsWithChildren<{ title?: string; className?: string }>) {
  return (
    <section className={`account-tile ${className}`.trim()}>
      {title ? <h3 className="account-tile-title">{title}</h3> : null}
      {children}
    </section>
  );
}

export function AccountPrefRow({
  label,
  children,
  bare = false,
}: PropsWithChildren<{ label: string; bare?: boolean }>) {
  return (
    <div className={`account-pref-row${bare ? " bare" : ""}`}>
      <span className="account-pref-label">{label}</span>
      <div className="account-pref-control">{children}</div>
    </div>
  );
}
