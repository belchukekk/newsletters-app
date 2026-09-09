import { redirect } from "next/navigation";
import { auth } from "@/lib/server/auth-admin";
import { getGdprOverview } from "@/lib/integrations/bigquery";
import { isGdprDeleteRequested, requestGdprDelete } from "@/lib/domains/gdpr";
import { GdprEventsTable } from "../GdprEventsTable";

// Port of AdminController::gdprDeleteAction. Note: the existing-request
// check here is a deliberate fix over the legacy version — see the comment
// in lib/domains/gdpr.ts.
export default async function GdprDeletePage(props: PageProps<"/admin/gdpr/delete">) {
  const session = await auth();
  const email = session!.user!.email!;
  const searchParams = await props.searchParams;

  if (searchParams.gdpr_delete !== undefined) {
    if (!(await isGdprDeleteRequested(email))) {
      await requestGdprDelete(email);
    }
    redirect("/admin/gdpr/delete");
  }

  const [deleteRequested, events] = await Promise.all([
    isGdprDeleteRequested(email),
    getGdprOverview(email),
  ]);

  return (
    <main className="page">
      <h1>Slet mine data</h1>
      {deleteRequested ? (
        <p className="notice notice--info">
          Sletteanmodning modtaget for denne email. Sletning udføres ved midnat.
        </p>
      ) : (
        <>
          <GdprEventsTable events={events} />
          <form action="/admin/gdpr/delete" method="get">
            <button className="button button--secondary" type="submit" name="gdpr_delete" value="1">
              Anmod om sletning
            </button>
          </form>
        </>
      )}
    </main>
  );
}
