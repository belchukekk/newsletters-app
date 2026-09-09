import type { Newsletter } from "@/lib/domains/newsletters";
import { NewsletterSubscribeToggle } from "./NewsletterSubscribeToggle";

// Shared by /manage and /subscribe's logged-in branch — a list of AJAX
// toggles backed by /saveajax, port of the checkbox behavior in
// page_newsletter-administration.html.twig.
export function SubscriptionToggleList({
  newsletters,
  subscribedIds,
}: {
  newsletters: Newsletter[];
  subscribedIds: string[];
}) {
  return (
    <ul>
      {newsletters.map((newsletter) => (
        <li key={newsletter.id} className="toggle-row">
          <div className="toggle-row__text">
            <p className="toggle-row__title">{newsletter.title}</p>
            <p className="toggle-row__description">{newsletter.description}</p>
          </div>
          <NewsletterSubscribeToggle
            newsletterId={newsletter.id}
            newsletterTitle={newsletter.title}
            initialSubscribed={subscribedIds.includes(newsletter.id)}
          />
        </li>
      ))}
    </ul>
  );
}
