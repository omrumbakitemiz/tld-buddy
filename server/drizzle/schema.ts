import { drizzle } from "drizzle-orm/vercel-postgres";
import { sql } from "@vercel/postgres";
import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

// Use this object to send drizzle queries to your DB
export const db = drizzle(sql);

export const RegionItems = pgTable("region_items", {
  id: serial("id").primaryKey(),
  regionSlug: text("region_slug").notNull(),
  itemName: text("item_name").notNull(),
  itemType: text("item_type").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const Regions = pgTable("regions", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull(),
  type: text("type").notNull(),
  world: text("world").notNull(),
  difficulty: text("difficulty").notNull(),
  areaSize: text("area_size").notNull(),
  releaseDate: text("release_date").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});
