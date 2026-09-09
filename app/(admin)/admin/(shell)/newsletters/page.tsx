import { getAdminNewsletters } from "@/lib/domains/newsletters";
import { NewslettersWorkspace } from "./NewslettersWorkspace";

// The newsletter catalog — titles, descriptions, images, published status,
// and basic reordering. What's promoted where on the frontpage is now
// configured on its own full-viewport page, /admin/homepage (see the
// sidebar's "Forside" link) — a Puck-based editor, not this one.
export default async function NewslettersPage() {
  const newsletters = await getAdminNewsletters();

  return (
    <main className="page">
      <h1>Nyhedsbrevskatalog</h1>
      <p className="page-intro">
        Klik Rediger for at ændre titel, beskrivelse, billede eller udgivelsesstatus. Se
        &quot;Forside&quot; i menuen for at ændre, hvordan nyhedsbrevene promoveres på forsiden.
      </p>
      <NewslettersWorkspace initialNewsletters={newsletters} />
    </main>
  );
}
