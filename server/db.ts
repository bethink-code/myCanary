import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "../shared/schema";

const getDatabaseUrl = () => {
  if (process.env.NODE_ENV === "production" && process.env.DATABASE_URL_PRODUCTION) {
    return process.env.DATABASE_URL_PRODUCTION;
  }
  return process.env.DATABASE_URL!;
};

const sql = neon(getDatabaseUrl());
export const db = drizzle(sql, { schema });
