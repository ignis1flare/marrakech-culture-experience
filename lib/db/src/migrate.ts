import path from "node:path";
import { fileURLToPath } from "node:url";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { db, pool } from "./index";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export async function runMigrations(): Promise<void> {
  const migrationsFolder = path.resolve(__dirname, "../migrations");
  console.log(`Running database migrations from ${migrationsFolder}...`);
  await migrate(db, { migrationsFolder });
  console.log("Database migrations applied successfully.");
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  runMigrations()
    .then(() => pool.end())
    .catch((err) => {
      console.error("Migration failed:", err);
      process.exit(1);
    });
}
