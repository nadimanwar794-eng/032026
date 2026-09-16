import * as schema from "./schema";

let pool: any;
let db: any;

if (process.env.DATABASE_URL) {
  try {
    const pg = (await import("pg")).default;
    const { drizzle } = await import("drizzle-orm/node-postgres");
    pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
    db = drizzle(pool, { schema });
  } catch {
    console.warn("[AI Studio] Database connection failed — fallback to mock");
  }
}

if (!db) {
  console.warn("[AI Studio] DATABASE_URL not set — using mock db");
  const noOp = {
    findMany: async () => [],
    findFirst: async () => null,
    findUnique: async () => null,
    create: async (d: any) => d?.data ?? {},
    update: async (d: any) => d?.data ?? {},
    delete: async () => ({}),
  };
  db = new Proxy({}, {
    get: (_, prop) =>
      prop === "query" ? new Proxy({}, { get: () => noOp }) : async () => [],
  });
  pool = {
    query: async () => ({ rows: [] }),
    connect: async () => ({ query: async () => ({ rows: [] }), release: () => {} }),
  };
}

export { pool, db };
export * from "./schema";
