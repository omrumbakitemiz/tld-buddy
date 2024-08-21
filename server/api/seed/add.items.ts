import { db, Items } from "~~/server/drizzle/schema";

export default defineEventHandler(async () => {
  // if env is not development, don't allow adding items
  if (process.env.NODE_ENV !== "development") {
    throw new Response("Not allowed", { status: 403 });
  }

  // check if the items already exists
  const allItems = await db.select().from(Items);
  if (allItems.length > 0) {
    throw new Response("Items already exists", { status: 400 });
  }

  const items = (await import("../../../tld-data/items.json")).default;

  const mappedItems = items.map(item => {
    if (item.comment && Array.isArray(item.comment)) {
      item.comment = item.comment.join(" ~ ");
    }
    return item;
  }) as typeof Items.$inferInsert;

  await db.insert(Items).values(mappedItems);
});
