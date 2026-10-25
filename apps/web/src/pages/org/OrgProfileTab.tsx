import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, ApiError, patch } from "../../api";
import { Button, Field, Message } from "../../components";
import { AccountSection, AccountTile } from "../account/AccountTile";

type Organization = {
  id: string;
  name: string;
  timezone: string;
  public_origin: string;
  timezones: string[];
};

export function OrgProfileTab() {
  const client = useQueryClient();
  const org = useQuery({
    queryKey: ["organization"],
    queryFn: () => api<Organization>("/organization"),
  });
  const [name, setName] = useState("");
  const [timezone, setTimezone] = useState("Europe/Warsaw");
  const [info, setInfo] = useState<string | null>(null);

  useEffect(() => {
    if (!org.data) return;
    setName(org.data.name);
    setTimezone(org.data.timezone);
  }, [org.data]);

  const save = useMutation({
    mutationFn: () =>
      patch<Organization>("/organization", {
        name: name.trim(),
        timezone,
      }),
    onSuccess: (result) => {
      client.setQueryData(["organization"], result);
      setInfo("Zapisano ustawienia organizacji.");
    },
  });

  if (org.isPending) {
    return (
      <AccountSection title="Organizacja">
        <p className="subtle">Ładowanie…</p>
      </AccountSection>
    );
  }

  if (org.isError) {
    return (
      <AccountSection title="Organizacja">
        <Message>{(org.error as ApiError).message}</Message>
      </AccountSection>
    );
  }

  const zones = org.data.timezones?.length
    ? org.data.timezones
    : ["Europe/Warsaw", "UTC"];

  return (
    <AccountSection
      title="Organizacja"
      description="Nazwa widoczna w systemie oraz strefa używana do prezentacji dat i godzin."
    >
      <form
        className="account-stack"
        onSubmit={(event) => {
          event.preventDefault();
          setInfo(null);
          save.mutate();
        }}
      >
        <AccountTile title="Dane organizacji">
          <Field label="Nazwa">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              maxLength={200}
              autoComplete="organization"
            />
          </Field>
          <Field label="Strefa czasowa">
            <select
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
            >
              {!zones.includes(timezone) ? (
                <option value={timezone}>{timezone}</option>
              ) : null}
              {zones.map((zone) => (
                <option key={zone} value={zone}>
                  {zone}
                </option>
              ))}
            </select>
          </Field>
        </AccountTile>

        {info ? <Message kind="success">{info}</Message> : null}
        {save.isError ? (
          <Message>{(save.error as ApiError).message}</Message>
        ) : null}

        <div className="account-actions">
          <Button type="submit" busy={save.isPending}>
            Zapisz
          </Button>
        </div>
      </form>
    </AccountSection>
  );
}
