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
      <main className="page page--narrow">
        <p>id:missing parameter</p>
      </main>
    );
  }

  const newsletters = await getAdminNewsletters();
  const matches = newsletters.filter((newsletter) => newsletter.id === id);

  if (matches.length !== 1) {
    return (
      <main className="page page--narrow">
        <p className="notice notice--success">Du er nu afmeldt nyhedsbrevet.</p>
      </main>
    );
  }

  await unsubscribeCacheOnly(session.email, id);
  const newsletter = matches[0];

  return (
    <main className="page page--narrow">
      <h1>Du er nu afmeldt {newsletter.title}</h1>
      <p className="page-intro">Fortæl os gerne hvorfor:</p>

      <form action={submitUnsubscribeFeedback}>
        <input type="hidden" name="newsletter_id" value={id} />

        <div className="form-field--checkbox">
          <input type="checkbox" id="reason-pause" name="reason" value="pause" />
          <label htmlFor="reason-pause">Sæt nyhedsbrevet på pause i stedet</label>
        </div>
        <fieldset>
          <legend>Pause-periode</legend>
          {PAUSE_PERIODS.map((weeks, index) => (
            <div className="form-field--checkbox" key={weeks}>
              <input
                type="radio"
                id={`pause-${weeks}`}
                name="pause_period"
                value={weeks}
                defaultChecked={index === 0}
              />
              <label htmlFor={`pause-${weeks}`}>
                {weeks} {weeks === 1 ? "uge" : "uger"}
              </label>
            </div>
          ))}
          <div className="form-field--checkbox">
            <input type="radio" id="pause-permanent" name="pause_period" value={0} />
            <label htmlFor="pause-permanent">Permanent pause</label>
          </div>
        </fieldset>

        <div className="form-field--checkbox">
          <input
            type="checkbox"
            id="reason-not-signed-up"
            name="reason"
            value="Jeg har ikke tilmeldt mig nyhedsbrevet"
          />
          <label htmlFor="reason-not-signed-up">Jeg har ikke tilmeldt mig nyhedsbrevet</label>
        </div>
        <div className="form-field--checkbox">
          <input
            type="checkbox"
            id="reason-not-interested"
            name="reason"
            value="Nyhedsbrevet interesserer mig ikke"
          />
          <label htmlFor="reason-not-interested">Nyhedsbrevet interesserer mig ikke</label>
        </div>
        <div className="form-field--checkbox">
          <input
            type="checkbox"
            id="reason-too-often"
            name="reason"
            value="Nyhedsbrevet kommer for ofte"
          />
          <label htmlFor="reason-too-often">Nyhedsbrevet kommer for ofte</label>
        </div>
        <div className="form-field--checkbox">
          <input type="checkbox" id="reason-other" name="reason" value={OTHER_REASON_VALUE} />
          <label htmlFor="reason-other">Andet</label>
        </div>
        <div className="form-field">
          <input
            className="form-field__input"
            type="text"
            name="reason-other_content"
            placeholder="Uddyb gerne"
          />
        </div>

        <button className="button" type="submit">
          Send
        </button>
      </form>
    </main>
  );
}
