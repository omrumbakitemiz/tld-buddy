import { db, Items } from "~~/server/drizzle/schema";

export default defineCachedEventHandler(
  async () => {
    return await db.select().from(Items);
  },
  {
    name: "getAllItems",
    maxAge: 60 * 60 * 24 * 365, // 1 year
    getKey: () => "items",
    shouldBypassCache: () => process.env.NODE_ENV === "development",
  }
);
