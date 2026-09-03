import { redirect } from "next/navigation";
import { getSession } from "@/lib/server/session";
import { getAdminNewsletters } from "@/lib/domains/newsletters";
import { unsubscribeCacheOnly } from "@/lib/domains/subscriptions";
import { submitUnsubscribeFeedback } from "./actions";

// Weeks per pause_period radio value; 0 is a separate "permanent" option.
// Matches templates/pages/page_newsletter-unsubscribed.html.twig exactly.
const PAUSE_PERIODS = [1, 2, 5];
const OTHER_REASON_VALUE = "Andet (udfyld)";

// Port of Controller::unsubscribeAction — note the unsubscribe itself
// happens on this GET (matching the old app exactly: visiting this URL *is*
// the action, there's no separate confirm step). Uses the admin/unsubscribing
// query path (getAdminNewsletters), not the public one, since the target
// newsletter may since have been unpublished.
export default async function UnsubscribePage(props: PageProps<"/unsubscribe">) {
  const session = await getSession();
  if (!session) redirect("/");

  const searchParams = await props.searchParams;
  const idParam = searchParams.id;
  const id = Array.isArray(idParam) ? idParam[0] : idParam;

  if (!id) {
    return (
      <main>
        <p>id:missing parameter</p>
      </main>
    );
  }

  const newsletters = await getAdminNewsletters();
  const matches = newsletters.filter((newsletter) => newsletter.id === id);

  if (matches.length !== 1) {
    return (
      <main>
        <p>Du er nu afmeldt nyhedsbrevet.</p>
      </main>
    );
  }

  await unsubscribeCacheOnly(session.email, id);
  const newsletter = matches[0];

  return (
    <main>
      <h1>Du er nu afmeldt {newsletter.title}</h1>
      <p>Fortæl os gerne hvorfor:</p>

      <form action={submitUnsubscribeFeedback}>
        <input type="hidden" name="newsletter_id" value={id} />

        <label>
          <input type="checkbox" name="reason" value="pause" />
          Sæt nyhedsbrevet på pause i stedet
        </label>
        <fieldset>
          <legend>Pause-periode</legend>
          {PAUSE_PERIODS.map((weeks, index) => (
            <label key={weeks}>
              <input
                type="radio"
                name="pause_period"
                value={weeks}
                defaultChecked={index === 0}
              />
              {weeks} {weeks === 1 ? "uge" : "uger"}
            </label>
          ))}
          <label>
            <input type="radio" name="pause_period" value={0} />
            Permanent pause
          </label>
        </fieldset>

        <label>
          <input type="checkbox" name="reason" value="Jeg har ikke tilmeldt mig nyhedsbrevet" />
          Jeg har ikke tilmeldt mig nyhedsbrevet
        </label>
        <label>
          <input type="checkbox" name="reason" value="Nyhedsbrevet interesserer mig ikke" />
          Nyhedsbrevet interesserer mig ikke
        </label>
        <label>
          <input type="checkbox" name="reason" value="Nyhedsbrevet kommer for ofte" />
          Nyhedsbrevet kommer for ofte
        </label>
        <label>
          <input type="checkbox" name="reason" value={OTHER_REASON_VALUE} />
          Andet
          <input type="text" name="reason-other_content" placeholder="Uddyb gerne" />
        </label>

        <button type="submit">Send</button>
      </form>
    </main>
  );
}
