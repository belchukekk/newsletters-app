import Link from "next/link";
import { getPublishedNewsletters } from "@/lib/domains/newsletters";

// Port of Controller::frontpageAction — anonymous-only for now (the
// admin/logged-in-user redirects land in later phases once session.ts exists).
export default async function HomePage() {
  const newsletters = await getPublishedNewsletters();

  return (
    <main className="page">
      <h1>Nyhedsbreve fra Kristeligt Dagblad</h1>
      <p className="page-intro">
        Vælg de nyhedsbreve, du vil modtage, og hold dig opdateret med det, der
        betyder noget for dig.
      </p>
      <ul className="newsletter-list">
        {newsletters.map((newsletter) => (
          <li key={newsletter.id} className="newsletter-card">
            {/* eslint-disable-next-line @next/next/no-img-element -- thumbnail hosts vary (local default vs. future S3), not worth a remotePatterns config yet */}
            <img
              className="newsletter-card__media"
              src={newsletter.imageUrl}
              alt=""
              width={72}
              height={72}
            />
            <div className="newsletter-card__body">
              <h2 className="newsletter-card__title">{newsletter.title}</h2>
              <p className="newsletter-card__description">{newsletter.description}</p>
              <Link className="newsletter-card__link" href={`/subscribe?id=${newsletter.id}`}>
                Tilmeld
              </Link>
            </div>
          </li>
        ))}
      </ul>
    </main>
  );
}
