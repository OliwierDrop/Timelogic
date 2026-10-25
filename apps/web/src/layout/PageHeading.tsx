import type { ReactNode } from "react";

export function PageHeading({
  title,
  titleAside,
  meta,
  action,
}: {
  title: string;
  /** @deprecated Descriptions under page titles are no longer shown. */
  description?: string;
  titleAside?: ReactNode;
  meta?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        <div className="page-heading-title-row">
          <h1>{title}</h1>
          {titleAside}
        </div>
        {meta}
      </div>
      {action}
    </div>
  );
}
