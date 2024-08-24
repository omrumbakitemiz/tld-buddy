import type { ItemLocations, Items } from "~~/server/drizzle/schema";

export type Region = {
  id: number;
  name: string;
  slug: string;
  type: string;
  world: string;
  difficulty: string;
}

export type NewItemType = typeof ItemLocations.$inferSelect & typeof Items.$inferSelect;

export type Location = {
  id: number;
  name: string;
  regionName: string;
  items: Partial<NewItemType>[];
}

export type RegionDetails = {
  name: string;
  locations: Location[];
}
