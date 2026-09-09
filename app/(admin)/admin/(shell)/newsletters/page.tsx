import { getAdminNewsletters } from "@/lib/domains/newsletters";
import { getPromoGrid } from "@/lib/domains/promotions";
import { NewslettersWorkspace } from "./NewslettersWorkspace";

// Single admin surface for both "what newsletters exist" (previously
// /admin/newsletter-editor) and "how they're promoted on the frontpage"
// (previously /admin/promotions) — merged so editing a promoted newsletter's
// own details and its promotion settings is one flow, not two pages.
export default async function NewslettersPage() {
  const [newsletters, grid] = await Promise.all([getAdminNewsletters(), getPromoGrid()]);

  return (
    <main className="page">
      <h1>Nyhedsbreve</h1>
      <p className="page-intro">
        Forsiden viser rækker af 1-4 nyhedsbreve ad gangen. Skift til &quot;Alle nyhedsbreve&quot;
        for at redigere selve nyhedsbrevene.
      </p>
      <NewslettersWorkspace initialNewsletters={newsletters} initialGrid={grid} />
    </main>
  );
}
