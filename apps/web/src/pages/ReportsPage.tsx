import { PageHeading } from "../layout/PageHeading";
import { Empty, Panel } from "../components";

export function ReportsPage() {
  return (
    <>
      <PageHeading title="Raporty" />
      <Panel>
        <Empty title="Raporty w przygotowaniu">
          Wkrótce pojawią się tu eksporty i podsumowania dla zespołu.
        </Empty>
      </Panel>
    </>
  );
}
