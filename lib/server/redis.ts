import { Redis } from "@upstash/redis";

// HTTP-based client (not a persistent TCP connection like the old Predis
// setup) — this is the right fit for serverless functions, see PLAN.md.
export const redis = Redis.fromEnv();
