import { getAdminNewsletters } from "@/lib/domains/newsletters";
import { NewsletterEditorList } from "./NewsletterEditorList";

// Port of AdminController::newsletterEditorAction — admin sees unpublished
// newsletters too (no published=1 filter), from the separate
// newsletter_data_admin cache entry.
export default async function NewsletterEditorPage() {
  const newsletters = await getAdminNewsletters();

  return (
    <main className="page">
      <h1>Nyhedsbreve</h1>
      <p className="page-intro">
        Træk i håndtaget for at ændre rækkefølgen. Hver ændring gemmes for sig, når du klikker
        Gem på det enkelte nyhedsbrev.
      </p>
      <NewsletterEditorList initialNewsletters={newsletters} />
    </main>
  );
}
