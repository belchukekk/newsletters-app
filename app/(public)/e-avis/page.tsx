import { headers } from "next/headers";
import { decryptInfosoftId } from "@/lib/integrations/e-avis-crypto";

type Device = "ios" | "android" | null;

// Mirrors Mobile_Detect's isiOS()/isAndroidOS() checks used by EAvis.php,
// checked in the same order (iOS before Android).
function detectDevice(userAgent: string): Device {
  if (/\biPhone.*Mobile|\biPod|\biPad|AppleCoreMedia/i.test(userAgent)) return "ios";
  if (/Android/i.test(userAgent)) return "android";
  return null;
}

function buildLinks(device: Device, infosoftId: string | null, hash: string | undefined) {
  if (device === "ios") {
    return {
      openApp: infosoftId
        ? `kristeligtdagblad://open?savedvoucher=${infosoftId}`
        : "kristeligtdagblad://open",
      getApp: "https://itunes.apple.com/dk/app/kristeligt-dagblad/id547578719?mt=8",
    };
  }
  if (device === "android") {
    return {
      openApp: `intent://reader/#Intent;scheme=kristeligtdagblad;package=dk.kristeligtdagblad.areader;S.argument=open;S.customer=kristeligtdagblad;S.subscription_number=${infosoftId ?? ""};end`,
      getApp: "https://play.google.com/store/apps/details?id=dk.kristeligtdagblad.areader",
    };
  }
  return {
    openApp: hash
      ? `https://k.dk/service/access?&path=e-avis&subscription=${encodeURIComponent(hash)}`
      : "https://www.kristeligt-dagblad.dk/e-avis",
    getApp: null as string | null,
  };
}

// Port of Controller::eAvisAction / EAvis.php — fully self-contained: no
// session, no DB writes, just AES decrypt + device detect + static links.
export default async function EAvisPage(props: PageProps<"/e-avis">) {
  const searchParams = await props.searchParams;
  const hashParam = searchParams.subscription;
  const hash = Array.isArray(hashParam) ? hashParam[0] : hashParam;

  const infosoftId = hash ? decryptInfosoftId(hash) : null;
  const userAgent = (await headers()).get("user-agent") ?? "";
  const device = detectDevice(userAgent);
  const links = buildLinks(device, infosoftId, hash);

  return (
    <main data-infosoft={infosoftId !== null}>
      <h1>Kristeligt Dagblads e-avis</h1>

      {device ? (
        <div>
          <a id="button-app" href={links.openApp}>
            Åbn i app
          </a>
          {links.getApp && <a href={links.getApp}>Hent app</a>}
        </div>
      ) : (
        <div>
          <a href={links.openApp}>Læs e-avisen</a>
          <form action="/send-sms" method="post" id="sms_form">
            <label htmlFor="phone">Få et link til appen på SMS</label>
            <input type="tel" id="phone" name="phone" pattern="^\d{8}$" required />
            <input type="hidden" name="subscription" value={hash ?? ""} />
            <button type="submit">Send SMS</button>
          </form>
        </div>
      )}
    </main>
  );
}
