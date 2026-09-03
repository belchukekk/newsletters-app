import type { RowDataPacket } from "mysql2";
import { NextResponse } from "next/server";
import { getPool } from "@/lib/server/db";
import { decryptInfosoftId, encryptInfosoftId } from "@/lib/integrations/e-avis-crypto";
import { sendSms } from "@/lib/integrations/inmobile-sms";

const SMS_SENDER_NAME = "Kr. Dagblad";
const EAVIS_URL_TEMPLATE = "https://nyhedsbreve.kristeligt-dagblad.dk/e-avis?subscription=";
const SMS_TEXT_WITH_CUSTOMER =
  "Gå til app - og klik på knappen 'Log ind i app': %s. Hvis du ikke har hentet Kristeligt Dagblads app, skal du klikke på knappen 'Hent app'. Er du ikke logget ind i app'en, så log ind med abonnementsnr: %d i feltet 'Abonnementsnummer'.";
const SMS_TEXT_NO_CUSTOMER =
  "Hent Kristeligt Dagblads app her: https://nyhedsbreve.kristeligt-dagblad.dk/e-avis. Login med samme oplysninger som på www.k.dk, eller kontakt kundeservice på tlf. 33 48 05 05 eller abonnement@k.dk";

interface InfosoftRow extends RowDataPacket {
  infosoft_id: number;
}

// Port of Controller::getInfosoftId — resolves the target's Infosoft
// subscriber id either from an already-encrypted hash (subscription param,
// carried over from /e-avis) or by phone lookup in customer_infosoft.
async function resolveInfosoftId(
  phone: string,
  hash: string | undefined
): Promise<{ infosoftId: string | null; hash: string | undefined }> {
  if (hash) {
    return { infosoftId: decryptInfosoftId(hash), hash };
  }

  const pool = await getPool();
  const [rows] = await pool.query<InfosoftRow[]>(
    `SELECT * FROM kd_customer.customer_infosoft WHERE phone1 LIKE ? OR phone2 LIKE ? LIMIT 1`,
    [phone, phone]
  );
  const infosoftId = rows[0]?.infosoft_id;
  if (infosoftId === undefined) return { infosoftId: null, hash: undefined };

  const infosoftIdStr = String(infosoftId);
  return { infosoftId: infosoftIdStr, hash: encryptInfosoftId(infosoftIdStr) ?? undefined };
}

// Port of Controller::smsAction (/send-sms, AJAX-only) — looks up a
// subscriber by phone and sends an SMS with an e-avis deep link via
// InMobile's custom protocol.
export async function POST(request: Request) {
  const formData = await request.formData();
  const phone = String(formData.get("phone") ?? "").trim();
  const subscriptionParam = formData.get("subscription");
  const hash =
    typeof subscriptionParam === "string" && subscriptionParam ? subscriptionParam : undefined;

  if (!phone) {
    return NextResponse.json({ success: false }, { status: 400 });
  }

  const { infosoftId, hash: resolvedHash } = await resolveInfosoftId(phone, hash);

  const text =
    infosoftId && resolvedHash
      ? SMS_TEXT_WITH_CUSTOMER.replace(
          "%s",
          EAVIS_URL_TEMPLATE + encodeURIComponent(resolvedHash)
        ).replace("%d", infosoftId)
      : SMS_TEXT_NO_CUSTOMER;

  const success = await sendSms({ phone, text, senderName: SMS_SENDER_NAME });

  return NextResponse.json({ success });
}
