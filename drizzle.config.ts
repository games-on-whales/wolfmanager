import type { Config } from "drizzle-kit";

export default {
  schema: "./src/lib/db/schema/*",
  out: "./src/lib/db/migrations",
  dialect: "sqlite",
  dbCredentials: {
    url: "./data/wolfmanager.db",
  },
  verbose: true,
  strict: true,
} satisfies Config;