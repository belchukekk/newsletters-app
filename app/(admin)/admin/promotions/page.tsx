import { getAdminNewsletters } from "@/lib/domains/newsletters";
import { getPromoGrid } from "@/lib/domains/promotions";
import { PromoGridEditor } from "./PromoGridEditor";

// New feature (not a legacy port): lets marketing configure the promo grid
// that replaces the frontpage's newsletter list — rows of 1-4 slots, each
// promoting a newsletter with an optional custom image and an optional
// fallback promotion for viewers already subscribed to the primary one.
export default async function PromotionsPage() {
  const [grid, newsletters] = await Promise.all([getPromoGrid(), getAdminNewsletters()]);

  return (
    <main className="page">
      <h1>Promoverede nyhedsbreve</h1>
      <p className="page-intro">
        Denne opsætning erstatter listen på forsiden. Træk i håndtaget for at ændre
        rækkefølgen af rækker.
      </p>
      <PromoGridEditor initialGrid={grid} newsletters={newsletters} />
    </main>
  );
}
