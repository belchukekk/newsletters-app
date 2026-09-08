import type { RowDataPacket } from "mysql2";
import { getPool } from "@/lib/server/db";

// New lookup, not a port of any old-app service — the legacy app never
// queried a customer profile table by email (only by phone, for /send-sms).
// This queries customer_iteras, KD's current subscription system (Infosoft
// has been fully replaced by Iteras) — primary-keyed by customer_id, indexed
// on email. Unlike the old Infosoft table, Iteras has a single email column
// (no email2/email3 alternates).

export type Customer = {
  customerId: number;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
};

interface CustomerRow extends RowDataPacket {
  customer_id: number;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
}

export async function getCustomerByEmail(email: string): Promise<Customer | null> {
  const pool = await getPool();
  const [rows] = await pool.query<CustomerRow[]>(
    `SELECT customer_id, first_name, last_name, email
     FROM kd_customer.customer_iteras
     WHERE email = ?
     LIMIT 1`,
    [email]
  );
  const row = rows[0];
  if (!row) return null;
  return {
    customerId: row.customer_id,
    firstName: row.first_name,
    lastName: row.last_name,
    email: row.email,
  };
}
