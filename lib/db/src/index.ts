import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

export let pool: any = null;
export let db: any = null;

const noOp = {
  findMany: async () => [],
  findFirst: async () => null,
  findUnique: async () => null,
  create: async (d: any) => d?.data ?? {},
  update: async (d: any) => d?.data ?? {},
  delete: async () => ({}),
};

if (process.env.DATABASE_URL) {
  try {
    pool = new Pool({ connectionString: process.env.DATABASE_URL });
    db = drizzle(pool, { schema });
  } catch (e) {
    console.warn("[AI Studio] Database not connected — using mock", e);
    db = new Proxy({}, {
      get: (_, prop) => prop === 'query'
        ? new Proxy({}, { get: () => noOp }) : async () => [],
    });
  }
} else {
  console.warn("[AI Studio] DATABASE_URL not set — using mock");
  db = new Proxy({}, {
    get: (_, prop) => prop === 'query'
      ? new Proxy({}, { get: () => noOp }) : async () => [],
  });
}

export * from "./schema";
