import type { RowDataPacket } from "mysql2";
import { NextResponse } from "next/server";
import { getPool } from "@/lib/server/db";
import { decryptIterasId, encryptIterasId } from "@/lib/integrations/e-avis-crypto";
import { sendSms } from "@/lib/integrations/inmobile-sms";

const SMS_SENDER_NAME = "Kr. Dagblad";
const EAVIS_URL_TEMPLATE = "https://nyhedsbreve.kristeligt-dagblad.dk/e-avis?subscription=";
const SMS_TEXT_WITH_CUSTOMER =
  "Gå til app - og klik på knappen 'Log ind i app': %s. Hvis du ikke har hentet Kristeligt Dagblads app, skal du klikke på knappen 'Hent app'. Er du ikke logget ind i app'en, så log ind med abonnementsnr: %d i feltet 'Abonnementsnummer'.";
const SMS_TEXT_NO_CUSTOMER =
  "Hent Kristeligt Dagblads app her: https://nyhedsbreve.kristeligt-dagblad.dk/e-avis. Login med samme oplysninger som på www.k.dk, eller kontakt kundeservice på tlf. 33 48 05 05 eller abonnement@k.dk";

interface IterasCustomerRow extends RowDataPacket {
  customer_id: number;
}

// Port of Controller::getInfosoftId — resolves the target's Iteras customer
// id either from an already-encrypted hash (subscription param, carried over
// from /e-avis) or by phone lookup in customer_iteras. (Formerly a lookup
// against customer_infosoft/infosoft_id — Infosoft has been fully replaced
// by Iteras as the subscription system.)
async function resolveCustomerId(
  phone: string,
  hash: string | undefined
): Promise<{ customerId: string | null; hash: string | undefined }> {
  if (hash) {
    return { customerId: decryptIterasId(hash), hash };
  }

  const pool = await getPool();
  const [rows] = await pool.query<IterasCustomerRow[]>(
    `SELECT * FROM kd_customer.customer_iteras WHERE phone_number = ? OR cell_phone_number = ? LIMIT 1`,
    [phone, phone]
  );
  const customerId = rows[0]?.customer_id;
  if (customerId === undefined) return { customerId: null, hash: undefined };

  const customerIdStr = String(customerId);
  return { customerId: customerIdStr, hash: encryptIterasId(customerIdStr) ?? undefined };
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

  const { customerId, hash: resolvedHash } = await resolveCustomerId(phone, hash);

  const text =
    customerId && resolvedHash
      ? SMS_TEXT_WITH_CUSTOMER.replace(
          "%s",
          EAVIS_URL_TEMPLATE + encodeURIComponent(resolvedHash)
        ).replace("%d", customerId)
      : SMS_TEXT_NO_CUSTOMER;

  const success = await sendSms({ phone, text, senderName: SMS_SENDER_NAME });

  return NextResponse.json({ success });
}
