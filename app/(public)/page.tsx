import Link from "next/link";
import { getPublishedNewsletters } from "@/lib/domains/newsletters";

// Port of Controller::frontpageAction — anonymous-only for now (the
// admin/logged-in-user redirects land in later phases once session.ts exists).
export default async function HomePage() {
  const newsletters = await getPublishedNewsletters();

  return (
    <main>
      <h1>Nyhedsbreve fra Kristeligt Dagblad</h1>
      <ul>
        {newsletters.map((newsletter) => (
          <li key={newsletter.id}>
            {/* eslint-disable-next-line @next/next/no-img-element -- thumbnail hosts vary (local default vs. future S3), not worth a remotePatterns config yet */}
            <img src={newsletter.imageUrl} alt="" width={88} height={88} />
            <h2>{newsletter.title}</h2>
            <p>{newsletter.description}</p>
            <Link href={`/subscribe?id=${newsletter.id}`}>Tilmeld</Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
