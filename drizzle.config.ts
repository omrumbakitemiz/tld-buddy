import { defineConfig } from 'drizzle-kit';
import dotenv from "dotenv";

dotenv.config({
  path: '.env.development.local'
});

export default defineConfig({
  dialect: "postgresql",
  schema: "./server/drizzle/schema.ts",
  dbCredentials: {
    url: process.env.POSTGRES_URL!,
  }
});
