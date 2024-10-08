import { drizzle } from "drizzle-orm/vercel-postgres";
import { sql } from "@vercel/postgres";
import { integer, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

export const db = drizzle(sql);

export const Regions = pgTable("regions", {
	id: serial("id").primaryKey(),
	name: text("name").notNull(),
	slug: text("slug").notNull(),
	type: text("type"),
	world: text("world"),
	difficulty: text("difficulty"),
});

export const Locations = pgTable("locations", {
	id: serial("id").primaryKey(),
	name: text("name").notNull(),
	regionName: text("region_name").notNull(),
});

export const Items = pgTable("items", {
	id: serial('id').primaryKey(),
	slug: text('slug').notNull(),
  name: text('name').notNull(),
  weight: text('weight'),
  comment: text('comment'),
  type: text('type'),
  survivalSkill: text('survivalSkill'),
  warmth: text('warmth'),
  weightkg: text('weightkg'),
  curetime: text('curetime'),
  notes: text('notes'),
  craftinto: text('craftinto'),
  canbeshelledinto: text('canbeshelledinto'),
  usedasrecipeingredients: text('usedasrecipeingredients'),
  usedtocreate: text('usedtocreate'),
  cooktoproduce: text('cooktoproduce'),
  calories: text('calories'),
  hydration: text('hydration'),
  calorieDensity: text('calorieDensity'),
  vitaminC: text('vitaminC'),
  prevents: text('prevents'),
  effect: text('effect'),
  dose: text('dose'),
  cookedinto: text('cookedinto'),
  weightperdosekg: text('weightperdosekg'),
  weightperdoselb: text('weightperdoselb'),
  treatsrestores: text('treatsrestores'),
  dosesize: text('dosesize'),
  renewable: text('renewable'),
  temperature: text('temperature'),
  windproofness: text('windproofness'),
  waterproofness: text('waterproofness'),
  protection: text('protection'),
  mobility: text('mobility'),
  weightRatio: text('weightRatio'),
});

export const ItemLocations = pgTable("item_locations", {
  id: serial("id").primaryKey(),
	itemId: integer("item_id").notNull(),
	locationId: integer("location_id").notNull(),
  regionId: integer("region_id").notNull(),
  count: integer("count").default(1).notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});
