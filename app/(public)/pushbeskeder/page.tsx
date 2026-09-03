import { getNotificationSettings, getPushLists } from "@/lib/domains/push";
import { PushToggleList } from "./PushToggleList";

function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

// Port of Controller::pushPermissionsAction (GET) — push notification
// preferences for a device, identified by `pushtoken` (a mobile-app webview
// context, not a browser session).
export default async function PushbeskederPage(props: PageProps<"/pushbeskeder">) {
  const searchParams = await props.searchParams;
  const pushToken = firstParam(searchParams.pushtoken);
  const sys = firstParam(searchParams.sys);

  if (!pushToken) {
    return (
      <main className="page page--narrow">
        <p>Mangler pushtoken.</p>
      </main>
    );
  }

  const lists = await getPushLists();
  const settings = await getNotificationSettings(pushToken, lists);

  return (
    <main className="page page--narrow">
      <h1>Push-beskeder</h1>
      <PushToggleList
        lists={lists}
        settings={settings}
        pushToken={pushToken}
        sys={sys === "1" || sys === "true"}
      />
    </main>
  );
}
