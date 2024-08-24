import { db, Regions } from "~~/server/drizzle/schema";

export default defineCachedEventHandler(
  async () => {
    return await db.select().from(Regions);
  },
  {
    name: "getAllRegions",
    maxAge: 60 * 60 * 24 * 365, // 1 year
    getKey: () => "regions",
    shouldBypassCache: () => process.env.NODE_ENV === "development",
  }
);
