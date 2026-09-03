import Link from "next/link";

// Port of the post-feedback state of page_newsletter-unsubscribed.html.twig
// ("Tak for dit svar") — landed on after submitUnsubscribeFeedback redirects
// here.
export default function UnsubscribeFeedbackPage() {
  return (
    <main className="page page--narrow">
      <h1>Tak for dit svar</h1>
      <p>Din tilbagemelding er modtaget.</p>
      <Link className="button" href="/manage">
        Til mine nyhedsbreve
      </Link>
    </main>
  );
}
