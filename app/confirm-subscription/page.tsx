import { ConfirmSubscription } from "./ConfirmSubscription";

function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

// Port of Controller::confirmSubscription (GET) — the old app rendered a
// hidden-field form that auto-submitted via JS as a POST (anti-prefetch, so
// mail-scanner/crawler GETs never confirm anything). ConfirmSubscription
// reproduces that property with a client-side effect instead of a real form.
export default async function ConfirmSubscriptionPage(
  props: PageProps<"/confirm-subscription">
) {
  const searchParams = await props.searchParams;
  const id = firstParam(searchParams.id);
  const chk = firstParam(searchParams.chk);

  if (!id || !chk) {
    return (
      <main>
        <p>Mangler parametre.</p>
      </main>
    );
  }

  return (
    <main>
      <ConfirmSubscription id={id} chk={chk} />
    </main>
  );
}
