import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

export type AppDatabase = ReturnType<typeof drizzle<typeof schema>>;

let poolInstance: pg.Pool;
let dbInstance: AppDatabase;

if (process.env.DATABASE_URL && process.env.DATABASE_URL !== "memory://") {
  poolInstance = new Pool({ connectionString: process.env.DATABASE_URL });
  dbInstance = drizzle(poolInstance, { schema });
} else {
  // Fallback for build time or test environment before injection
  poolInstance = new Pool({ connectionString: "postgresql://localhost:5432/placeholder" });
  dbInstance = drizzle(poolInstance, { schema });
}

export let pool = poolInstance;
export let db = dbInstance;

export function setTestDb(customDb: AppDatabase, customPool?: pg.Pool): void {
  db = customDb;
  if (customPool) pool = customPool;
}

export * from "./schema";
