import { useState } from "react";
import { PageHeading } from "../layout/PageHeading";
import { OrgAuditTab } from "./org/OrgAuditTab";
import { OrgMailTab } from "./org/OrgMailTab";
import { OrgProfileTab } from "./org/OrgProfileTab";
import { ORG_TABS, type OrgTabId } from "./org/orgTabs";

export function OrgSettingsPage() {
  const [tab, setTab] = useState<OrgTabId>("profile");

  return (
    <div className="account-page">
      <PageHeading
        title="Ustawienia organizacji"
        description="Nazwa, strefa czasowa, poczta SMTP i dziennik audytu."
      />
      <nav className="account-tabs" aria-label="Sekcje ustawień organizacji">
        {ORG_TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`account-tab${tab === item.id ? " active" : ""}`}
            aria-current={tab === item.id ? "page" : undefined}
            onClick={() => setTab(item.id)}
          >
            {item.label}
          </button>
        ))}
      </nav>
      <div className="account-tab-panels">
        {tab === "profile" ? <OrgProfileTab /> : null}
        {tab === "mail" ? <OrgMailTab /> : null}
        {tab === "audit" ? <OrgAuditTab /> : null}
      </div>
    </div>
  );
}
