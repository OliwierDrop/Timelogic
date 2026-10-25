import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { ApiError, formatDateOnly, type UserPreferences } from "../../api";
import { Button, Message } from "../../components";
import { usePreferences } from "../../preferences/PreferencesContext";
import { AccountPrefRow, AccountSection, AccountTile } from "./AccountTile";

export function AccountPreferencesTab() {
  const { preferences, savePreferences } = usePreferences();
  const [draft, setDraft] = useState<UserPreferences>(preferences);
  const [info, setInfo] = useState<string | null>(null);

  const save = useMutation({
    mutationFn: () => savePreferences(draft),
    onSuccess: () => setInfo("Preferencje zapisane."),
  });

  const now = new Date();
  const hour12 = draft.time_format === "h12";
  const sampleDate = formatDateOnly(now, draft);
  const sampleTime = new Intl.DateTimeFormat(hour12 ? "en-US" : "pl-PL", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12,
    timeZone: "Europe/Warsaw",
  }).format(now);
  const sampleLong = new Intl.DateTimeFormat("pl-PL", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12,
    timeZone: "Europe/Warsaw",
  }).format(now);

  return (
    <AccountSection title="Preferencje">
      <form
        className="account-stack"
        onSubmit={(event) => {
          event.preventDefault();
          setInfo(null);
          save.mutate();
        }}
      >
        <AccountTile className="account-pref-tile">
          <AccountPrefRow label="Format daty">
            <select
              value={draft.date_format}
              onChange={(e) =>
                setDraft((prev) => ({
                  ...prev,
                  date_format: e.target.value as UserPreferences["date_format"],
                }))
              }
            >
              <option value="dmy">DD.MM.YYYY</option>
              <option value="ymd">YYYY-MM-DD</option>
              <option value="mdy">MM/DD/YYYY</option>
            </select>
          </AccountPrefRow>
          <AccountPrefRow label="24-godzinny format czasu" bare>
            <button
              type="button"
              role="switch"
              aria-checked={draft.time_format === "h24"}
              className={`account-switch${draft.time_format === "h24" ? " on" : ""}`}
              onClick={() =>
                setDraft((prev) => ({
                  ...prev,
                  time_format: prev.time_format === "h24" ? "h12" : "h24",
                }))
              }
            >
              <span className="account-switch-knob" />
            </button>
          </AccountPrefRow>
          <AccountPrefRow label="Początek tygodnia">
            <select
              value={draft.week_starts_on}
              onChange={(e) =>
                setDraft((prev) => ({
                  ...prev,
                  week_starts_on: e.target
                    .value as UserPreferences["week_starts_on"],
                }))
              }
            >
              <option value="monday">Poniedziałek</option>
              <option value="sunday">Niedziela</option>
            </select>
          </AccountPrefRow>
          <div className="account-pref-examples">
            <span className="account-pref-label">Przykłady formatowania</span>
            <p>
              {sampleLong} · {sampleDate} · {sampleTime}
            </p>
          </div>
        </AccountTile>

        <AccountTile className="account-pref-tile">
          <AccountPrefRow label="Motyw aplikacji">
            <select
              value={draft.theme}
              onChange={(e) =>
                setDraft((prev) => ({
                  ...prev,
                  theme: e.target.value as UserPreferences["theme"],
                }))
              }
            >
              <option value="system">System</option>
              <option value="light">Jasny</option>
              <option value="dark">Ciemny</option>
            </select>
          </AccountPrefRow>
        </AccountTile>

        {save.isError ? (
          <Message>{(save.error as ApiError).message}</Message>
        ) : null}
        {info ? <Message kind="success">{info}</Message> : null}
        <div className="account-actions">
          <Button busy={save.isPending} type="submit">
            Zapisz preferencje
          </Button>
        </div>
      </form>
    </AccountSection>
  );
}
