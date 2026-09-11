import mysql, { type Pool } from "mysql2/promise";
import {
  Connector,
  GoogleAuth,
  IpAddressTypes,
} from "@google-cloud/cloud-sql-connector";

// Cloud SQL has no fixed source IP to put in its authorized-networks
// firewall for Vercel's serverless functions, so we tunnel through the
// Cloud SQL connector (IAM-authenticated, works from any source IP) instead
// of a raw host:port TCP connection. Locally, set GOOGLE_APPLICATION_CREDENTIALS
// to a service account key file path (the connector's default ADC lookup
// picks it up); on Vercel there's no persistent filesystem for that, so set
// GOOGLE_CLOUD_CREDENTIALS_JSON to the same key's JSON content instead, see
// .env.example.
const connector = new Connector(
  process.env.GOOGLE_CLOUD_CREDENTIALS_JSON
    ? {
        auth: new GoogleAuth({
          credentials: JSON.parse(process.env.GOOGLE_CLOUD_CREDENTIALS_JSON),
          scopes: ["https://www.googleapis.com/auth/sqlservice.admin"],
        }),
      }
    : undefined
);

let poolPromise: Promise<Pool> | undefined;

// Module-scope singleton, memoized on first use, so the pool (and its
// underlying Cloud SQL tunnel) is reused across invocations on a warm
// serverless instance instead of reconnecting every request. Keep
// connectionLimit low — Cloud SQL's max_connections is shared with other
// KD systems, and this app's real traffic doesn't need more.
export function getPool(): Promise<Pool> {
  if (!poolPromise) {
    poolPromise = connector
      .getOptions({
        instanceConnectionName: requireEnv("DB_INSTANCE_CONNECTION_NAME"),
        ipType: IpAddressTypes.PUBLIC,
      })
      .then((clientOpts) =>
        mysql.createPool({
          ...clientOpts,
          user: process.env.DB_USER,
          password: process.env.DB_PASSWORD,
          database: process.env.DB_NAME,
          connectionLimit: 5,
          waitForConnections: true,
          queueLimit: 0,
        })
      );
  }
  return poolPromise;
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}
