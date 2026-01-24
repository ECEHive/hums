import { createFileRoute } from "@tanstack/react-router";
import { Page, PageContent, PageHeader, PageTitle } from "@/components/layout";

export const Route = createFileRoute("/app/inventory/transactions")({
  component: () => <Transactions />,
});

export const permissions = {
  any: [],
};

function Transactions() {
  return (
    <Page>
      <PageHeader>
        <PageTitle>Transactions</PageTitle>
      </PageHeader>

      <PageContent>
        <div className="prose">
          <p>Transactions placeholder page for inventory.</p>
        </div>
      </PageContent>
    </Page>
  );
}

