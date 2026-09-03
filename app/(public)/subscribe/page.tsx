import {
  getEmailFromCsid,
  getPublishedNewsletters,
} from "@/lib/domains/newsletters";
import { getSession } from "@/lib/server/session";
import { getUserSubscriptions } from "@/lib/domains/subscriptions";
import { SubscriptionToggleList } from "../_components/SubscriptionToggleList";

function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

// Port of Controller::subscribeAction — branches on session: logged-in users
// get the same AJAX toggle list as /manage (their current subscriptions
// pre-filled); anonymous visitors get the /save opt-in form.
export default async function SubscribePage(props: PageProps<"/subscribe">) {
  const searchParams = await props.searchParams;
  const idParam = searchParams.id;
  const csid = firstParam(searchParams.csid);

  const ids = Array.isArray(idParam) ? idParam : idParam ? [idParam] : [];

  const newsletters = await getPublishedNewsletters();
  const visibleNewsletters =
    ids.length > 0 ? newsletters.filter((n) => ids.includes(n.id)) : newsletters;

  const session = await getSession();

  if (session) {
    const subscribedIds = await getUserSubscriptions(session.email);
    return (
      <main className="page page--narrow">
        <h1>Tilmeld nyhedsbrev</h1>
        <SubscriptionToggleList
          newsletters={visibleNewsletters}
          subscribedIds={subscribedIds}
        />
      </main>
    );
  }

  const email = csid ? await getEmailFromCsid(csid) : "";
  const env = process.env.VERCEL_ENV === "production" ? "prod" : "dev";
  const primaryNewsletter = visibleNewsletters[0];

  return (
    <main className="page page--narrow">
      <h1>Tilmeld nyhedsbrev</h1>
      <form action="/save" method="post" id="form__subscribe">
        {visibleNewsletters.map((newsletter) => (
          <div className="form-field--checkbox" key={newsletter.id}>
            <input type="checkbox" id={`check-${newsletter.id}`} name="check-input" required />
            <label htmlFor={`check-${newsletter.id}`}>{newsletter.permission}</label>
          </div>
        ))}
        <div className="form-field">
          <label className="form-field__label" htmlFor="subscribe-email">
            E-mail
          </label>
          <input
            className="form-field__input"
            id="subscribe-email"
            type="email"
            name="email"
            defaultValue={email}
            required
          />
        </div>
        <input type="hidden" name="env" value={env} />
        <input
          type="hidden"
          name="newsletter_id"
          value={primaryNewsletter?.id ?? ""}
        />
        <button className="button" type="submit">
          Tilmeld
        </button>
      </form>
    </main>
  );
}
