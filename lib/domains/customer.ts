import type { RowDataPacket } from "mysql2";
import { getPool } from "@/lib/server/db";

// New lookup, not a port of any old-app service — the legacy app never
// queried customer_infosoft by email (only by phone, for /send-sms). Same
// table though: KD's actual Infosoft customer profile data, primary-keyed by
// infosoft_id but separately indexed on email (and checked against the two
// alternate email columns too, since a newsletter signup may use a different
// address than the primary subscription email).

export type Customer = {
  infosoftId: number;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
};

interface CustomerRow extends RowDataPacket {
  infosoft_id: number;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
}

export async function getCustomerByEmail(email: string): Promise<Customer | null> {
  const pool = await getPool();
  const [rows] = await pool.query<CustomerRow[]>(
    `SELECT infosoft_id, first_name, last_name, email
     FROM kd_customer.customer_infosoft
     WHERE email = ? OR email2 = ? OR email3 = ?
     LIMIT 1`,
    [email, email, email]
  );
  const row = rows[0];
  if (!row) return null;
  return {
    infosoftId: row.infosoft_id,
    firstName: row.first_name,
    lastName: row.last_name,
    email: row.email,
  };
}
