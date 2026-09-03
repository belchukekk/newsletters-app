import { getAdminNewsletters } from "@/lib/domains/newsletters";
import { NewsletterEditorList } from "./NewsletterEditorList";

// Port of AdminController::newsletterEditorAction — admin sees unpublished
// newsletters too (no published=1 filter), from the separate
// newsletter_data_admin cache entry.
export default async function NewsletterEditorPage() {
  const newsletters = await getAdminNewsletters();

  return (
    <main>
      <h1>Nyhedsbreve</h1>
      <NewsletterEditorList initialNewsletters={newsletters} />
    </main>
  );
}
