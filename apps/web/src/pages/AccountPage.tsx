import { useState } from "react";
import { useOutletContext } from "react-router-dom";
import type { Me, User } from "../api";
import { PageHeading } from "../layout/PageHeading";
import { ACCOUNT_TABS, type AccountTabId } from "./account/accountTabs";
import { AccountPasswordTab } from "./account/AccountPasswordTab";
import { AccountPreferencesTab } from "./account/AccountPreferencesTab";
import { AccountProfileTab } from "./account/AccountProfileTab";
import { AccountSecurityTab } from "./account/AccountSecurityTab";

export function AccountPage() {
  const { user } = useOutletContext<{ user: User; me: Me }>();
  const [tab, setTab] = useState<AccountTabId>("profile");

  return (
    <div className="account-page">
      <PageHeading
        title="Ustawienia konta"
        description="Profil, zabezpieczenia, hasło i preferencje wyświetlania."
      />
      <nav className="account-tabs" aria-label="Sekcje ustawień konta">
        {ACCOUNT_TABS.map((item) => (
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
        {tab === "profile" ? <AccountProfileTab user={user} /> : null}
        {tab === "security" ? <AccountSecurityTab user={user} /> : null}
        {tab === "password" ? <AccountPasswordTab /> : null}
        {tab === "preferences" ? <AccountPreferencesTab /> : null}
      </div>
    </div>
  );
}
